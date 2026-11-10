/**
 * Compare OpenCidian with hieu-chu-han's dictionary.json (built from chinese-lexicon + CVDICT + kVietnamese).
 * Every difference falls into a named kind; each kind has an explanation in .claude/docs/compare-hieu-chu-han.md.
 * A kind not in EXPLAINED fails the test.
 */
import { cleanSenses, extractRefs, type RawLine } from "./cedict.ts";
import type { Entry } from "./model.ts";

/** One word of hieu-chu-han's dictionary.json (only the fields we compare). */
export interface HchWord {
  s: string; // simplified
  t: string; // traditional
  pt: string; // pinyin with tone numbers, no spaces
  vi: string; // Vietnamese, senses joined with " / "
  sv: string; // Hán Việt of the first character only
  hsk?: number;
}

export type Kind =
  | "same"
  | "word-not-in-cedict"
  | "pinyin-differs"
  | "vi-same-after-cleanup"
  | "vi-theirs-other-line"
  | "vi-ours-only"
  | "vi-ours-fallback-match"
  | "vi-cvdict-duplicate-key"
  | "unexplained";

export const EXPLAINED: Record<Exclude<Kind, "unexplained">, string> = {
  same: "Same pinyin and the same Vietnamese senses.",
  "word-not-in-cedict": "The word is in chinese-lexicon (an older CC-CEDICT plus its own additions) but not in the pinned CC-CEDICT.",
  "pinyin-differs": "chinese-lexicon writes this word's pinyin differently from the pinned CC-CEDICT (an older CEDICT reading, or letters written as one syllable).",
  "vi-same-after-cleanup": "Same senses once hieu-chu-han's raw CEDICT markers ([jue2], LT:…) are rendered the way OpenCidian renders them.",
  "vi-theirs-other-line": "hieu-chu-han's cvdict.json keeps one CVDICT line per simplified form, so the word shows the meaning of another line (another pronunciation or traditional form). OpenCidian matches simp|trad|pinyin.",
  "vi-ours-only": "hieu-chu-han has no Vietnamese for this word; OpenCidian has it.",
  "vi-cvdict-duplicate-key": "CVDICT has two lines with the same simp|trad|pinyin; OpenCidian keeps the senses of both, hieu-chu-han only one.",
  "vi-ours-fallback-match": "CC-CEDICT changed this line's traditional form or pinyin spacing since CVDICT was made; OpenCidian matched the CVDICT line by simplified form + pinyin.",
};

const norm = (p: string) => p.toLowerCase().replace(/u:|ü/g, "v").replace(/[\s-]/g, "");

function cleanTheirs(vi: string): string[] {
  return vi
    .split(" / ")
    .map((s) => s.normalize("NFC").trim())
    .filter((s) => s && !/^(?:CL|LT|Lượng từ|lượng từ)\s*:/.test(s))
    .map((s) => extractRefs(s).text);
}

const key = (xs: string[]) => xs.join(" | ").replace(/\s+/g, " ").trim();

export type HvKind = "hv-same" | "hv-ours-only" | "hv-both-empty" | "hv-theirs-only" | "hv-thieu-chuu-over-unihan" | "hv-corrected" | "hv-unihan-revised" | "hv-unexplained";

/** Hán Việt of the word's first character (hieu-chu-han only has that one). hv-theirs-only and hv-unexplained fail the test. */
export const HV_EXPLAINED: Record<Exclude<HvKind, "hv-unexplained" | "hv-theirs-only">, string> = {
  "hv-same": "hieu-chu-han's reading (or one of its readings, written \"a / b\") is one of OpenCidian's readings for the first character.",
  "hv-ours-only": "hieu-chu-han has no reading (Unihan kVietnamese lacks the character); OpenCidian has one from Thiều Chửu or from a traditional/variant form.",
  "hv-both-empty": "Neither has a reading: the character is in neither Thiều Chửu nor Unihan kVietnamese (see the build report's hanvietMissingHsk).",
  "hv-thieu-chuu-over-unihan": "hieu-chu-han shows Unihan kVietnamese, often a Nôm reading (细 tới, 搬 bưng); OpenCidian takes Thiều Chửu first.",
  "hv-corrected": "A correction file sets the reading (corrections/).",
  "hv-unihan-revised": "Both come from Unihan kVietnamese: hieu-chu-han's copy is older and Unicode 18 has revised it (艿 nẩy → nảy).",
};

