/**
 * The CEDICT line format, shared by CC-CEDICT and CVDICT:
 *   覺 觉 [jue2] /to feel/to find that/CL:場|场[chang2]/
 * Senses can carry references to other words (覺|觉[jue2]) and a classifier list (CL: in CEDICT,
 * LT: or "Lượng từ:" in CVDICT). The build turns those into structured fields and readable text.
 */
import { toMarks } from "./pinyin.ts";

export interface RawLine {
  trad: string;
  simp: string;
  pinyinNum: string;
  senses: string[];
}

const LINE = /^(\S+) (\S+) \[([^\]]*)\] \/(.*)\/\s*$/;

export function parseLine(line: string): RawLine | null {
  if (!line || line.startsWith("#")) return null;
  const m = LINE.exec(line);
  if (!m) return null;
  return {
    trad: m[1]!,
    simp: m[2]!,
    pinyinNum: m[3]!.trim(),
    senses: m[4]!.split("/").map((s) => s.trim()).filter(Boolean),
  };
}

export function parseFile(text: string): { lines: RawLine[]; bad: string[] } {
  const lines: RawLine[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw || raw.startsWith("#")) continue;
    const p = parseLine(raw);
    if (p) lines.push(p);
    else bad.push(raw);
  }
  return { lines, bad };
}

/** The entry key both sources share: simp|trad|pinyin (CEDICT's own pinyin, with tone numbers). */
export function entryId(l: { simp: string; trad: string; pinyinNum: string }): string {
  return `${l.simp}|${l.trad}|${l.pinyinNum}`;
}

export interface WordRef {
  simp: string;
  trad: string;
  /** Tone marks; null when the reference gives no pinyin. */
  pinyin: string | null;
  /** The same reference in CEDICT's tone numbers, so it can be turned back into an entry id. */
  pinyinNum: string | null;
}

// A reference: 覺|觉[jue2], 觉[jue2] or 覺|觉. Words are Han characters (plus 〇 and ·, as in names).
const HAN = String.raw`[\p{Script=Han}〇·・]+`;
const REF = new RegExp(String.raw`(${HAN})(?:\|(${HAN}))?(?:\[([A-Za-z0-9:, ·]+)\])?`, "gu");

/**
 * Replace each reference in a sense with readable text ("觉 (jué)") and collect it.
 * A bare Han word with no "|" and no pinyin is plain text, not a reference, and is left alone.
 */
export function extractRefs(sense: string): { text: string; refs: WordRef[] } {
  const refs: WordRef[] = [];
  const text = sense.replace(REF, (whole, a: string, b: string | undefined, py: string | undefined) => {
    if (!b && !py) return whole;
    const trad = a; // with "|", a is the traditional form; without, it is both
    const simp = b ?? a;
    const pinyinNum = py?.trim() ?? null;
    const pinyin = pinyinNum ? toMarks(pinyinNum) : null;
    refs.push({ simp, trad, pinyin, pinyinNum });
    return pinyin ? `${simp} (${pinyin})` : simp;
  });
  // A bare pronunciation, as in "also pr. [pou1]" → "also pr. pōu".
  return { text: text.replace(BARE_PINYIN, (_, py: string) => toMarks(py)), refs };
}

const BARE_PINYIN = /\[([A-Za-z:]+[1-5](?: [A-Za-z:]+[1-5])*)\]/g;

const CLASSIFIER_PREFIX = /^(?:CL|LT|Lượng từ|lượng từ)\s*:\s*/;

/** "CL:個|个[ge4],隻|只[zhi1]" → the classifiers, or null if the sense isn't a classifier list. */
export function parseClassifiers(sense: string): WordRef[] | null {
  if (!CLASSIFIER_PREFIX.test(sense)) return null;
  const { refs } = extractRefs(sense.replace(CLASSIFIER_PREFIX, ""));
  return refs;
}

export interface CleanSenses {
  senses: string[];
  classifiers: WordRef[];
  refs: WordRef[];
}

export function cleanSenses(raw: string[]): CleanSenses {
  const senses: string[] = [];
  const classifiers: WordRef[] = [];
  const refs: WordRef[] = [];
  for (const rawSense of raw) {
    const s = rawSense.normalize("NFC");
    const cl = parseClassifiers(s);
    if (cl) {
      classifiers.push(...cl);
      continue;
    }
    const r = extractRefs(s);
    senses.push(r.text);
    refs.push(...r.refs);
  }
  return { senses, classifiers, refs };
}

/** Same simp/trad/pinyin → one. */
export function dedupeRefs(refs: WordRef[]): WordRef[] {
  const seen = new Set<string>();
  return refs.filter((r) => {
    const k = `${r.simp}|${r.trad}|${r.pinyinNum ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
