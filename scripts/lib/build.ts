/**
 * Build the dictionary from the pinned sources, then apply the corrections.
 * Sources first, corrections on top: a correction the source already agrees with is reported as a no-op.
 */
import { gunzipSync } from "node:zlib";
import { cleanSenses, dedupeRefs, entryId, parseFile, type RawLine } from "./cedict.ts";
import { applyOp, type LoadedCorrection } from "./corrections.ts";
import { parseHsk } from "./hsk.ts";
import { parseMakemeahanzi, type MmahChar } from "./makemeahanzi.ts";
import type { Char, Entry, Src } from "./model.ts";
import { matchKey, toMarks } from "./pinyin.ts";
import { readSource } from "./sources.ts";
import { parseThieuChuu } from "./thieuchuu.ts";
import { parseUnihan, type UnihanChar } from "./unihan.ts";

export interface SourceData {
  cedict: RawLine[];
  cvdict: RawLine[];
  unihan: Map<string, UnihanChar>;
  mmah: Map<string, MmahChar>;
  hsk: ReturnType<typeof parseHsk>;
  thieuChuu: Map<string, string[]>;
}

export function loadSources(): SourceData {
  const cedict = parseFile(gunzipSync(readSource("cc-cedict")).toString("utf8"));
  const cvdict = parseFile(readSource("cvdict").toString("utf8"));
  if (cedict.bad.length) console.warn(`cc-cedict: ${cedict.bad.length} lines not understood, skipped`);
  if (cvdict.bad.length) console.warn(`cvdict: ${cvdict.bad.length} lines not understood, skipped`);
  const tc = parseThieuChuu(readSource("thieu-chuu").toString("utf8"));
  if (tc.bad.length) console.warn(`thieu-chuu: ${tc.bad.length} readings not understood, skipped`);
  return {
    cedict: cedict.lines,
    cvdict: cvdict.lines,
    unihan: parseUnihan(readSource("unihan")),
    mmah: parseMakemeahanzi(readSource("makemeahanzi").toString("utf8")),
    hsk: parseHsk(readSource("hsk").toString("utf8")),
    thieuChuu: tc.readings,
  };
}

const IS_HAN = /^\p{Script=Han}$/u;

export interface CorrectionOutcome {
  file: string;
  target: string;
  field: string;
  status: "applied" | "no-op" | "target-missing" | "bad-index";
  before?: string[];
  after?: string[];
}

export interface BuildReport {
  cedictLines: number;
  entries: number;
  chars: number;
  withVi: number;
  withHanvietAllChars: number;
  hanvietViaVariant: number;
  withHsk: number;
  /** Characters of HSK words that have no Hán Việt reading, by lowest HSK 3.0 (else 2.0) level. */
  hanvietMissingHsk: Record<string, string>;
  hanvietBySrc: Record<string, number>;
  cvdictUnmatched: string[];
  hskUnmatched: string[];
  corrections: CorrectionOutcome[];
}

export interface BuildResult {
  entries: Entry[];
  chars: Char[];
  report: BuildReport;
}

function mergeLines(lines: RawLine[]): Map<string, RawLine> {
  const out = new Map<string, RawLine>();
  for (const l of lines) {
    const id = entryId(l);
    const prev = out.get(id);
    if (prev) for (const s of l.senses) { if (!prev.senses.includes(s)) prev.senses.push(s); }
    else out.set(id, { ...l, senses: [...l.senses] });
  }
  return out;
}

type HV = { readings: string[]; src: Src; via?: string };

