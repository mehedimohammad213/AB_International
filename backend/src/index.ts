import "dotenv/config";
import { createApp } from "./app";
import { ensureDatabase } from "./embedded";
import { migrate } from "./migrate";

async function main() {
  await ensureDatabase();
  await migrate();
  const port = Number(process.env.PORT || 4000);
  createApp().listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
