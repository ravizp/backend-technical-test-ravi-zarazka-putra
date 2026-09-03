import { closeDb } from "../connection-postgresql.js";
import { seedUsers } from "./users.seeder.js";

/**
 * Seeder entry point. Run with:
 *   npm run db:seed              -> run every seeder, in order
 *   npm run db:seed -- users     -> run only the "users" seeder
 */
const seeders: Record<string, () => Promise<void>> = {
  users: seedUsers,
};

async function run(): Promise<void> {
  const target = process.argv[2];

  if (target && !(target in seeders)) {
    throw new Error(
      `unknown seeder "${target}". available: ${Object.keys(seeders).join(", ") || "(none)"}`,
    );
  }

  const entries = target
    ? [[target, seeders[target]] as const]
    : (Object.entries(seeders) as [string, () => Promise<void>][]);

  for (const [name, fn] of entries) {
    console.info(`[seed] running: ${name}`);
    await fn!();
  }
  console.info("[seed] done.");
}

run()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err: unknown) => {
    console.error("[seed] failed:", err instanceof Error ? err.message : err);
    await closeDb();
    process.exit(1);
  });
