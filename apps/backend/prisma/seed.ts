import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { createArticleProvider } from "@redactle/article-provider";
import {
  createRedisTodayCache,
  persistPipelineResult,
  runIngestionPipeline,
  utcDateOnly,
  formatUtcDate,
  readyPuzzleId,
} from "@redactle/article-ingestion";
import { hashPassword } from "../src/modules/auth/password.js";
import { ensureCrowdPlay } from "../src/modules/crowd/seed-crowd-play.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient();

async function seedLocalEmailUsers(): Promise<void> {
  const accounts = [
    {
      id: "user-local-admin",
      email: "admin@redactle.local",
      displayName: "Local Admin",
      role: "ADMIN" as const,
      password: "redactle-admin",
    },
    {
      id: "user-local-player",
      email: "player@redactle.local",
      displayName: "Local Player",
      role: "USER" as const,
      password: "redactle-player",
    },
  ];

  for (const account of accounts) {
    const passwordHash = await hashPassword(account.password);
    await prisma.user.upsert({
      where: { id: account.id },
      create: {
        id: account.id,
        email: account.email,
        displayName: account.displayName,
        role: account.role,
        emailVerifiedAt: new Date(),
        identities: {
          create: {
            provider: "EMAIL",
            providerSubject: account.email,
            passwordHash,
          },
        },
      },
      update: {
        email: account.email,
        displayName: account.displayName,
        role: account.role,
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.authIdentity.upsert({
      where: {
        provider_providerSubject: {
          provider: "EMAIL",
          providerSubject: account.email,
        },
      },
      create: {
        userId: account.id,
        provider: "EMAIL",
        providerSubject: account.email,
        passwordHash,
      },
      update: {
        userId: account.id,
        passwordHash,
      },
    });
  }
}

async function main(): Promise<void> {
  await prisma.user.upsert({
    where: { id: "user-dummy-phase1" },
    create: { id: "user-dummy-phase1" },
    update: {},
  });
  await seedLocalEmailUsers();

  const provider = createArticleProvider("LOCAL");
  const article = (await provider.getArticles({ limit: 1 }))[0];
  if (!article) {
    throw new Error("No dummy article available from LocalArticleProvider");
  }

  const scheduledDate = utcDateOnly();
  const generatorVersion = process.env.PUZZLE_GENERATOR_VERSION ?? "2.0.0";
  const result = runIngestionPipeline(article, {
    puzzleId: readyPuzzleId(article.id, generatorVersion),
    puzzleNumber: 0,
    scheduledDate: formatUtcDate(scheduledDate),
    generatorVersion,
  });

  const redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true })
    : null;
  try {
    if (redis) {
      await redis.connect();
    }
    const persisted = await persistPipelineResult(result, {
      prisma,
      scheduledDate,
      puzzleNumber: 1,
      generatorVersion,
      cache: createRedisTodayCache(redis),
    });

    const crowdInserted = await ensureCrowdPlay(prisma);
    console.log(
      JSON.stringify(
        {
          seeded: true,
          userId: "user-dummy-phase1",
          localAdmin: "admin@redactle.local",
          localPlayer: "player@redactle.local",
          crowdPlayers: 20,
          crowdInserted,
          articleId: persisted.articleId,
          puzzleId: persisted.puzzleId,
          scheduledDate: formatUtcDate(scheduledDate),
        },
        null,
        2,
      ),
    );
  } finally {
    if (redis) {
      await redis.quit();
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
