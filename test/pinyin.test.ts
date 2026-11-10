import assert from "node:assert/strict";
import { test } from "node:test";
import { matchKey, syllableToMarks, toMarks, toPlain } from "../scripts/lib/pinyin.ts";

test("tone numbers to marks", () => {
  const cases: [string, string][] = [
    ["jue2", "jué"], ["hao3", "hǎo"], ["gui4", "guì"], ["xiu1", "xiū"], ["lu:4", "lǜ"], ["nu:3", "nǚ"],
    ["er2", "ér"], ["dou1", "dōu"], ["de5", "de"], ["r5", "r"], ["m2", "m"], ["xx5", "xx"], ["Bei3", "Běi"], ["Ou1", "Ōu"],
  ];
  for (const [num, marked] of cases) assert.equal(syllableToMarks(num), marked, num);
  assert.equal(toMarks("jue2 de5"), "jué de");
  assert.equal(toMarks("AA zhi4"), "AA zhì");
});

test("match key and plain pinyin", () => {
  assert.equal(matchKey("Lu:4 shi1"), "lv4shi1");
  assert.equal(matchKey("ba4 ba5"), matchKey("ba4ba"));
  assert.equal(toPlain("jué de"), "jue de");
  assert.equal(toPlain("lǜ"), "lu");
});
