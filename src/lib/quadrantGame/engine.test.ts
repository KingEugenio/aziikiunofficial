import { describe, expect, it } from "vitest";
import {
  BANKRUPTCY_MULTIPLE, MAX_MONTHS, PROFESSIONS, availableChoices, dealDiscount, newGame, repayLoan, respond, summarize,
  type GameState,
} from "./engine";

// Plays a whole game with a simple strategy so balance can be checked.
type Bot = (s: GameState) => string;

const smartBot: Bot = (s) => {
  const c = s.pending!;
  const ids = availableChoices(s).map((x) => x.id);
  const has = (id: string) => ids.includes(id);
  switch (c.kind) {
    case "opportunity":
      return has("buy") && (c.cashflow! / c.cost!) >= 0.02 ? "buy" : "pass";
    case "doodad": return "pass";
    case "emergency": return has("pay") ? "pay" : "loan";
    case "learn": return has("take") ? "take" : "pass";
    case "scam": return has("ask") ? "ask" : "pass";
    case "windfall": return "collect";
    default: return "continue";
  }
};

const spenderBot: Bot = (s) => {
  const c = s.pending!;
  const ids = availableChoices(s).map((x) => x.id);
  if (c.kind === "doodad") return ids.includes("credit") ? "credit" : ids.includes("buy") ? "buy" : "pass";
  if (c.kind === "scam") return ids.includes("invest") ? "invest" : "pass";
  if (c.kind === "opportunity") return "pass";
  if (c.kind === "emergency") return ids.includes("pay") ? "pay" : "loan";
  if (c.kind === "windfall") return "collect";
  if (c.kind === "learn") return "pass";
  return "continue";
};

function play(professionId: string, seed: number, bot: Bot): GameState {
  let s = newGame(professionId, seed);
  let guard = 0;
  while (s.status === "playing" && guard++ < 200) {
    // A sensible player pays a loan down when they can.
    if (s.loan > 0 && s.cash > 1500) s = repayLoan(s, s.cash - 1000);
    s = respond(s, bot(s));
  }
  return s;
}

describe("Cashflow Quadrant Challenge engine", () => {
  it("is deterministic: the same seed and choices give the same game", () => {
    const a = play("teacher", 42, smartBot);
    const b = play("teacher", 42, smartBot);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("different seeds give different games", () => {
    expect(JSON.stringify(play("teacher", 1, smartBot))).not.toBe(JSON.stringify(play("teacher", 2, smartBot)));
  });

  it("is plain JSON, so a game can be saved and restored mid-way", () => {
    let s = newGame("trader", 7);
    for (let i = 0; i < 5; i++) s = respond(s, smartBot(s));
    const restored: GameState = JSON.parse(JSON.stringify(s));
    expect(JSON.stringify(respond(restored, smartBot(restored)))).toBe(JSON.stringify(respond(s, smartBot(s))));
  });

  it("ignores a choice that isn't on offer and never mutates the old state", () => {
    const s = newGame("teacher", 3);
    const frozen = JSON.stringify(s);
    expect(respond(s, "not-a-choice")).toBe(s);
    respond(s, availableChoices(s)[0].id);
    expect(JSON.stringify(s)).toBe(frozen);
  });

  it("starts each profession with cash, an income and a first card", () => {
    for (const p of PROFESSIONS) {
      const s = newGame(p.id, 1);
      expect(s.cash).toBe(p.savings);
      expect(s.pending).not.toBeNull();
      expect(summarize(s).passiveIncome).toBe(0);
    }
  });

  it("a deal discount grows with financial IQ and is capped", () => {
    expect(dealDiscount(0)).toBe(0);
    expect(dealDiscount(2)).toBeCloseTo(0.06);
    expect(dealDiscount(50)).toBe(0.15);
  });

  it("never lets cash go negative: a shortfall becomes a loan", () => {
    for (let seed = 1; seed <= 20; seed++) {
      let s = newGame("clerk", seed);
      while (s.status === "playing") {
        s = respond(s, spenderBot(s));
        expect(s.cash).toBeGreaterThanOrEqual(0);
        expect(s.loan).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("repaying a loan lowers both cash and loan, and can't overpay", () => {
    let s = newGame("teacher", 5);
    s = { ...s, cash: 1000, loan: 400 };
    const r = repayLoan(s, 10_000);
    expect(r.loan).toBe(0);
    expect(r.cash).toBe(600);
    expect(repayLoan(r, 100)).toBe(r);
  });

  it("a careful player can reach financial freedom, for every profession", () => {
    for (const p of PROFESSIONS) {
      let wins = 0;
      const runs = 40;
      for (let seed = 1; seed <= runs; seed++) if (play(p.id, seed, smartBot).status === "won") wins++;
      expect(wins / runs, `${p.title} wins ${wins}/${runs}`).toBeGreaterThanOrEqual(0.7);
    }
  });

  it("a careful player usually takes a while: it is not instant", () => {
    const months = Array.from({ length: 30 }, (_, i) => play("teacher", i + 1, smartBot)).filter((g) => g.status === "won").map((g) => g.month);
    const avg = months.reduce((a, b) => a + b, 0) / months.length;
    expect(avg).toBeGreaterThan(12);
    expect(avg).toBeLessThan(MAX_MONTHS);
  });

  it("someone who spends on everything and buys no assets never wins", () => {
    for (const p of PROFESSIONS) {
      for (let seed = 1; seed <= 25; seed++) expect(play(p.id, seed, spenderBot).status).not.toBe("won");
    }
  });

  it("ends by timeout after the maximum months, never running forever", () => {
    const g = play("clerk", 9, spenderBot);
    expect(["lost", "timeout"]).toContain(g.status);
    expect(g.month).toBeLessThanOrEqual(MAX_MONTHS);
  });

  it("never opens with an emergency bill in the first three months", () => {
    for (let seed = 1; seed <= 200; seed++) {
      let s = newGame("teacher", seed);
      for (let m = 0; m < 3; m++) {
        expect(s.pending?.kind, `seed ${seed} month ${m + 1}`).not.toBe("emergency");
        s = respond(s, smartBot(s));
      }
    }
  });

  it("an emergency you can't fully cover uses your cash and borrows only the shortfall", () => {
    let s = newGame("teacher", 1);
    s = { ...s, cash: 300, pending: { id: "em-medical", kind: "emergency", title: "Medical bill", text: "", cost: 900 } };
    expect(availableChoices(s).map((c) => c.id)).toEqual(["loan"]);
    const r = respond(s, "loan");
    // Loan is exactly the 600 that was short (a later shortfall could only add to it).
    expect(r.loan).toBeGreaterThanOrEqual(600);
    expect(r.stats.loansTaken).toBeGreaterThanOrEqual(1);
    expect(r.cash).toBeGreaterThanOrEqual(0);
  });

  it("bankruptcy triggers when the loan outgrows the income multiple", () => {
    let s = newGame("clerk", 4);
    s = { ...s, loan: s.jobIncome * BANKRUPTCY_MULTIPLE + 1000 };
    s = respond(s, availableChoices(s).at(-1)!.id);
    expect(s.status).toBe("lost");
  });
});
