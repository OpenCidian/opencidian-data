/** npm run release: gzip the build into dist/release/ with a SHA256SUMS file, ready to attach to a GitHub release. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { DIST_DIR } from "./lib/paths.ts";

const out = path.join(DIST_DIR, "release");
mkdirSync(out, { recursive: true });
const sums: string[] = [];
for (const [name, gz] of [["entries.jsonl", true], ["chars.jsonl", true], ["meta.json", false]] as const) {
  const src = path.join(DIST_DIR, name);
  if (!existsSync(src)) throw new Error(`${name} is missing: run npm run build first`);
  const buf = readFileSync(src);
  const file = gz ? `${name}.gz` : name;
  const data = gz ? gzipSync(buf, { level: 9 }) : buf;
  writeFileSync(path.join(out, file), data);
  sums.push(`${createHash("sha256").update(data).digest("hex")}  ${file}`);
  console.log(`${file}  ${(data.length / 1e6).toFixed(1)} MB`);
}
writeFileSync(path.join(out, "SHA256SUMS"), sums.join("\n") + "\n");
const meta = JSON.parse(readFileSync(path.join(DIST_DIR, "meta.json"), "utf8")) as { version: string };
writeFileSync(path.join(out, "VERSION"), meta.version + "\n");
console.log(`release ${meta.version} → ${path.relative(process.cwd(), out)}`);
