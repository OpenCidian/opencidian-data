import assert from "node:assert/strict";
import { test } from "node:test";
import { applyOp, loadCorrections } from "../scripts/lib/corrections.ts";
import { Correction } from "../scripts/lib/model.ts";

const base = { reason: "r", evidence: "e", by: "x", date: "2026-11-10" };

test("set / add / remove, and no-op detection", () => {
  const c = (o: object) => Correction.parse({ target: { char: "办" }, field: "hanviet.readings", ...o, ...base });
  assert.deepEqual(applyOp(["bạn", "biện"], c({ set: ["biện", "bạn"] })), { value: ["biện", "bạn"], changed: true });
  assert.deepEqual(applyOp(["bạn"], c({ add: ["bạn"] })), { value: ["bạn"], changed: false });
  assert.deepEqual(applyOp(["bạn", "biện"], c({ remove: ["bạn"] })), { value: ["biện"], changed: true });
});

test("the correction schema", () => {
  const ok = (o: object) => Correction.safeParse({ ...base, ...o }).success;
  assert.ok(ok({ target: { char: "说" }, field: "hanviet.readings", set: ["thuyết"] }));
  assert.ok(ok({ target: { entry: "觉|覺|jiao4" }, field: "hanviet.0.readings", set: ["giác"] }));
  assert.ok(ok({ target: { entry: "觉|覺|jiao4" }, field: "vi.senses", add: ["giấc ngủ"] }));
  assert.ok(!ok({ target: { char: "说" }, field: "hanviet.readings" }), "needs one operation");
  assert.ok(!ok({ target: { char: "说" }, field: "hanviet.readings", set: ["a"], add: ["b"] }), "only one operation");
  assert.ok(!ok({ target: { char: "说" }, field: "vi.senses", set: ["a"] }), "a char target only takes hanviet.readings");
  assert.ok(!ok({ target: { char: "说话" }, field: "hanviet.readings", set: ["a"] }), "one character");
  assert.ok(!ok({ target: { char: "说" }, field: "hanviet.readings", set: ["a"], extra: 1 }), "no unknown keys");
});

test("every correction file in the repo loads", () => {
  const { errors } = loadCorrections();
  assert.deepEqual(errors, []);
});
