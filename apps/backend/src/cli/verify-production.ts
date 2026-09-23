import { loadConfig, PRODUCTION_CHECKED_KEYS, formatProductionVerifyOutput } from "../infrastructure/config/env.js";

function main(): void {
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "production";
  }
  loadConfig();
  console.log(formatProductionVerifyOutput(PRODUCTION_CHECKED_KEYS));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Invalid production configuration.");
  process.exit(1);
}