export function build(src: SourceData, corrections: LoadedCorrection[]): BuildResult {
  const outcomes: CorrectionOutcome[] = [];
  const cedict = mergeLines(src.cedict);
  const cvdict = mergeLines(src.cvdict);
  // CVDICT was translated from an older CC-CEDICT: when the exact key is gone, accept a line whose pinyin
  // differs only in case, spacing or hyphens ("AA - zhi4" → "AA zhi4"). A changed pronunciation is not matched.
  const looseKey = (l: { simp: string; trad: string; pinyinNum: string }) => `${l.simp}|${l.trad}|${l.pinyinNum.toLowerCase().replace(/[\s-]/g, "")}`;
  const cvdictLoose = new Map<string, string | null>(); // null: more than one line, ambiguous
  // Last resort: CC-CEDICT changed the traditional form since (歎 → 嘆): same simplified form and pinyin, one candidate only.
  const simpKey = (l: { simp: string; pinyinNum: string }) => `${l.simp}|${l.pinyinNum.toLowerCase().replace(/[\s-]/g, "")}`;
  const cvdictBySimp = new Map<string, string | null>();
  for (const [id, l] of cvdict) {
    if (cedict.has(id)) continue;
    cvdictLoose.set(looseKey(l), cvdictLoose.has(looseKey(l)) ? null : id);
    cvdictBySimp.set(simpKey(l), cvdictBySimp.has(simpKey(l)) ? null : id);
  }
  const cvdictUsed = new Set<string>();

  // ── Characters. Hán Việt: Thiều Chửu first; Unihan kVietnamese (which often gives Nôm readings) only when
  // Thiều Chửu has nothing; in each, borrowed from the traditional form when the character itself has no entry.
  const charSet = new Set<string>();
  for (const l of cedict.values()) for (const ch of [...l.simp, ...l.trad]) if (IS_HAN.test(ch)) charSet.add(ch);
  for (const ch of src.mmah.keys()) if (IS_HAN.test(ch)) charSet.add(ch);

  const tcHV = (ch: string): HV | null => {
    const v = src.thieuChuu.get(ch);
    return v?.length ? { readings: v, src: "thieu-chuu" } : null;
  };
  const unihanHV = (ch: string): HV | null => {
    const v = src.unihan.get(ch)?.vietnamese;
    return v?.length ? { readings: v, src: "unihan" } : null;
  };
  const charHV = new Map<string, HV | null>();
  const resolveChar = (ch: string): HV | null => {
    if (charHV.has(ch)) return charHV.get(ch)!;
    // Other forms to borrow from, in order: traditional forms, then glyph variants (值/値), then semantic variants (告/吿).
    const u = src.unihan.get(ch);
    const trads = [...new Set([...(u?.traditionalVariants ?? []), ...(u?.zVariants ?? []), ...(u?.semanticVariants ?? [])])].filter((t) => t !== ch);
    let hv: HV | null = null;
    for (const own of [tcHV, unihanHV]) {
      hv = own(ch);
      for (const t of trads) {
        if (hv) break;
        const o = own(t);
        if (o) hv = { ...o, via: t };
      }
      if (hv) break;
    }
    charHV.set(ch, hv);
    return hv;
  };
  for (const ch of charSet) resolveChar(ch);

  const charCorrected = new Map<string, string[]>();
  for (const { file, c } of corrections) {
    if (!("char" in c.target)) continue;
    const ch = c.target.char;
    const target = `char:${ch}`;
    if (!charSet.has(ch)) { outcomes.push({ file, target, field: c.field, status: "target-missing" }); continue; }
    const before = charHV.get(ch)?.readings ?? [];
    const { value, changed } = applyOp(before, c);
    charHV.set(ch, { readings: value, src: changed ? "correction" : (charHV.get(ch)?.src ?? "unihan"), ...(changed ? {} : { via: charHV.get(ch)?.via }) });
    if (changed) charCorrected.set(ch, ["hanviet.readings"]);
    outcomes.push({ file, target, field: c.field, status: changed ? "applied" : "no-op", before, after: value });
  }

  // ── HSK levels, matched on simplified form + pinyin.
  const hskByKey = new Map<string, { hsk2?: number; hsk3?: number }>();
  for (const w of src.hsk) for (const f of w.forms) hskByKey.set(`${w.simp}|${matchKey(f.pinyinNum)}`, { hsk2: w.hsk2, hsk3: w.hsk3 });
  const hskUsed = new Set<string>();

  // ── Entries.
  const entries: Entry[] = [];
  const byId = new Map<string, Entry>();
  let hanvietViaVariant = 0;
  for (const [id, l] of cedict) {
    const s = [...l.simp];
    const t = [...l.trad];
    const hanviet: Entry["hanviet"] = [];
    s.forEach((ch, i) => {
      if (!IS_HAN.test(ch)) return;
      const tch = t.length === s.length && t[i] !== ch ? t[i] : undefined;
      let hv: HV | null;
      if (charCorrected.has(ch)) hv = charHV.get(ch)!;
      else if (tch && charCorrected.has(tch)) hv = charHV.get(tch)!;
      else if (tch && tcHV(tch)) hv = { ...tcHV(tch)!, via: tch };
      else if (charHV.get(ch)?.src === "thieu-chuu") hv = charHV.get(ch)!;
      else if (tch && unihanHV(tch)) hv = { ...unihanHV(tch)!, via: tch };
      else hv = charHV.get(ch) ?? null;
      if (hv?.via) hanvietViaVariant++;
      hanviet.push({
        char: ch,
        ...(tch ? { trad: tch } : {}),
        readings: hv?.readings ?? [],
        src: hv?.src ?? "unihan",
        ...(hv?.via ? { via: hv.via } : {}),
      });
    });

    const en = cleanSenses(l.senses);
    const looseId = cvdict.has(id) ? id : (cvdictLoose.get(looseKey(l)) ?? cvdictBySimp.get(simpKey(l)) ?? undefined);
    const viLine = looseId ? cvdict.get(looseId) : undefined;
    if (looseId) cvdictUsed.add(looseId);
    const vi = viLine ? cleanSenses(viLine.senses) : null;
    const classifiers = en.classifiers.length ? { items: dedupeRefs(en.classifiers), src: "cc-cedict" as const } : vi?.classifiers.length ? { items: dedupeRefs(vi.classifiers), src: "cvdict" as const } : undefined;
    const refs = dedupeRefs(en.refs);

    const e: Entry = {
      id,
      simp: l.simp,
      trad: l.trad,
      pinyin: toMarks(l.pinyinNum),
      pinyinNum: l.pinyinNum,
      hanviet,
      vi: vi && vi.senses.length ? { senses: vi.senses, src: "cvdict" } : null,
      en: { senses: en.senses, src: "cc-cedict" },
    };
    if (classifiers) e.classifiers = classifiers;
    if (refs.length) e.refs = { items: refs, src: "cc-cedict" };
    const hk = `${l.simp}|${matchKey(l.pinyinNum)}`;
    const h = hskByKey.get(hk);
    if (h) {
      e.hsk = { ...(h.hsk2 ? { hsk2: h.hsk2 } : {}), ...(h.hsk3 ? { hsk3: h.hsk3 } : {}), src: "hsk" };
      hskUsed.add(hk);
    }
    const corrected = new Set<string>();
    hanviet.forEach((h, i) => { if (h.src === "correction") corrected.add(`hanviet.${i}.readings`); });
    if (corrected.size) e.corrected = [...corrected];
    entries.push(e);
    byId.set(id, e);
  }

  // HSK words whose list pinyin doesn't match (the list mixes tone marks into its numeric pinyin, e.g. "bu4lìyú"):
  // take the word's only CC-CEDICT entry, if it has exactly one.
  const bySimp = new Map<string, Entry[]>();
  for (const e of entries) bySimp.set(e.simp, [...(bySimp.get(e.simp) ?? []), e]);
  for (const [hk, h] of hskByKey) {
    if (hskUsed.has(hk)) continue;
    const simp = hk.slice(0, hk.indexOf("|"));
    const only = bySimp.get(simp);
    if (only?.length === 1 && !only[0]!.hsk) {
      only[0]!.hsk = { ...(h.hsk2 ? { hsk2: h.hsk2 } : {}), ...(h.hsk3 ? { hsk3: h.hsk3 } : {}), src: "hsk" };
      hskUsed.add(hk);
    }
  }

  // ── Entry corrections (one pronunciation of one word).
  for (const { file, c } of corrections) {
    if (!("entry" in c.target)) continue;
    const target = `entry:${c.target.entry}`;
    const e = byId.get(c.target.entry);
    if (!e) { outcomes.push({ file, target, field: c.field, status: "target-missing" }); continue; }
    let before: string[];
    let write: (v: string[]) => void;
    const hm = /^hanviet\.(\d+)\.readings$/.exec(c.field);
    if (hm) {
      const h = e.hanviet[Number(hm[1])];
      if (!h) { outcomes.push({ file, target, field: c.field, status: "bad-index" }); continue; }
      before = h.readings;
      write = (v) => { h.readings = v; h.src = "correction"; delete h.via; };
    } else if (c.field === "vi.senses") {
      before = e.vi?.senses ?? [];
      write = (v) => { e.vi = { senses: v, src: "correction" }; };
    } else {
      before = e.en.senses;
      write = (v) => { e.en = { senses: v, src: "correction" }; };
    }
    const { value, changed } = applyOp(before, c);
    if (changed) {
      write(value);
      e.corrected = [...new Set([...(e.corrected ?? []), c.field])];
    }
    outcomes.push({ file, target, field: c.field, status: changed ? "applied" : "no-op", before, after: value });
  }

  // ── Character records.
  const hvOf = (ch: string) => charHV.get(ch) ?? resolveChar(ch);
  const chars: Char[] = [...charSet].sort().map((ch) => {
    const u = src.unihan.get(ch);
    const m = src.mmah.get(ch);
    const hv = hvOf(ch);
    const rec: Char = { char: ch, hanviet: hv ? { readings: hv.readings, src: hv.src, ...(hv.via ? { via: hv.via } : {}) } : null };
    if (m?.pinyin.length) rec.pinyin = { readings: m.pinyin, src: "makemeahanzi" };
    else if (u?.mandarin?.length) rec.pinyin = { readings: u.mandarin, src: "unihan" };
    if (m?.definition) rec.en = { text: m.definition, src: "makemeahanzi" };
    else if (u?.definition) rec.en = { text: u.definition, src: "unihan" };
    if (u?.totalStrokes) rec.strokes = { count: u.totalStrokes, src: "unihan" };
    if (m?.radical) rec.radical = { char: m.radical, src: "makemeahanzi" };
    if (m?.decomposition && m.decomposition !== "？") rec.decomposition = { ids: m.decomposition, src: "makemeahanzi" };
    if (m?.etymology) {
      const part = (p?: string) => (p ? { char: p, hanviet: hvOf(p)?.readings ?? [] } : undefined);
      const et = m.etymology;
      rec.etymology = {
        type: et.type,
        ...(et.hint ? { hint: et.hint } : {}),
        ...(et.semantic ? { semantic: part(et.semantic)! } : {}),
        ...(et.phonetic ? { phonetic: part(et.phonetic)! } : {}),
        src: "makemeahanzi",
      };
    }
    const simpl = u?.simplifiedVariants?.filter((c) => c !== ch);
    const trad = u?.traditionalVariants?.filter((c) => c !== ch);
    if (simpl?.length) rec.simplified = { chars: simpl, src: "unihan" };
    if (trad?.length) rec.traditional = { chars: trad, src: "unihan" };
    if (charCorrected.has(ch)) rec.corrected = charCorrected.get(ch)!;
    return rec;
  });

  const report: BuildReport = {
    cedictLines: src.cedict.length,
    entries: entries.length,
    chars: chars.length,
    withVi: entries.filter((e) => e.vi).length,
    withHanvietAllChars: entries.filter((e) => e.hanviet.length && e.hanviet.every((h) => h.readings.length)).length,
    hanvietViaVariant,
    withHsk: entries.filter((e) => e.hsk).length,
    hanvietMissingHsk: missingHsk(entries),
    hanvietBySrc: chars.reduce<Record<string, number>>((acc, c) => { const k = c.hanviet?.src ?? "none"; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {}),
    cvdictUnmatched: [...cvdict.keys()].filter((k) => !cedict.has(k) && !cvdictUsed.has(k)),
    hskUnmatched: [...hskByKey.keys()].filter((k) => !hskUsed.has(k)),
    corrections: outcomes,
  };
  return { entries, chars, report };
}

function missingHsk(entries: Entry[]): Record<string, string> {
  const level = new Map<string, number>();
  for (const e of entries) {
    const lv = e.hsk?.hsk3 ?? e.hsk?.hsk2;
    if (!lv) continue;
    for (const h of e.hanviet) if (!h.readings.length) level.set(h.char, Math.min(level.get(h.char) ?? 99, lv));
  }
  const out: Record<string, string> = {};
  for (const [ch, lv] of [...level].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))) out[`hsk${lv}`] = (out[`hsk${lv}`] ?? "") + ch;
  return out;
}
