import "dotenv/config";
import { createApp } from "./app";
import { ensureDatabase } from "./embedded";
import { ensureDefaultUser } from "./lib/auth";
import { migrate } from "./migrate";
import { seed } from "./seed";

async function main() {
  await ensureDatabase();
  await migrate();
  await seed();
  await ensureDefaultUser();
  const port = Number(process.env.PORT || 9004);
  createApp().listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});