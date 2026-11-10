/** Builds from the pinned sources (run npm run fetch-sources first; CI does). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, test } from "node:test";
import { build, loadSources, type BuildResult } from "../scripts/lib/build.ts";
import { compare, EXPLAINED, HV_EXPLAINED, type HchWord } from "../scripts/lib/compare.ts";
import { loadCorrections } from "../scripts/lib/corrections.ts";
import type { Entry } from "../scripts/lib/model.ts";

let r: BuildResult;
let src: ReturnType<typeof loadSources>;
const entry = (id: string): Entry => {
  const e = r.entries.find((x) => x.id === id);
  assert.ok(e, `${id} is missing`);
  return e;
};

before(() => {
  src = loadSources();
  r = build(src, loadCorrections().corrections);
});

test("a word gets Hán Việt for every character, Vietnamese, English, HSK", () => {
  const e = entry("觉得|覺得|jue2 de5");
  assert.equal(e.pinyin, "jué de");
  assert.deepEqual(e.hanviet.map((h) => h.readings[0]), ["giác", "đắc"]);
  assert.equal(e.vi?.src, "cvdict");
  assert.ok(e.vi!.senses.some((s) => s.includes("cảm thấy")));
  assert.ok(e.en.senses.includes("to feel (uncomfortable etc)"));
  assert.ok(e.hsk?.hsk2);
});

test("Hán Việt is per character, the same for both pronunciations of 觉", () => {
  assert.equal(entry("觉|覺|jiao4").hanviet[0]!.readings[0], "giác");
  assert.equal(entry("觉|覺|jue2").hanviet[0]!.readings[0], "giác");
});

test("common characters Unihan lacks get Thiều Chửu readings, through the traditional form when needed", () => {
  const hv = (ch: string) => r.chars.find((c) => c.char === ch)?.hanviet;
  assert.deepEqual(hv("父")?.readings.slice(0, 1), ["phụ"]);
  assert.equal(hv("电")?.readings[0], "điện");
  assert.equal(hv("这")?.readings[0], "giá");
  assert.equal(hv("细")?.readings[0], "tế", "Thiều Chửu over Unihan's Nôm reading (tới)");
  assert.equal(hv("值")?.via, "値", "glyph variant");
});

test("a correction is applied and marked", () => {
  const ban = r.chars.find((c) => c.char === "办")!;
  assert.deepEqual(ban.hanviet, { readings: ["biện", "bạn"], src: "correction" });
  const e = entry("办法|辦法|ban4 fa3");
  assert.equal(e.hanviet[0]!.src, "correction");
  assert.deepEqual(e.corrected, ["hanviet.0.readings"]);
  assert.ok(r.report.corrections.every((o) => o.status === "applied"));
});

test("classifiers are structured, not left in the Vietnamese", () => {
  const e = entry("觉|覺|jiao4");
  assert.deepEqual(e.classifiers?.items.map((c) => c.simp), ["场"]);
  assert.ok(!e.vi!.senses.some((s) => s.includes("LT:")));
});

test("coverage does not regress", () => {
  assert.ok(r.report.withVi / r.report.entries > 0.94, "Vietnamese meaning for > 94% of entries");
  assert.ok(r.report.withHanvietAllChars / r.report.entries > 0.95, "Hán Việt for every character in > 95% of entries");
});

test("every difference from hieu-chu-han's dictionary.json (sample) is explained", () => {
  const sample = JSON.parse(readFileSync(new URL("./fixtures/hieu-chu-han-sample.json", import.meta.url), "utf8")) as HchWord[];
  const { rows, hanviet } = compare(sample, r.entries, src.cvdict);
  const bad = rows.filter((x) => !(x.kind in EXPLAINED));
  assert.deepEqual(bad.map((x) => `${x.word.s} [${x.word.pt}] ${x.kind}`), []);
  const badHv = Object.keys(hanviet).filter((k) => !(k in HV_EXPLAINED));
  assert.deepEqual(badHv, [], "Hán Việt: hieu-chu-han had a reading OpenCidian lacks, or a difference with no explanation");
});
