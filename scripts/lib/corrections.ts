/** Correction files (corrections/**\/*.yml): load, check, and apply on top of the source values. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { Correction } from "./model.ts";
import { CORRECTIONS_DIR, ROOT } from "./paths.ts";

export interface LoadedCorrection {
  file: string; // repo-relative
  c: Correction;
}

export interface LoadResult {
  corrections: LoadedCorrection[];
  errors: { file: string; message: string }[];
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.ya?ml$/.test(name)) out.push(p);
  }
  return out.sort();
}

export function loadCorrections(dir = CORRECTIONS_DIR): LoadResult {
  const corrections: LoadedCorrection[] = [];
  const errors: LoadResult["errors"] = [];
  for (const abs of walk(dir)) {
    const file = path.relative(ROOT, abs);
    try {
      const raw = parse(readFileSync(abs, "utf8"));
      const r = Correction.safeParse(raw);
      if (!r.success) {
        errors.push({ file, message: r.error.issues.map((i) => `${i.path.join(".") || "(file)"}: ${i.message}`).join("; ") });
        continue;
      }
      // Normalise every value to NFC so a correction typed on any keyboard compares equal to the source.
      const c = r.data;
      for (const k of ["set", "add", "remove"] as const) if (c[k]) c[k] = c[k].map((s) => s.normalize("NFC").trim());
      corrections.push({ file, c });
    } catch (e) {
      errors.push({ file, message: `not valid YAML: ${(e as Error).message}` });
    }
  }
  return { corrections, errors };
}

export function targetKey(c: Correction): string {
  return "char" in c.target ? `char:${c.target.char}` : `entry:${c.target.entry}`;
}

/** The new list after a correction, and whether it changed anything compared with the source value. */
export function applyOp(current: string[], c: Correction): { value: string[]; changed: boolean } {
  let value: string[];
  if (c.set) value = [...c.set];
  else if (c.add) value = [...current, ...c.add.filter((v) => !current.includes(v))];
  else value = current.filter((v) => !c.remove!.includes(v));
  const changed = value.length !== current.length || value.some((v, i) => v !== current[i]);
  return { value, changed };
}
