import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { ensureCrowdPlay } from "../modules/crowd/seed-crowd-play.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../../../../.env") });

const prisma = new PrismaClient();

ensureCrowdPlay(prisma)
  .then(async (inserted) => {
    const today = new Date().toISOString().slice(0, 10);
    const players = await prisma.user.count({ where: { id: { startsWith: "crowd-" } } });
    const todayResults = await prisma.gameResult.count({
      where: {
        userId: { startsWith: "crowd-" },
        isOfficial: true,
        source: "DAILY",
        won: true,
        puzzle: { dailyAssignment: { date: new Date(`${today}T00:00:00.000Z`) } },
      },
    });
    console.log(JSON.stringify({ crowdPlayers: players, todayResults, inserted }, null, 2));
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
