import "dotenv/config";
import { ensureDatabase } from "./embedded";
import { migrate } from "./migrate";
import { seed } from "./seed";
import { stopDatabase } from "./embedded";

async function main() {
  await ensureDatabase();
  await migrate();
  await seed();
  await stopDatabase();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
