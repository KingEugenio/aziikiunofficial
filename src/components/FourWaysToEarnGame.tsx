import React, { useEffect, useMemo, useState } from "react";
import { GameController, Briefcase, Wrench, Buildings, ChartLineUp, Trophy, Warning, ArrowClockwise, BookOpen, Lightbulb, ClockCountdown } from "@phosphor-icons/react";
import {
  MAX_MONTHS, PROFESSIONS, availableChoices, newGame, professionOf, reflections, repayLoan, respond, summarize,
  type GameState, type Quadrant,
} from "../lib/quadrantGame/engine";
import { lessonById } from "../lib/bookLibrary";

interface FourWaysToEarnGameProps {
  currencySymbol: string;
  /** Opens a lesson in the Book Library (Reports & Wisdom). */
  onOpenLesson?: (lessonId: string) => void;
}

const SAVE_KEY = "aziiki_four_ways_game_v1";
const BEST_KEY = "aziiki_four_ways_game_best_v1";

function loadSaved(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw);
    return g && g.version === 1 && typeof g.status === "string" && Array.isArray(g.holdings) ? (g as GameState) : null;
  } catch {
    return null;
  }
}

function save(game: GameState | null) {
  try {
    if (game) localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be blocked; the game still works, it just won't be remembered.
  }
}