export interface Row {
  word: HchWord;
  kind: Kind;
  ours?: { id: string; vi: string[]; hanviet0: string[] };
}

export function compare(words: HchWord[], entries: Entry[], cvdict: RawLine[]): { rows: Row[]; counts: Record<string, number>; hanviet: Record<string, number> } {
  const bySimp = new Map<string, Entry[]>();
  for (const e of entries) bySimp.set(e.simp, [...(bySimp.get(e.simp) ?? []), e]);
  const cvdictBySimp = new Map<string, { id: string; senses: string[] }[]>();
  for (const l of cvdict) {
    const list = cvdictBySimp.get(l.simp) ?? [];
    list.push({ id: `${l.simp}|${l.trad}|${l.pinyinNum}`, senses: cleanSenses(l.senses).senses });
    cvdictBySimp.set(l.simp, list);
  }
  const rows: Row[] = [];
  const hanviet: Record<string, number> = {};
  const hv = (k: HvKind) => { hanviet[k] = (hanviet[k] ?? 0) + 1; };
  for (const w of words) {
    const cands = bySimp.get(w.s) ?? [];
    if (!cands.length) { rows.push({ word: w, kind: "word-not-in-cedict" }); continue; }
    const match = cands.filter((e) => norm(e.pinyinNum) === norm(w.pt));
    const e = match.find((m) => m.trad === w.t) ?? match[0];
    if (!e) { rows.push({ word: w, kind: "pinyin-differs" }); continue; }
    const ours = e.vi?.senses ?? [];
    const theirs = cleanTheirs(w.vi);
    const ours0 = { id: e.id, vi: ours, hanviet0: e.hanviet[0]?.readings ?? [] };
    const lines = cvdictBySimp.get(w.s) ?? [];
    const exact = lines.find((l) => l.id === e.id);
    let kind: Kind;
    if (w.vi === ours.join(" / ")) kind = "same";
    else if (key(theirs) === key(ours)) kind = "vi-same-after-cleanup";
    else if (!theirs.length && ours.length) kind = "vi-ours-only";
    else if (lines.some((l) => l.id !== e.id && key(l.senses) === key(theirs))) kind = "vi-theirs-other-line";
    else if (lines.filter((l) => l.id === e.id).length > 1 && lines.some((l) => l.id === e.id && key(l.senses) === key(theirs))) kind = "vi-cvdict-duplicate-key";
    else if (!exact && ours.length && lines.some((l) => key(l.senses) === key(ours))) kind = "vi-ours-fallback-match";
    else kind = "unexplained";
    rows.push({ word: w, kind, ours: ours0 });

    const sv = w.sv.normalize("NFC").trim();
    const h0 = e.hanviet[0];
    if (!sv && !ours0.hanviet0.length) hv("hv-both-empty");
    else if (!sv) hv("hv-ours-only");
    else if (!ours0.hanviet0.length) hv("hv-theirs-only");
    else if (sv.split(" / ").some((r) => ours0.hanviet0.includes(r.trim()))) hv("hv-same");
    else if (h0?.src === "thieu-chuu") hv("hv-thieu-chuu-over-unihan");
    else if (h0?.src === "correction") hv("hv-corrected");
    else if (h0?.src === "unihan") hv("hv-unihan-revised");
    else hv("hv-unexplained");
  }
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.kind] = (counts[r.kind] ?? 0) + 1;
  return { rows, counts, hanviet };
}
