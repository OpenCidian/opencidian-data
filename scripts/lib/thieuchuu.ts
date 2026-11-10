/** Thiều Chửu's Hán Việt tự điển as a tab file: "父\tphụ|phủ<br>1. Cha, bố. …". Only the readings are used. */
import { HANVIET_SYLLABLE } from "./model.ts";

export function parseThieuChuu(text: string): { readings: Map<string, string[]>; bad: string[] } {
  const readings = new Map<string, string[]>();
  const bad: string[] = [];
  for (const line of text.split("\n")) {
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const head = line.slice(0, tab).trim();
    const field = line.slice(tab + 1).split("<br>")[0]!;
    const list: string[] = [];
    for (const raw of field.split("|")) {
      // Drop a stroke-count note ("việt (13 n)") and stray punctuation.
      const r = raw.normalize("NFC").replace(/\(\d+ n\)/, "").replace(/[.,;]/g, "").trim().toLowerCase();
      if (!r) continue;
      if (HANVIET_SYLLABLE.test(r)) { if (!list.includes(r)) list.push(r); }
      else bad.push(`${head} ${raw}`);
    }
    if (list.length) readings.set(head, list);
  }
  return { readings, bad };
}