function loadBest(): number | null {
  try {
    const n = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

const QUADRANTS: Array<{ id: Quadrant; name: string; blurb: string; Icon: React.ElementType; tint: string }> = [
  { id: "E", name: "Employee", blurb: "You work for a boss", Icon: Briefcase, tint: "bg-slate-50 border-slate-200 text-slate-700" },
  { id: "B", name: "Business owner", blurb: "A system works for you", Icon: Buildings, tint: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  { id: "S", name: "Self-employed", blurb: "You are the business", Icon: Wrench, tint: "bg-slate-50 border-slate-200 text-slate-700" },
  { id: "I", name: "Investor", blurb: "Your money works for you", Icon: ChartLineUp, tint: "bg-emerald-50 border-emerald-200 text-emerald-800" },
];

const seedNow = () => (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) | 0;

export default function FourWaysToEarnGame({ currencySymbol, onOpenLesson }: FourWaysToEarnGameProps) {
  const [game, setGame] = useState<GameState | null>(() => loadSaved());
  const [best, setBest] = useState<number | null>(() => loadBest());
  const [tab, setTab] = useState<"income" | "balance" | "log">("income");

  useEffect(() => save(game), [game]);

  const fmt = (n: number) => `${currencySymbol}${Math.round(n).toLocaleString()}`;

  // Remember the fastest win.
  useEffect(() => {
    if (game?.status === "won" && (best === null || game.month < best)) {
      setBest(game.month);
      try {
        localStorage.setItem(BEST_KEY, String(game.month));
      } catch {
        // Not remembering a best time is harmless.
      }
    }
  }, [game?.status, game?.month, best]);

  const summary = useMemo(() => (game ? summarize(game) : null), [game]);
  const choices = useMemo(() => (game ? availableChoices(game) : []), [game]);

  // ─── Start screen ────────────────────────────────────────────────────────
  if (!game || !summary) {
    return (
      <div className="space-y-5 text-left" id="four-ways-game">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <GameController className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 font-sans">Four Ways to Earn</h2>
              <p className="text-xs text-slate-500 font-sans mt-0.5 leading-relaxed">
                A money game about the four ways people earn, and how to reach the point where your assets pay your bills.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {QUADRANTS.map(({ id, name, blurb, Icon, tint }) => (
              <div key={id} className={`rounded-2xl border p-3.5 ${tint}`}>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="sr-only">{name}</span>
                </div>
                <p className="text-xs font-bold mt-1.5">{name}</p>
                <p className="text-[11px] opacity-80 leading-snug mt-0.5">{blurb}</p>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1.5">
            <p className="text-xs font-bold text-slate-800">How to win</p>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Each turn is one month. You'll be offered businesses and investments to buy, tempting things to spend on, and surprises. Build monthly income from assets
              (the right-hand side: businesses you own and investments) until it's bigger than your monthly expenses. You have {MAX_MONTHS} months.
            </p>
          </div>

          <div>
            <p className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest mb-2">Choose who you start as</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PROFESSIONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setTab("income");
                    setGame(newGame(p.id, seedNow()));
                  }}
                  className="text-left bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-2xl p-4 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900">{p.title}</span>
                    <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 rounded-md px-1.5 py-0.5">{p.quadrant === "E" ? "Employee" : "Self-employed"}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">{p.blurb}</p>
                  <p className="text-[11px] font-mono text-slate-600 mt-2">
                    Earns {fmt(p.income)} · Spends {fmt(p.expenses)} · Saved {fmt(p.savings)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {best !== null && (
            <p className="text-[11px] font-mono text-emerald-700 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Your fastest win: {best} months
            </p>
          )}

          <p className="text-[10px] text-slate-400 leading-relaxed">
            An original Aziiki learning game. The idea that people earn in four different ways is explored in several popular money books, which you can read about in the Book Library. This game
            isn't based on, and isn't affiliated with or endorsed by, any author, publisher or board game. All amounts are practice money in {currencySymbol} and have no link to your real books. It's for learning, not financial advice.
          </p>
        </div>
      </div>
    );
  }

  const p = professionOf(game);
  const over = game.status !== "playing";
  const freedomPct = Math.min(100, Math.round(summary.freedom * 100));
  const card = game.pending;

  const badge: Record<string, string> = {
    opportunity: "bg-emerald-50 text-emerald-700 border-emerald-200",
    splurge: "bg-rose-50 text-rose-700 border-rose-200",
    emergency: "bg-amber-50 text-amber-700 border-amber-200",
    learn: "bg-indigo-50 text-indigo-700 border-indigo-200",
    windfall: "bg-emerald-50 text-emerald-700 border-emerald-200",
    scam: "bg-rose-50 text-rose-700 border-rose-200",
    illness: "bg-amber-50 text-amber-700 border-amber-200",
    raise: "bg-emerald-50 text-emerald-700 border-emerald-200",
    setback: "bg-amber-50 text-amber-700 border-amber-200",
  };
  const badgeLabel: Record<string, string> = {
    opportunity: "Opportunity", splurge: "Temptation", emergency: "Emergency", learn: "Learning", windfall: "Windfall",
    scam: "Too good to be true?", illness: "Bad luck", raise: "Good news", setback: "Setback",
  };
  const choiceClass = (tone?: string) =>
    tone === "primary"
      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
      : tone === "danger"
      ? "bg-white hover:bg-rose-50 text-rose-700 border border-rose-200"
      : "bg-slate-100 hover:bg-slate-200 text-slate-700";

  return (
    <div className="space-y-4 text-left" id="four-ways-game">
      {/* Header + numbers */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <GameController className="w-5 h-5 text-emerald-700 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-black text-slate-900 truncate">Four Ways to Earn</h2>
              <p className="text-[11px] text-slate-500">{p.title} · practice money</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (over || window.confirm("Start over? This game's progress will be lost.")) setGame(null);
            }}
            className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer shrink-0"
          >
            <ArrowClockwise className="w-3.5 h-3.5" /> New game
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: "Month", value: `${game.month} / ${MAX_MONTHS}`, icon: <ClockCountdown className="w-3.5 h-3.5" /> },
            { label: "Cash", value: fmt(game.cash) },
            { label: "Loans", value: fmt(game.loan), warn: game.loan > 0 },
            { label: "Money smarts", value: `${game.smarts}`, hint: summary.discount > 0 ? `${Math.round(summary.discount * 100)}% off deals` : "learn to get better deals" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-3 ${s.warn ? "bg-rose-50 border-rose-200" : "bg-slate-50 border-slate-200"}`}>
              <p className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-wider flex items-center gap-1">{s.icon}{s.label}</p>
              <p className={`text-sm font-black mt-0.5 ${s.warn ? "text-rose-700" : "text-slate-900"}`}>{s.value}</p>
              {"hint" in s && s.hint && <p className="text-[10px] text-slate-400 mt-0.5">{s.hint}</p>}
            </div>
          ))}
        </div>

        {/* Freedom meter */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-sans mb-1.5">
            <span className="font-bold text-slate-700">Freedom meter</span>
            <span className="font-mono text-slate-500">
              {fmt(summary.passiveIncome)} from assets / {fmt(summary.totalExpenses)} expenses
            </span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={freedomPct} aria-valuemin={0} aria-valuemax={100} aria-label="Financial freedom progress">
            <div className={`h-full rounded-full transition-all duration-500 ${freedomPct >= 100 ? "bg-emerald-600" : "bg-emerald-500"}`} style={{ width: `${freedomPct}%` }} />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">You're free when this reaches 100%: your assets pay all your bills without you working.</p>
        </div>
      </div>

      {/* Quadrant board */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest">Where your monthly income comes from</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {QUADRANTS.map(({ id, name, Icon, tint }) => {
            const amount = summary.byQuadrant[id];
            const mine = id === p.quadrant;
            return (
              <div key={id} className={`rounded-2xl border p-3.5 ${tint} ${amount > 0 ? "" : "opacity-60"}`}>
                <div className="flex items-center gap-1.5">
                  <Icon className="w-4 h-4" />
                  <span className="sr-only">{name}</span>
                  {mine && <span className="text-[9px] font-bold bg-white/70 rounded px-1">you</span>}
                </div>
                <p className="text-[11px] font-bold mt-1">{name}</p>
                <p className="text-sm font-black mt-1">{fmt(amount)}<span className="text-[10px] font-normal opacity-70"> /month</span></p>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2.5 mt-2 text-[10px] font-mono text-slate-400 text-center">
          <span>Left: you work for money</span>
          <span>Right: money works for you</span>
        </div>
      </div>

      {/* The card, or the ending */}
      {!over && card ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-[10px] font-mono font-black uppercase tracking-wider border rounded-md px-2 py-0.5 ${badge[card.kind]}`}>{badgeLabel[card.kind]}</span>
            <span className="text-[10px] font-mono text-slate-400">Month {game.month + 1}</span>
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">{card.title}</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{card.text}</p>
          </div>
          {card.kind === "opportunity" && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 rounded-xl p-2.5"><p className="text-[9px] font-mono text-slate-400 uppercase">Costs</p><p className="text-xs font-black text-slate-900">{fmt(card.cost ?? 0)}</p></div>
              <div className="bg-emerald-50 rounded-xl p-2.5"><p className="text-[9px] font-mono text-emerald-700 uppercase">Pays you</p><p className="text-xs font-black text-emerald-800">{fmt(card.cashflow ?? 0)}/mo</p></div>
              <div className="bg-slate-50 rounded-xl p-2.5"><p className="text-[9px] font-mono text-slate-400 uppercase">Type</p><p className="text-xs font-black text-slate-900">{card.quadrant === "B" ? "Business" : "Investment"}</p></div>
            </div>
          )}
          {card.kind === "splurge" && (
            <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" /> Ask: does this put money into my pocket, or take it out?</p>
          )}
          {card.kind === "scam" && (
            <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Warning className="w-3.5 h-3.5 text-rose-500 shrink-0" /> Ask how it makes money, and who has done it before.</p>
          )}
          <div className="flex flex-col gap-2 pt-1">
            {choices.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setGame(respond(game, c.id))}
                className={`w-full text-left text-xs font-bold px-4 py-3 rounded-xl transition-colors cursor-pointer ${choiceClass(c.tone)}`}
              >
                {c.label}
                {c.hint && <span className="block text-[10px] font-normal opacity-70 mt-0.5">{c.hint}</span>}
              </button>
            ))}
          </div>
          {game.loan > 0 && game.cash > 0 && (
            <button
              type="button"
              onClick={() => setGame(repayLoan(game, game.cash))}
              className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
            >
              Repay {fmt(Math.min(game.cash, game.loan))} of your loan first
            </button>
          )}
        </div>
      ) : (
        <div className={`rounded-3xl p-5 shadow-sm space-y-4 border ${game.status === "won" ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}>
          <div className="flex items-start gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${game.status === "won" ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-700"}`}>
              {game.status === "won" ? <Trophy className="w-6 h-6" /> : <Warning className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {game.status === "won" ? "You're financially free!" : game.status === "lost" ? "Debt got the better of you" : "Time's up"}
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {game.status === "won"
                  ? `It took ${game.month} months. Your assets now pay more than everything you spend.`
                  : game.status === "lost"
                  ? "Your loans grew larger than your income could carry. Here's what to change next time."
                  : `After ${MAX_MONTHS} months your assets covered ${Math.round(summary.freedom * 100)}% of your expenses. Here's what to change next time.`}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest">What this game shows</p>
            {reflections(game).map((r, i) => {
              const lesson = lessonById(r.lessonId);
              return (
                <div key={i} className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-1.5">
                  <p className="text-xs text-slate-700 leading-relaxed">{r.text}</p>
                  {lesson && onOpenLesson && (
                    <button type="button" onClick={() => onOpenLesson(lesson.id)} className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer">
                      <BookOpen className="w-3.5 h-3.5" /> Read: {lesson.title}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setTab("income"); setGame(newGame(game.professionId, seedNow())); }} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer">
              Play again as {p.title}
            </button>
            <button type="button" onClick={() => setGame(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer">
              Choose someone else
            </button>
          </div>
        </div>
      )}

      {/* Statements */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        <div className="flex gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 mb-4" role="tablist">
          {([["income", "Income & expenses"], ["balance", "Assets & debts"], ["log", "What happened"]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex-1 py-2 text-[11px] font-bold rounded-lg cursor-pointer transition-colors ${tab === id ? "bg-emerald-600 text-white" : "text-slate-500 hover:text-slate-700"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "income" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono font-bold text-emerald-700 uppercase tracking-wider">Money coming in</p>
              <Row label={`${p.title} pay`} value={fmt(summary.earnedIncome)} />
              {game.holdings.length === 0 && <p className="text-[11px] text-slate-400">No assets yet</p>}
              {game.holdings.map((h) => (
                <Row key={h.uid} label={`${h.name} (${h.quadrant === "B" ? "business" : "investment"})`} value={fmt(h.cashflow)} />
              ))}
              <Row label="Total in" value={fmt(summary.totalIncome)} strong />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono font-bold text-rose-700 uppercase tracking-wider">Money going out</p>
              <Row label="Living costs" value={fmt(summary.living)} />
              {game.liabilities.map((l) => (
                <Row key={l.uid} label={`${l.name} (${l.monthsLeft} mo left)`} value={fmt(l.monthly)} />
              ))}
              {summary.loanInterest > 0 && <Row label="Loan interest" value={fmt(summary.loanInterest)} />}
              <Row label="Total out" value={fmt(summary.totalExpenses)} strong />
              <div className={`mt-2 rounded-xl px-3 py-2 font-bold ${summary.netCashflow >= 0 ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                Left each month: {fmt(summary.netCashflow)}
              </div>
            </div>
          </div>
        )}

        {tab === "balance" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono font-bold text-emerald-700 uppercase tracking-wider">Assets (they pay you)</p>
              <Row label="Cash" value={fmt(game.cash)} />
              {game.holdings.map((h) => (
                <Row key={h.uid} label={h.name} value={fmt(h.cost)} />
              ))}
              <Row label="Total assets" value={fmt(summary.assetsTotal)} strong />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono font-bold text-rose-700 uppercase tracking-wider">Debts (you pay them)</p>
              {game.loan > 0 && <Row label="Loan" value={fmt(game.loan)} />}
              {game.liabilities.map((l) => (
                <Row key={l.uid} label={l.name} value={fmt(l.monthly * l.monthsLeft)} />
              ))}
              {game.loan === 0 && game.liabilities.length === 0 && <p className="text-[11px] text-slate-400">No debts</p>}
              <Row label="Total debts" value={fmt(summary.liabilitiesTotal)} strong />
            </div>
          </div>
        )}

        {tab === "log" && (
          <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {[...game.log].reverse().map((l, i) => (
              <li key={i} className={`text-[11px] leading-relaxed rounded-xl px-3 py-2 border ${l.tone === "good" ? "bg-emerald-50/60 border-emerald-100 text-emerald-900" : l.tone === "bad" ? "bg-rose-50/60 border-rose-100 text-rose-900" : "bg-slate-50 border-slate-100 text-slate-700"}`}>
                <span className="font-mono text-[10px] opacity-60 mr-1.5">M{l.month}</span>{l.text}
              </li>
            ))}
            {game.log.length === 0 && <li className="text-[11px] text-slate-400">Nothing yet. Make your first choice above.</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? "border-t border-slate-200 pt-1.5 mt-1 font-black text-slate-900" : "text-slate-600"}`}>
      <span className="truncate">{label}</span>
      <span className="font-mono shrink-0">{value}</span>
    </div>
  );
}
