import { readFile } from "node:fs/promises";
const input=process.argv.at(-1);process.stdout.write(input?await readFile(input,"utf8"):"");
