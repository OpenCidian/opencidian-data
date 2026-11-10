/** Pinyin with tone numbers (CEDICT style: "jue2 de5", "lu:4") → tone marks ("jué de", "lǜ"). */

const MARKS: Record<string, string[]> = {
  a: ["a", "ā", "á", "ǎ", "à"],
  e: ["e", "ē", "é", "ě", "è"],
  i: ["i", "ī", "í", "ǐ", "ì"],
  o: ["o", "ō", "ó", "ǒ", "ò"],
  u: ["u", "ū", "ú", "ǔ", "ù"],
  ü: ["ü", "ǖ", "ǘ", "ǚ", "ǜ"],
};

function markVowel(v: string, tone: number): string {
  const lower = v.toLowerCase();
  const marked = MARKS[lower]?.[tone] ?? v;
  return v === lower ? marked : marked.toUpperCase();
}

/** One syllable: "jue2" → "jué", "nu:3" → "nǚ", "r5" → "r", "xx5" → "xx". Anything else is returned as is. */
export function syllableToMarks(syl: string): string {
  const m = /^([A-Za-zü:]+?)([1-5])$/.exec(syl);
  if (!m) return syl.replace(/u:/g, "ü").replace(/U:/g, "Ü");
  const tone = Number(m[2]);
  const base = m[1]!.replace(/u:/g, "ü").replace(/U:/g, "Ü").replace(/v/g, "ü");
  if (tone === 5) return base;
  const lower = base.toLowerCase();
  // Rule: a or e takes the mark; in "ou" the o does; otherwise the last vowel.
  let idx = lower.search(/[ae]/);
  if (idx < 0) idx = lower.indexOf("ou");
  if (idx < 0) {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ("iouü".includes(lower[i]!)) { idx = i; break; }
    }
  }
  if (idx < 0) return base; // "m2", "ng2", "hm5": no vowel to mark
  return base.slice(0, idx) + markVowel(base[idx]!, tone) + base.slice(idx + 1);
}

/** A whole CEDICT pinyin string, syllables separated by spaces. */
export function toMarks(pinyinNum: string): string {
  return pinyinNum.split(" ").map(syllableToMarks).join(" ");
}

/** For matching across sources: lowercase, ü as v, no spaces, neutral tone 5 dropped. "Lu:4 shi1" → "lv4shi1". */
export function matchKey(pinyinNum: string): string {
  return pinyinNum.toLowerCase().replace(/u:|ü/g, "v").replace(/[\s·,]/g, "").replace(/5/g, "");
}

/** Tone marks and numbers removed, for search: "jué de" → "jue de". */
export function toPlain(pinyin: string): string {
  return pinyin.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[1-5]/g, "").replace(/u:/g, "u").normalize("NFC");
}
