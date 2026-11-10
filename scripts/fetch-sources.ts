/**
 * Download every pinned source into .cache/sources/ and check it against its source.json checksum.
 *   npm run fetch-sources                      download what's missing, check everything
 *   npm run fetch-sources -- --update cc-cedict   take CC-CEDICT's latest export and re-pin it (writes the file and source.json)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { manifestPath, readManifest, sha256, SOURCE_IDS, sourceFile, type SourceId } from "./lib/sources.ts";

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "user-agent": "opencidian-data (fetch-sources)" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function updateCedict(): Promise<void> {
  const m = readManifest("cc-cedict");
  const buf = await download(m.url);
  const date = /^#! date=(\S+)/m.exec(gunzipSync(buf).subarray(0, 4000).toString("utf8"))?.[1];
  if (!date) throw new Error("cc-cedict: no '#! date=' header in the export");
  writeFileSync(sourceFile(m), buf);
  const next = { ...m, version: date, retrieved: new Date().toISOString().slice(0, 10), sha256: sha256(buf) };
  writeFileSync(manifestPath("cc-cedict"), JSON.stringify(next, null, 2) + "\n");
  console.log(`cc-cedict: ${m.version} → ${date} (${buf.length} bytes)`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const u = args.indexOf("--update");
  if (u >= 0) {
    const id = args[u + 1];
    if (id !== "cc-cedict") throw new Error("--update only handles cc-cedict (the others are pinned to a URL: edit source.json by hand)");
    await updateCedict();
  }
  let failed = false;
  for (const id of SOURCE_IDS as readonly SourceId[]) {
    const m = readManifest(id);
    const file = sourceFile(m);
    if (!existsSync(file)) {
      if (m.inRepo) { console.error(`${id}: ${file} should be in the repo and is missing`); failed = true; continue; }
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, await download(m.url));
      console.log(`${id}: downloaded ${m.url}`);
    }
    const got = sha256(readFileSync(file));
    if (got === m.sha256) console.log(`${id}: ${m.version} ✓`);
    else { console.error(`${id}: checksum ${got} ≠ pinned ${m.sha256}`); failed = true; }
  }
  if (failed) process.exit(1);
}

await main();
