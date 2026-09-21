import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { BOOKS, LESSONS, lessonById, lessonsForBook, pickLesson, type NudgeContext } from "./bookLibrary";
import { reflections, newGame } from "./quadrantGame/engine";

describe("book library", () => {
  it("has well over ten lessons, every book has some, and ids are unique", () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    for (const b of BOOKS) expect(lessonsForBook(b.key).length, b.title).toBeGreaterThan(0);
  });

  it("every lesson is complete and points at a book that exists", () => {
    const keys = new Set(BOOKS.map((b) => b.key));
    for (const l of LESSONS) {
      expect(keys.has(l.book), l.id).toBe(true);
      expect(l.title.length, l.id).toBeGreaterThan(3);
      expect(l.idea.length, l.id).toBeGreaterThan(40);
      expect(l.forYourBusiness.length, l.id).toBeGreaterThan(40);
      expect(l.tryIt.text.length, l.id).toBeGreaterThan(10);
      expect(l.contexts.length, l.id).toBeGreaterThan(0);
    }
  });

  it("every place that shows a nudge has at least one lesson to show", () => {
    const places: NudgeContext[] = ["dashboard", "billing", "crm", "wealth", "stock", "purchaseOrders", "team", "ai", "personal", "reports"];
    for (const c of places) expect(pickLesson(c, 0, new Set()), c).toBeDefined();
  });

  it("nudges rotate by day, prefer unread lessons, and fall back when all are read", () => {
    const pool = LESSONS.filter((l) => l.contexts.includes("wealth"));
    expect(pool.length).toBeGreaterThan(2);
    const seen = new Set(Array.from({ length: pool.length }, (_, d) => pickLesson("wealth", d, new Set())!.id));
    expect(seen.size).toBe(pool.length);
    const allButOne = new Set(pool.slice(1).map((l) => l.id));
    expect(pickLesson("wealth", 5, allButOne)!.id).toBe(pool[0].id);
    const everything = new Set(pool.map((l) => l.id));
    expect(pickLesson("wealth", 5, everything)).toBeDefined();
  });

  it("every lesson the game links to exists in the library", () => {
    for (const seed of [1, 2, 3]) {
      for (const status of ["won", "lost", "timeout"] as const) {
        const s = { ...newGame("trader", seed), status };
        for (const r of reflections(s)) expect(lessonById(r.lessonId), r.lessonId).toBeDefined();
      }
    }
  });

  it("every lesson id written in the game's source exists (covers endings a run may not hit)", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "quadrantGame/engine.ts"), "utf8");
    const ids = [...src.matchAll(/lessonId: "([a-z-]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(5);
    for (const id of ids) expect(lessonById(id), id).toBeDefined();
  });
});
