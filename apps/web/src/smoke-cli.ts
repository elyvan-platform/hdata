import { readFile } from "node:fs/promises";
import { runSmoke } from "./smoke.ts";

const path = process.argv[2];
if (!path) throw new Error("Usage: node src/smoke-cli.ts /path/to/approved-real-examples.json");
const input: unknown = JSON.parse(await readFile(path, "utf8"));
console.log(JSON.stringify(await runSmoke(input), null, 2));
