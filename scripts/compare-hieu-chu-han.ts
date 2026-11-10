/**
 * npm run compare:hch -- [path to hieu-chu-han/public/data/dictionary.json]
 * Compares the whole file with the current build (dist/), prints counts per kind with examples,
 * and refreshes the sample in test/fixtures/hieu-chu-han-sample.json (every HSK 1 word + every 100th word),
 * which test/compare.test.ts checks on every CI run.
 */
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadSources } from "./lib/build.ts";
import { compare, EXPLAINED, type HchWord } from "./lib/compare.ts";
import type { Entry } from "./lib/model.ts";
import { DIST_DIR, ROOT } from "./lib/paths.ts";

const file = process.argv[2] ?? path.join(os.homedir(), "PHUC-LOCAL/phucbm/hieu-chu-han/public/data/dictionary.json");
const all = (JSON.parse(readFileSync(file, "utf8")) as HchWord[]).map(({ s, t, pt, vi, sv, hsk }) => ({ s, t, pt, vi, sv, ...(hsk ? { hsk } : {}) }));
const entries = readFileSync(path.join(DIST_DIR, "entries.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as Entry);
const { cvdict } = loadSources();

const { rows, counts, hanviet } = compare(all, entries, cvdict);
console.log(`hieu-chu-han: ${all.length} words`);
for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(30)} ${String(n).padStart(6)}  ${(EXPLAINED as Record<string, string>)[k] ?? "NOT EXPLAINED"}`);
  for (const r of rows.filter((r) => r.kind === k).slice(0, 2))
    console.log(`      ${r.word.s} [${r.word.pt}]  theirs: ${r.word.vi.slice(0, 50)}  ours: ${(r.ours?.vi.join("; ") ?? "-").slice(0, 50)}`);
}
console.log("  Hán Việt of the first character:", hanviet);

const sample = all.filter((w, i) => w.hsk === 1 || i % 100 === 0);
writeFileSync(path.join(ROOT, "test/fixtures/hieu-chu-han-sample.json"), JSON.stringify(sample, null, 0).replace(/\},\{/g, "},\n{") + "\n");
console.log(`sample: ${sample.length} words → test/fixtures/hieu-chu-han-sample.json`);
