import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import "../dist/director-contract.js";
const C = globalThis.MemoryContract;
test("warm, melancholic and energetic pages use different designs", () => {
  const inputs = [
    "Ура, у нас всё получилось, было здорово",
    "Грустно, плохо и не получилось",
    "Финиш после гонки",
  ];
  const styles = inputs.map((text) =>
    C.localMemory({ text, music: { kind: "link" } }),
  );
  assert.ok(styles.every(C.validMemory));
  assert.equal(new Set(styles.map((s) => s.layoutVariant)).size, 3);
  assert.equal(
    styles[0].atmosphere,
    C.localMemory({ text: inputs[0], music: { kind: "link" } }).atmosphere,
  );
  assert.equal(C.validMemory({ ...styles[0], title: "Слово" }), false);
  assert.equal(C.validMemory({ ...styles[0], energy: 101 }), false);
});
test("report covers exactly the real dates, ranks ties stably, averages all scores", () => {
  const dates = ["2026-01-02", "2026-01-01", "2026-01-03"];
  const days = dates.map((date, i) => ({
    date,
    score: i === 2 ? 0 : 100,
    reason: "Тон рассказа.",
  }));
  assert.ok(C.validMonth({ days, summary: "Месяц в записях." }, dates));
  assert.equal(
    C.validMonth({ days: [days[0], days[0], days[2]], summary: "Итог" }, dates),
    false,
  );
  assert.equal(
    C.validMonth({ days: days.slice(1), summary: "Итог" }, dates),
    false,
  );
  assert.equal(C.ranked(days).average, 66.7);
  assert.equal(C.ranked(days).best, "2026-01-01");
});
test("user palette wins and changed report inputs invalidate the cached report", () => {
  const ctx = vm.createContext({ MemoryContract: C });
  vm.runInContext(
    readFileSync(new URL("../dist/director-data.js", import.meta.url), "utf8"),
    ctx,
  );
  const generated = C.localMemory({ text: "Тихий вечер" }),
    evidence = { colors: ["#4080c0"] };
  const auto = ctx.directedStyle({ generated, evidence });
  assert.notEqual(auto.colorPalette[0], generated.colorPalette[0]);
  const overrides = {
    atmosphere: "energetic",
    colorPalette: ["#010203", "#234567", "#ffffff"],
    title: "Мой день",
  };
  const manual = ctx.directedStyle({ generated, evidence, overrides });
  assert.equal(manual.title, "Мой день");
  assert.equal(manual.layoutVariant, "contact");
  assert.deepEqual(manual.colorPalette, overrides.colorPalette);
  const first = [{ date: "2026-01-01", text: "Вечер" }],
    second = [{ ...first[0], text: "Утро" }];
  assert.notEqual(ctx.reportSignature(first), ctx.reportSignature(second));
});

test("keyword emotions: sad words win, joy words win, neutral text is random but valid", () => {
  assert.equal(C.localMemory({ text: "Было тяжело, не получилось" }).atmosphere, "sadness");
  assert.equal(C.localMemory({ text: "Ура, получилось!" }).atmosphere, "joy");
  const seen = new Set();
  for (let i = 0; i < 1500; i++) {
    const m = C.localMemory({ text: "Стол и стул" });
    assert.ok(C.validMemory(m));
    seen.add(m.atmosphere);
  }
  assert.ok(Object.keys(C.emotions).filter((k) => !["joy", "sadness", "energy"].includes(k)).every((k) => seen.has(k)));
  assert.ok(!seen.has("joy") && !seen.has("sadness") && !seen.has("energy"));
});

test("fifteen emotions, each with its own palette and valid texts", () => {
  const keys = Object.keys(C.emotions);
  assert.equal(keys.length, 15);
  assert.equal(new Set(keys.map((k) => C.emotions[k].colorPalette[0])).size, 15);
});
