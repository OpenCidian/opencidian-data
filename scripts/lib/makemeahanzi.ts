/** Make Me a Hanzi's dictionary.txt: one JSON object per line. */

export interface MmahChar {
  character: string;
  definition?: string;
  pinyin: string[];
  decomposition: string;
  radical: string;
  etymology?: { type: "ideographic" | "pictographic" | "pictophonetic"; hint?: string; semantic?: string; phonetic?: string };
}

export function parseMakemeahanzi(text: string): Map<string, MmahChar> {
  const out = new Map<string, MmahChar>();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const c = JSON.parse(line) as MmahChar;
    out.set(c.character, c);
  }
  return out;
}
