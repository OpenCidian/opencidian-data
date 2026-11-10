/** The HSK word lists (complete-hsk-vocabulary, complete.min.json). Only levels are used. */

interface HskWordRaw {
  s: string; // simplified
  l: string[]; // levels: o1..o6 (HSK 2.0), n1..n7 (HSK 3.0; n7 = levels 7-9), t* (undocumented, not used)
  f: { t: string; i: { n: string } }[]; // forms: traditional, numeric pinyin
}

export interface HskWord {
  simp: string;
  forms: { trad: string; pinyinNum: string }[];
  hsk2?: number;
  hsk3?: number;
}

export function parseHsk(text: string): HskWord[] {
  const raw = JSON.parse(text) as HskWordRaw[];
  return raw.map((w) => {
    const lv = (prefix: string) => {
      const levels = w.l.filter((l) => l.startsWith(prefix)).map((l) => Number(l.slice(1)));
      return levels.length ? Math.min(...levels) : undefined;
    };
    const word: HskWord = { simp: w.s, forms: w.f.map((f) => ({ trad: f.t, pinyinNum: f.i.n })) };
    const h2 = lv("o");
    const h3 = lv("n");
    if (h2 !== undefined) word.hsk2 = h2;
    if (h3 !== undefined) word.hsk3 = h3;
    return word;
  });
}
