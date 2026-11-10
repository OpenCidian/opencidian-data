/**
 * npm run validate: build in memory, then check
 *   - every correction file against the schema, that its target exists, and that two files don't touch the same field;
 *   - every record against the schema (well-formed Hán Việt syllables, NFC text);
 *   - corrections the sources already agree with (no-ops): flagged so they can be removed.
 * Errors exit 1; warnings don't.
 */
import { build, loadSources } from "./lib/build.ts";
import { loadCorrections, targetKey } from "./lib/corrections.ts";
import { Char, Entry } from "./lib/model.ts";

const errors: string[] = [];
const warnings: string[] = [];

const { corrections, errors: loadErrors } = loadCorrections();
for (const e of loadErrors) errors.push(`${e.file}: ${e.message}`);

const seen = new Map<string, string>();
for (const { file, c } of corrections) {
  const k = `${targetKey(c)} ${c.field}`;
  const prev = seen.get(k);
  if (prev) errors.push(`${file}: conflicts with ${prev} (both change ${k})`);
  else seen.set(k, file);
}

const { entries, chars, report } = build(loadSources(), corrections);
for (const o of report.corrections) {
  if (o.status === "target-missing") errors.push(`${o.file}: target ${o.target} is not in the dictionary`);
  if (o.status === "bad-index") errors.push(`${o.file}: ${o.target} has no ${o.field}`);
  if (o.status === "no-op") warnings.push(`${o.file}: no-op, the sources already give ${JSON.stringify(o.after)}; remove it`);
}

function check<T>(kind: string, schema: { safeParse(v: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, items: T[], key: (t: T) => string) {
  let bad = 0;
  for (const it of items) {
    const r = schema.safeParse(it);
    if (!r.success) {
      if (bad++ < 20) errors.push(`${kind} ${key(it)}: ${r.error!.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    }
  }
  if (bad > 20) errors.push(`${kind}: ${bad - 20} more invalid records`);
}
check("entry", Entry, entries, (e) => e.id);
check("char", Char, chars, (c) => c.char);

const notNfc = entries.filter((e) => [...(e.vi?.senses ?? []), ...e.en.senses].some((s) => s !== s.normalize("NFC")));
if (notNfc.length) errors.push(`${notNfc.length} entries have text that is not NFC, e.g. ${notNfc[0]!.id}`);

// A CEDICT reference the build couldn't turn into text (e.g. one with Latin letters inside the word).
const RAW_REF = /\[[A-Za-z:]+[1-5](?: [A-Za-z:]+[1-5])*\]/;
const rawRefs = entries.filter((e) => [...(e.vi?.senses ?? []), ...e.en.senses].some((s) => RAW_REF.test(s)));
if (rawRefs.length) warnings.push(`${rawRefs.length} entries still show a raw CEDICT reference in a sense, e.g. ${rawRefs.slice(0, 3).map((e) => e.id).join(", ")}`);

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);
console.log(`validate: ${corrections.length} corrections, ${entries.length} entries, ${chars.length} chars; ${errors.length} errors, ${warnings.length} warnings`);
if (errors.length) process.exit(1);
