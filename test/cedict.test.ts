import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanSenses, entryId, extractRefs, parseLine } from "../scripts/lib/cedict.ts";

test("parses a CEDICT line", () => {
  const l = parseLine("覺 觉 [jiao4] /a nap/a sleep/CL:場|场[chang2]/")!;
  assert.deepEqual(l, { trad: "覺", simp: "觉", pinyinNum: "jiao4", senses: ["a nap", "a sleep", "CL:場|场[chang2]"] });
  assert.equal(entryId(l), "觉|覺|jiao4");
  assert.equal(parseLine("# comment"), null);
  assert.equal(parseLine("澳洲廣播電臺 澳洲广播电台 [[Ao4 zhou1] ] /x/"), null);
});

test("classifiers move out of the senses (CEDICT CL: and CVDICT LT:)", () => {
  const en = cleanSenses(["a nap", "CL:場|场[chang2],個|个[ge4]"]);
  assert.deepEqual(en.senses, ["a nap"]);
  assert.deepEqual(en.classifiers.map((c) => `${c.simp} ${c.pinyin}`), ["场 cháng", "个 gè"]);
  const vi = cleanSenses(["một giấc ngủ ngắn", "LT:場|场[chang2]"]);
  assert.deepEqual(vi.senses, ["một giấc ngủ ngắn"]);
  assert.equal(vi.classifiers[0]!.simp, "场");
});

test("references become readable text and a structured list", () => {
  const r = extractRefs("biến thể của 覺|觉[jue2]");
  assert.equal(r.text, "biến thể của 觉 (jué)");
  assert.deepEqual(r.refs, [{ simp: "觉", trad: "覺", pinyin: "jué", pinyinNum: "jue2" }]);
  assert.equal(extractRefs("see 七臺河市|七台河市[Qi1 tai2 he2 Shi4]").text, "see 七台河市 (Qī tái hé Shì)");
  assert.equal(extractRefs("also pr. [pou1]").text, "also pr. pōu");
  // A Han word with no "|" and no pinyin is plain text.
  assert.deepEqual(extractRefs("quận của 重庆").refs, []);
});
