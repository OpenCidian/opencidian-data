/** The Unihan fields we use, read straight from the pinned Unihan.zip. */
import { strFromU8, unzipSync } from "fflate";

export interface UnihanChar {
  vietnamese?: string[]; // kVietnamese
  totalStrokes?: number; // kTotalStrokes (first value: the Chinese count)
  rsUnicode?: string; // kRSUnicode, e.g. "149'.7"
  simplifiedVariants?: string[]; // kSimplifiedVariant
  traditionalVariants?: string[]; // kTraditionalVariant
  zVariants?: string[]; // kZVariant: the same character, another glyph (值 / 値)
  semanticVariants?: string[]; // kSemanticVariant: interchangeable characters (告 / 吿)
  mandarin?: string[]; // kMandarin
  definition?: string; // kDefinition
}

const WANTED = new Set(["kVietnamese", "kTotalStrokes", "kRSUnicode", "kSimplifiedVariant", "kTraditionalVariant", "kZVariant", "kSemanticVariant", "kMandarin", "kDefinition"]);
const FILES = ["Unihan_Readings.txt", "Unihan_IRGSources.txt", "Unihan_Variants.txt"];

function cp(code: string): string {
  return String.fromCodePoint(parseInt(code.replace(/^U\+/, ""), 16));
}

export function parseUnihan(zip: Uint8Array): Map<string, UnihanChar> {
  const files = unzipSync(zip, { filter: (f) => FILES.includes(f.name) });
  const out = new Map<string, UnihanChar>();
  for (const name of FILES) {
    const data = files[name];
    if (!data) throw new Error(`Unihan.zip has no ${name}`);
    for (const line of strFromU8(data).split("\n")) {
      if (!line || line.startsWith("#")) continue;
      const [code, field, value] = line.split("\t");
      if (!code || !field || value === undefined || !WANTED.has(field)) continue;
      const ch = cp(code);
      const rec = out.get(ch) ?? {};
      const v = value.trim();
      switch (field) {
        case "kVietnamese": rec.vietnamese = v.split(/\s+/).map((s) => s.normalize("NFC")); break;
        case "kTotalStrokes": rec.totalStrokes = Number(v.split(/\s+/)[0]); break;
        case "kRSUnicode": rec.rsUnicode = v.split(/\s+/)[0]; break;
        case "kSimplifiedVariant": rec.simplifiedVariants = v.split(/\s+/).map((c) => cp(c.split("<")[0]!)); break;
        case "kTraditionalVariant": rec.traditionalVariants = v.split(/\s+/).map((c) => cp(c.split("<")[0]!)); break;
        case "kZVariant": rec.zVariants = v.split(/\s+/).map((c) => cp(c.split("<")[0]!)); break;
        case "kSemanticVariant": rec.semanticVariants = v.split(/\s+/).map((c) => cp(c.split("<")[0]!)); break;
        case "kMandarin": rec.mandarin = v.split(/\s+/); break;
        case "kDefinition": rec.definition = v; break;
      }
      out.set(ch, rec);
    }
  }
  return out;
}
