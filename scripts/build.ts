/** npm run build → dist/entries.jsonl, dist/chars.jsonl, dist/meta.json, dist/report.json */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { build, loadSources } from "./lib/build.ts";
import { loadCorrections } from "./lib/corrections.ts";
import type { Meta } from "./lib/model.ts";
import { DIST_DIR } from "./lib/paths.ts";
import { readManifest, SOURCE_IDS } from "./lib/sources.ts";

function gitCommit(): string | null {
  try { return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null; }
  catch { return null; }
}

const t0 = Date.now();
const { corrections, errors } = loadCorrections();
if (errors.length) {
  for (const e of errors) console.error(`${e.file}: ${e.message}`);
  process.exit(1);
}
const { entries, chars, report } = build(loadSources(), corrections);

const builtAt = new Date().toISOString();
const commit = process.env.GITHUB_SHA ?? gitCommit();
const meta: Meta = {
  name: "OpenCidian",
  version: `${builtAt.slice(0, 10)}+${commit ? commit.slice(0, 7) : "local"}`,
  builtAt,
  commit,
  license: {
    id: "CC-BY-SA-4.0",
    url: "https://creativecommons.org/licenses/by-sa/4.0/",
    attribution: "OpenCidian by Perxel (github.com/OpenCidian), built from " + SOURCE_IDS.map((id) => readManifest(id).credit).join("; "),
  },
  sources: SOURCE_IDS.map((id) => {
    const m = readManifest(id);
    return { id, name: m.name, version: m.version, sha256: m.sha256, license: m.license.id, url: m.url, credit: m.credit };
  }),
  counts: { entries: entries.length, chars: chars.length, corrections: corrections.length },
};

mkdirSync(DIST_DIR, { recursive: true });
writeFileSync(path.join(DIST_DIR, "entries.jsonl"), entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
writeFileSync(path.join(DIST_DIR, "chars.jsonl"), chars.map((c) => JSON.stringify(c)).join("\n") + "\n");
writeFileSync(path.join(DIST_DIR, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
writeFileSync(path.join(DIST_DIR, "report.json"), JSON.stringify(report, null, 2) + "\n");

const pct = (n: number) => `${((100 * n) / report.entries).toFixed(1)}%`;
console.log(`OpenCidian ${meta.version}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
console.log(`  entries ${report.entries} (from ${report.cedictLines} CC-CEDICT lines), chars ${report.chars}`);
console.log(`  Vietnamese meaning: ${report.withVi} (${pct(report.withVi)}); Hán Việt for every character: ${report.withHanvietAllChars} (${pct(report.withHanvietAllChars)}); HSK: ${report.withHsk}`);
console.log(`  CVDICT lines with no CC-CEDICT entry: ${report.cvdictUnmatched.length}; HSK words not matched: ${report.hskUnmatched.length}`);
const by = (s: string) => report.corrections.filter((o) => o.status === s).length;
console.log(`  corrections: ${by("applied")} applied, ${by("no-op")} no-op, ${by("target-missing") + by("bad-index")} with a missing target`);
