import { randomBytes, createHash } from "node:crypto";
import type { Redis } from "ioredis";
import { OAUTH_STATE_TTL_SECONDS, REDIS_OAUTH_STATE_KEY_PREFIX } from "@redactle/shared";
import { AppError } from "../errors.js";

export interface GoogleProfile {
  providerSubject: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface GoogleOAuthAdapter {
  isConfigured(): boolean;
  createAuthorizationUrl(sessionId: string): Promise<string>;
  exchangeCallback(input: {
    code: string;
    state: string;
    sessionId: string;
  }): Promise<GoogleProfile>;
}

interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface OAuthStatePayload {
  sessionId: string;
  codeVerifier: string;
}

export class UnconfiguredGoogleOAuth implements GoogleOAuthAdapter {
  isConfigured(): boolean {
    return false;
  }

  async createAuthorizationUrl(): Promise<string> {
    throw new AppError("OAUTH_NOT_CONFIGURED", "Google OAuth is not configured.", 503);
  }

  async exchangeCallback(): Promise<GoogleProfile> {
    throw new AppError("OAUTH_NOT_CONFIGURED", "Google OAuth is not configured.", 503);
  }
}

/**
 * Authorization-code + PKCE client for Google.
 * State is bound to the current session cookie in Redis so another browser
 * cannot complete the callback for this login.
 */
export class GoogleOAuthClient implements GoogleOAuthAdapter {
  constructor(
    private readonly redis: Redis,
    private readonly config: GoogleOAuthConfig,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.clientId && this.config.clientSecret && this.config.redirectUri);
  }

  async createAuthorizationUrl(sessionId: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new AppError("OAUTH_NOT_CONFIGURED", "Google OAuth is not configured.", 503);
    }

    const state = randomBytes(24).toString("hex");
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    const payload: OAuthStatePayload = { sessionId, codeVerifier };
    await this.redis.set(
      this.stateKey(state),
      JSON.stringify(payload),
      "EX",
      OAUTH_STATE_TTL_SECONDS,
    );

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCallback(input: {
    code: string;
    state: string;
    sessionId: string;
  }): Promise<GoogleProfile> {
    if (!this.isConfigured()) {
      throw new AppError("OAUTH_NOT_CONFIGURED", "Google OAuth is not configured.", 503);
    }
    if (!input.code || !input.state) {
      throw new AppError("INVALID_OAUTH_CALLBACK", "Invalid OAuth callback.", 400);
    }

    const raw = await this.redis.get(this.stateKey(input.state));
    await this.redis.del(this.stateKey(input.state));
    if (!raw) {
      throw new AppError("INVALID_OAUTH_STATE", "OAuth state is missing or expired.", 400);
    }

    let payload: OAuthStatePayload;
    try {
      payload = JSON.parse(raw) as OAuthStatePayload;
    } catch {
      throw new AppError("INVALID_OAUTH_STATE", "OAuth state is invalid.", 400);
    }

    if (payload.sessionId !== input.sessionId) {
      throw new AppError("INVALID_OAUTH_STATE", "OAuth state does not match this session.", 400);
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: input.code,
        code_verifier: payload.codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new AppError("OAUTH_EXCHANGE_FAILED", "Google OAuth token exchange failed.", 400);
    }

    const tokenBody = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenBody.access_token) {
      throw new AppError("OAUTH_EXCHANGE_FAILED", "Google OAuth token exchange failed.", 400);
    }

    const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    });
    if (!userInfoResponse.ok) {
      throw new AppError("OAUTH_PROFILE_FAILED", "Failed to load Google profile.", 400);
    }

    const profile = (await userInfoResponse.json()) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
    };
    if (!profile.sub) {
      throw new AppError("OAUTH_PROFILE_FAILED", "Google profile is missing a subject identifier.", 400);
    }

    return {
      providerSubject: profile.sub,
      email: profile.email ?? null,
      displayName: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
    };
  }

  private stateKey(state: string): string {
    return `${REDIS_OAUTH_STATE_KEY_PREFIX}${state}`;
  }
}
