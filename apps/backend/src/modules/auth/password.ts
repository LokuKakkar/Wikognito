import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { AppError } from "../errors.js";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/**
 * scrypt runs on libuv's 4-thread pool, which Node also uses for DNS, files and zlib. A burst of
 * logins could occupy every thread and stall the whole server, so cap concurrent hashes and shed
 * load (HTTP 503) once the queue is full instead of piling up work.
 */
const MAX_CONCURRENT_HASHES = 2;
const MAX_QUEUED_HASHES = 16;
let activeHashes = 0;
const waiting: Array<() => void> = [];

export class HashBusyError extends AppError {
  constructor() {
    super("SERVER_BUSY", "The server is busy. Please try again shortly.", 503);
  }
}

async function withHashSlot<T>(work: () => Promise<T>): Promise<T> {
  if (activeHashes >= MAX_CONCURRENT_HASHES) {
    if (waiting.length >= MAX_QUEUED_HASHES) throw new HashBusyError();
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else {
    activeHashes += 1;
  }
  try {
    return await work();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else activeHashes -= 1;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await withHashSlot(() => scryptAsync(password, salt, KEY_LENGTH))) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await withHashSlot(() => scryptAsync(password, salt, KEY_LENGTH))) as Buffer;
  const expected = Buffer.from(hash, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
