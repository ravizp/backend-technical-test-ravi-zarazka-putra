import { closeDb } from "./client.js";

// Database seeder
async function main(): Promise<void> {
  console.info("[seed] no tables yet — seeding is added in a later phase.");
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err: unknown) => {
    console.error("[seed] failed:", err);
    await closeDb();
    process.exit(1);
  });
