// Four Ways to Earn: a single-player money game, one month per turn. It is an
// original Aziiki learning game. The idea it teaches (people earn as an
// employee, on their own account, as the owner of a business, or as an
// investor, and you are financially free when income from assets covers your
// expenses) is a general money-education idea explored in several books; the
// rules, cards, names and numbers here are all Aziiki's own. It is not based on
// any board game and uses no one's brand names, card names or artwork.
//
// Everything here is pure: the same seed and the same choices always give the
// same game, and a game state is plain JSON so it can be saved and restored.
// The money is practice money - nothing here touches a real ledger.

export type Quadrant = "E" | "S" | "B" | "I";

export interface Profession {
  id: string;
  title: string;
  quadrant: "E" | "S";
  income: number;
  expenses: number;
  savings: number;
  blurb: string;
}

export const PROFESSIONS: Profession[] = [
  { id: "teacher", title: "Teacher", quadrant: "E", income: 2400, expenses: 1750, savings: 800, blurb: "Steady salary, steady bills. Sick days are paid." },
  { id: "clerk", title: "Office clerk", quadrant: "E", income: 2000, expenses: 1500, savings: 600, blurb: "A smaller salary, but lower costs. Slow, reliable raises." },
  { id: "trader", title: "Market trader", quadrant: "S", income: 3000, expenses: 2100, savings: 1200, blurb: "Bigger income, but it stops the day you can't work." },
  { id: "tailor", title: "Tailor", quadrant: "S", income: 2800, expenses: 2000, savings: 1000, blurb: "You earn what you sew. No work means no pay." },
];

export const MAX_MONTHS = 60;
export const LOAN_RATE = 0.03; // per month
/** A loan bigger than this many months of job income ends the game. */
export const BANKRUPTCY_MULTIPLE = 8;
const IQ_DISCOUNT_PER_POINT = 0.03;
const IQ_DISCOUNT_CAP = 0.15;

export type CardKind = "opportunity" | "splurge" | "emergency" | "learn" | "windfall" | "scam" | "illness" | "raise" | "setback";

export interface Card {
  id: string;
  kind: CardKind;
  title: string;
  text: string;
  /** What it costs now (opportunity cost is already after any deal discount). */
  cost?: number;
  /** Monthly cash it pays (opportunity). */
  cashflow?: number;
  quadrant?: "B" | "I";
  /** Monthly payment and length if bought on credit (splurge). */
  creditMonthly?: number;
  creditMonths?: number;
  /** Learn cards. */
  incomeBoost?: number;
  smarts?: number;
  /** Windfall amount. */
  amount?: number;
}

export interface Holding {
  uid: number;
  name: string;
  quadrant: "B" | "I";
  cost: number;
  cashflow: number;
}

export interface Liability {
  uid: number;
  name: string;
  monthly: number;
  monthsLeft: number;
}

export type Tone = "good" | "bad" | "info";
export interface LogEntry {
  month: number;
  text: string;
  tone: Tone;
}

export interface Stats {
  assetsBought: number;
  splurgesBought: number;
  splurgesSkipped: number;
  scamsLost: number;
  scamsAvoided: number;
  loansTaken: number;
  coursesTaken: number;
}

export type Status = "playing" | "won" | "lost" | "timeout";

export interface GameState {
  version: 1;
  professionId: string;
  month: number;
  cash: number;
  jobIncome: number;
  livingExpenses: number;
  smarts: number;
  holdings: Holding[];
  liabilities: Liability[];
  loan: number;
  rng: number;
  nextUid: number;
  pending: Card | null;
  lastCardId: string | null;
  sickThisMonth: boolean;
  status: Status;
  log: LogEntry[];
  stats: Stats;
}

// ─── Cards ─────────────────────────────────────────────────────────────────
// Costs and cashflows are in practice money. Businesses (B) pay far more per
// unit than investments (I) but carry setbacks; investments are slower and
// steadier. Both are here on purpose: a mix is the lesson.
interface OpportunityDef { id: string; title: string; text: string; cost: number; cashflow: number; quadrant: "B" | "I" }

const OPPORTUNITIES: OpportunityDef[] = [
  { id: "op-kiosk", title: "Kiosk stake", text: "A neighbour is selling a 30% share of a busy kiosk. It pays its owners every month.", cost: 3000, cashflow: 215, quadrant: "B" },
  { id: "op-momo", title: "Mobile money booth", text: "Set up a small mobile money agent booth on a busy road. A manager runs it for you.", cost: 2500, cashflow: 170, quadrant: "B" },
  { id: "op-laundry", title: "Laundry business", text: "A working laundry is for sale, with staff and regular customers.", cost: 4500, cashflow: 330, quadrant: "B" },
  { id: "op-poultry", title: "Poultry farm share", text: "Join a small poultry farm as a co-owner. Sales come in every month.", cost: 5000, cashflow: 370, quadrant: "B" },
  { id: "op-print", title: "Print shop", text: "A print shop with loyal customers is looking for a new owner.", cost: 6000, cashflow: 440, quadrant: "B" },
  { id: "op-tbills", title: "Treasury bills", text: "Lend to the government for a fixed period. Very safe, and the return is small.", cost: 2000, cashflow: 40, quadrant: "I" },
  { id: "op-fund", title: "Dividend fund", text: "A fund that shares the profits of many companies. Steady, with ups and downs in price.", cost: 3500, cashflow: 80, quadrant: "I" },
  { id: "op-room", title: "Rental room", text: "Buy a room in a busy area and rent it out to a tenant.", cost: 6000, cashflow: 230, quadrant: "I" },
  { id: "op-land", title: "Land lease", text: "Buy a plot and lease it to a farmer for a fixed monthly fee.", cost: 8000, cashflow: 290, quadrant: "I" },
];

interface SplurgeDef { id: string; title: string; text: string; cost: number; creditMonthly?: number; creditMonths?: number }

const SPLURGES: SplurgeDef[] = [
  { id: "sp-phone", title: "The newest phone", text: "Everyone has the latest model. Yours works fine, but this one has a better camera.", cost: 900, creditMonthly: 80, creditMonths: 12 },
  { id: "sp-car", title: "Nicer car on finance", text: "Your car runs, but a newer one would look better outside the office.", cost: 6000, creditMonthly: 260, creditMonths: 30 },
  { id: "sp-clothes", title: "Designer outfit", text: "A sale on expensive clothes you don't need.", cost: 450 },
  { id: "sp-party", title: "Lavish family event", text: "Relatives expect a big celebration, and you'd like to impress them.", cost: 1600 },
  { id: "sp-tv", title: "Giant TV on credit", text: "A bigger screen, with small monthly payments and no money down.", cost: 1400, creditMonthly: 90, creditMonths: 18 },
];

const EMERGENCIES: Array<{ id: string; title: string; text: string; cost: number }> = [
  { id: "em-medical", title: "Medical bill", text: "A family member needs treatment and the bill is due now.", cost: 900 },
  { id: "em-repair", title: "Urgent repair", text: "Your home needs an urgent repair before it gets worse.", cost: 600 },
  { id: "em-fees", title: "School fees due", text: "Fees are due this week and they can't wait.", cost: 750 },
];

const LEARN: Array<{ id: string; title: string; text: string; cost: number; incomeBoost: number; smarts: number }> = [
  { id: "ln-sales", title: "Sales skills course", text: "A short course on selling and negotiating. It pays off in whatever you do.", cost: 600, incomeBoost: 0.08, smarts: 1 },
  { id: "ln-books", title: "Library book on money", text: "You borrow a book about how money works. It's free, and it's good.", cost: 0, incomeBoost: 0, smarts: 1 },
  { id: "ln-statements", title: "Financial statements workshop", text: "You learn to read an income statement and a balance sheet.", cost: 450, incomeBoost: 0, smarts: 2 },
];

const WINDFALLS: Array<{ id: string; title: string; text: string; amount: number }> = [
  { id: "wf-gift", title: "A gift from a relative", text: "A relative sends you money to say thanks for helping out.", amount: 700 },
  { id: "wf-refund", title: "Refund arrives", text: "A deposit you'd forgotten about is returned to you.", amount: 500 },
];

const SCAMS: Array<{ id: string; title: string; text: string; cost: number }> = [
  { id: "sc-double", title: "\"Double your money in a month\"", text: "A friend of a friend says you'll get double back in 30 days. He can't say exactly how.", cost: 1500 },
  { id: "sc-crypto", title: "\"Guaranteed\" trading tip", text: "A stranger online promises a guaranteed 50% return, if you send money today.", cost: 1000 },
];

const SCAM_ASK_FEEDBACK = "You asked how it makes money. There was no real answer, and the offer disappeared.";

// ─── Randomness (mulberry32, state kept in the game so it can be saved) ────
function nextRandom(draft: GameState): number {
  draft.rng = (draft.rng + 0x6d2b79f5) | 0;
  let t = draft.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const pick = <T,>(draft: GameState, list: T[]): T => list[Math.floor(nextRandom(draft) * list.length)];

// ─── Derived numbers ───────────────────────────────────────────────────────
export function professionOf(state: GameState): Profession {
  return PROFESSIONS.find((p) => p.id === state.professionId) ?? PROFESSIONS[0];
}

export function dealDiscount(smarts: number): number {
  return Math.min(IQ_DISCOUNT_CAP, smarts * IQ_DISCOUNT_PER_POINT);
}

export interface Summary {
  earnedIncome: number;
  passiveIncome: number;
  totalIncome: number;
  living: number;
  liabilityPayments: number;
  loanInterest: number;
  totalExpenses: number;
  netCashflow: number;
  byQuadrant: Record<Quadrant, number>;
  /** 0 to 1+: passive income divided by expenses. 1 means financially free. */
  freedom: number;
  assetsTotal: number;
  liabilitiesTotal: number;
  discount: number;
}

export function summarize(state: GameState): Summary {
  const p = professionOf(state);
  const earnedIncome = state.sickThisMonth ? 0 : state.jobIncome;
  const byQuadrant: Record<Quadrant, number> = { E: 0, S: 0, B: 0, I: 0 };
  byQuadrant[p.quadrant] = state.jobIncome;
  let passiveIncome = 0;
  for (const h of state.holdings) {
    byQuadrant[h.quadrant] += h.cashflow;
    passiveIncome += h.cashflow;
  }
  const liabilityPayments = state.liabilities.reduce((n, l) => n + l.monthly, 0);
  const loanInterest = Math.round(state.loan * LOAN_RATE);
  const totalExpenses = state.livingExpenses + liabilityPayments + loanInterest;
  const totalIncome = earnedIncome + passiveIncome;
  return {
    earnedIncome,
    passiveIncome,
    totalIncome,
    living: state.livingExpenses,
    liabilityPayments,
    loanInterest,
    totalExpenses,
    netCashflow: totalIncome - totalExpenses,
    byQuadrant,
    freedom: totalExpenses > 0 ? passiveIncome / totalExpenses : 0,
    assetsTotal: state.cash + state.holdings.reduce((n, h) => n + h.cost, 0),
    liabilitiesTotal: state.loan + state.liabilities.reduce((n, l) => n + l.monthly * l.monthsLeft, 0),
    discount: dealDiscount(state.smarts),
  };
}

// ─── Drawing the next card ─────────────────────────────────────────────────
type Weighted = Array<[CardKind, number]>;
const WEIGHTS: Weighted = [
  ["opportunity", 38],
  ["splurge", 18],
  ["emergency", 14],
  ["learn", 10],
  ["windfall", 6],
  ["scam", 5],
  ["illness", 5],
  ["raise", 5],
  ["setback", 7],
];

function kindAvailable(draft: GameState, kind: CardKind): boolean {
  const q = professionOf(draft).quadrant;
  if (kind === "illness") return q === "S";
  if (kind === "raise") return q === "E";
  if (kind === "setback") return draft.holdings.some((h) => h.quadrant === "B");
  // Nobody has a cushion yet in the first months, so don't open with a bill
  // that can only be met by borrowing.
  if (kind === "emergency") return draft.month >= 3;
  return true;
}

function roundTo10(n: number): number {
  return Math.max(10, Math.round(n / 10) * 10);
}

function drawCard(draft: GameState): Card {
  const kinds = WEIGHTS.filter(([k]) => kindAvailable(draft, k));
  const total = kinds.reduce((n, [, w]) => n + w, 0);
  for (let attempt = 0; attempt < 6; attempt++) {
    let roll = nextRandom(draft) * total;
    let kind: CardKind = kinds[0][0];
    for (const [k, w] of kinds) {
      if (roll < w) { kind = k; break; }
      roll -= w;
    }
    const card = buildCard(draft, kind);
    if (card.id !== draft.lastCardId) return card;
  }
  return buildCard(draft, "opportunity");
}

function buildCard(draft: GameState, kind: CardKind): Card {
  switch (kind) {
    case "opportunity": {
      const d = pick(draft, OPPORTUNITIES);
      const discount = dealDiscount(draft.smarts);
      return { id: d.id, kind, title: d.title, text: d.text, cost: roundTo10(d.cost * (1 - discount)), cashflow: d.cashflow, quadrant: d.quadrant };
    }
    case "splurge": {
      const d = pick(draft, SPLURGES);
      return { id: d.id, kind, title: d.title, text: d.text, cost: d.cost, creditMonthly: d.creditMonthly, creditMonths: d.creditMonths };
    }
    case "emergency": {
      const d = pick(draft, EMERGENCIES);
      return { id: d.id, kind, title: d.title, text: d.text, cost: d.cost };
    }
    case "learn": {
      const d = pick(draft, LEARN);
      return { id: d.id, kind, title: d.title, text: d.text, cost: d.cost, incomeBoost: d.incomeBoost, smarts: d.smarts };
    }
    case "windfall": {
      const d = pick(draft, WINDFALLS);
      return { id: d.id, kind, title: d.title, text: d.text, amount: d.amount };
    }
    case "scam": {
      const d = pick(draft, SCAMS);
      return { id: d.id, kind, title: d.title, text: d.text, cost: d.cost };
    }
    case "illness":
      return { id: "ev-illness", kind, title: "You fall ill", text: "You can't work this month. When you're self-employed, no work means no income, but the bills still come." };
    case "raise":
      return { id: "ev-raise", kind, title: "A pay rise", text: "Your employer gives you a small raise for good work." };
    case "setback": {
      return { id: "ev-setback", kind, title: "A business setback", text: "A supplier raises prices and one of your businesses earns less each month." };
    }
  }
}

// ─── Choices ───────────────────────────────────────────────────────────────
export interface AvailableChoice {
  id: string;
  label: string;
  hint?: string;
  tone?: "primary" | "neutral" | "danger";
}

export function availableChoices(state: GameState): AvailableChoice[] {
  const c = state.pending;
  if (!c || state.status !== "playing") return [];
  const cost = c.cost ?? 0;
  const canPay = state.cash >= cost;
  switch (c.kind) {
    case "opportunity":
      return [
        canPay
          ? { id: "buy", label: `Buy it for ${cost}`, tone: "primary" }
          : { id: "borrow", label: `Borrow ${cost - state.cash} to buy it`, hint: `Loans cost ${Math.round(LOAN_RATE * 100)}% a month`, tone: "danger" },
        { id: "pass", label: "Pass on it", tone: "neutral" },
      ];
    case "splurge": {
      const out: AvailableChoice[] = [];
      if (canPay) out.push({ id: "buy", label: `Buy it for ${cost}`, tone: "danger" });
      if (c.creditMonthly) out.push({ id: "credit", label: `Buy on credit: ${c.creditMonthly} a month for ${c.creditMonths} months`, tone: "danger" });
      out.push({ id: "pass", label: "Skip it", tone: "primary" });
      return out;
    }
    case "emergency":
      return canPay
        ? [{ id: "pay", label: `Pay ${cost} from your cash`, tone: "primary" }, { id: "loan", label: `Borrow ${cost}`, hint: `Loans cost ${Math.round(LOAN_RATE * 100)}% a month`, tone: "danger" }]
        : [{ id: "loan", label: `Use your ${state.cash} and borrow the ${cost - state.cash} you're short`, hint: `Loans cost ${Math.round(LOAN_RATE * 100)}% a month`, tone: "danger" }];
    case "learn":
      return [
        ...(canPay ? [{ id: "take", label: cost > 0 ? `Take it for ${cost}` : "Take it (free)", tone: "primary" as const }] : []),
        { id: "pass", label: canPay ? "Not now" : "Can't afford it yet", tone: "neutral" as const },
      ];
    case "windfall":
      return [{ id: "collect", label: `Collect ${c.amount}`, tone: "primary" }];
    case "scam": {
      const out: AvailableChoice[] = [];
      if (canPay) out.push({ id: "invest", label: `Send ${cost}`, tone: "danger" });
      out.push({ id: "ask", label: "Ask exactly how it makes money", tone: "primary" });
      out.push({ id: "pass", label: "Walk away", tone: "neutral" });
      return out;
    }
    case "illness":
    case "raise":
    case "setback":
      return [{ id: "continue", label: "Continue", tone: "primary" }];
  }
}

// ─── The game loop ─────────────────────────────────────────────────────────
const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s));

function say(draft: GameState, text: string, tone: Tone) {
  draft.log.push({ month: draft.month + 1, text, tone });
  if (draft.log.length > 60) draft.log.splice(0, draft.log.length - 60);
}

function borrow(draft: GameState, amount: number) {
  if (amount <= 0) return;
  draft.loan += amount;
  draft.stats.loansTaken += 1;
}

/** Applies the pending card's choice, then ends the month, then draws the next card. */
export function respond(state: GameState, choiceId: string): GameState {
  const card = state.pending;
  if (!card || state.status !== "playing") return state;
  if (!availableChoices(state).some((c) => c.id === choiceId)) return state;

  const d = clone(state);
  d.lastCardId = card.id;
  d.pending = null;
  const cost = card.cost ?? 0;

  switch (card.kind) {
    case "opportunity": {
      if (choiceId === "pass") { say(d, `You passed on "${card.title}".`, "info"); break; }
      const shortfall = Math.max(0, cost - d.cash);
      d.cash = Math.max(0, d.cash - cost);
      if (choiceId === "borrow") borrow(d, shortfall);
      d.holdings.push({ uid: d.nextUid++, name: card.title, quadrant: card.quadrant!, cost, cashflow: card.cashflow! });
      d.stats.assetsBought += 1;
      say(d, `You bought "${card.title}". It pays you ${card.cashflow} a month.`, "good");
      break;
    }
    case "splurge": {
      if (choiceId === "pass") { d.stats.splurgesSkipped += 1; say(d, `You skipped "${card.title}" and kept your money.`, "good"); break; }
      d.stats.splurgesBought += 1;
      if (choiceId === "credit") {
        d.liabilities.push({ uid: d.nextUid++, name: card.title, monthly: card.creditMonthly!, monthsLeft: card.creditMonths! });
        say(d, `You bought "${card.title}" on credit. It takes ${card.creditMonthly} out of your pocket every month.`, "bad");
      } else {
        d.cash -= cost;
        say(d, `You spent ${cost} on "${card.title}". It doesn't pay you anything back.`, "bad");
      }
      break;
    }
    case "emergency": {
      if (choiceId === "pay") { d.cash -= cost; say(d, `You paid ${cost} for "${card.title}" from your cash.`, "info"); }
      else {
        const shortfall = Math.max(0, cost - d.cash);
        if (shortfall > 0) d.cash = 0; // use what you have, borrow the rest
        borrow(d, shortfall > 0 ? shortfall : cost);
        say(d, `You borrowed ${shortfall > 0 ? shortfall : cost} to cover "${card.title}". The loan costs interest every month.`, "bad");
      }
      break;
    }
    case "learn": {
      if (choiceId === "pass") { say(d, `You passed on "${card.title}".`, "info"); break; }
      d.cash -= cost;
      d.smarts += card.smarts ?? 0;
      d.stats.coursesTaken += 1;
      if (card.incomeBoost) d.jobIncome = Math.round(d.jobIncome * (1 + card.incomeBoost));
      say(d, `You learned something from "${card.title}". You'll spot better deals now.`, "good");
      break;
    }
    case "windfall":
      d.cash += card.amount ?? 0;
      say(d, `${card.title}: +${card.amount}. What you do with it next matters.`, "good");
      break;
    case "scam": {
      if (choiceId === "invest") {
        d.cash -= cost;
        d.stats.scamsLost += 1;
        say(d, `You sent ${cost} and never heard back. Promises of guaranteed fast returns are usually scams.`, "bad");
      } else if (choiceId === "ask") {
        d.smarts += 1;
        d.stats.scamsAvoided += 1;
        say(d, SCAM_ASK_FEEDBACK, "good");
      } else {
        d.stats.scamsAvoided += 1;
        say(d, "You walked away from an offer that sounded too good to be true.", "good");
      }
      break;
    }
    case "illness":
      if (professionOf(d).quadrant === "S") d.sickThisMonth = true;
      say(d, "You couldn't work this month, so your income stopped. Bills still came.", "bad");
      break;
    case "raise":
      d.jobIncome = Math.round(d.jobIncome * 1.05);
      say(d, "Your pay went up 5%.", "good");
      break;
    case "setback": {
      const businesses = d.holdings.filter((h) => h.quadrant === "B");
      const hit = pick(d, businesses);
      const lost = Math.round(hit.cashflow * 0.15);
      hit.cashflow -= lost;
      say(d, `"${hit.name}" now pays ${lost} less each month. Businesses carry risks that a salary doesn't.`, "bad");
      break;
    }
  }

  settleMonth(d);
  if (d.status === "playing") d.pending = drawCard(d);
  return d;
}

function settleMonth(d: GameState) {
  const s = summarize(d);
  d.cash += s.totalIncome - s.totalExpenses;
  d.sickThisMonth = false;

  for (const l of d.liabilities) l.monthsLeft -= 1;
  d.liabilities = d.liabilities.filter((l) => l.monthsLeft > 0);

  if (d.cash < 0) {
    const gap = -d.cash;
    d.cash = 0;
    borrow(d, gap);
    say(d, `You ran short by ${gap} and had to take a loan to cover your bills.`, "bad");
  }

  d.month += 1;

  const after = summarize(d);
  if (after.passiveIncome >= after.totalExpenses && after.passiveIncome > 0) {
    d.status = "won";
    say(d, "Your assets now pay more than all your expenses. You're financially free.", "good");
  } else if (d.loan > d.jobIncome * BANKRUPTCY_MULTIPLE) {
    d.status = "lost";
    say(d, "Your debts have grown bigger than you can carry.", "bad");
  } else if (d.month >= MAX_MONTHS) {
    d.status = "timeout";
    say(d, "Five years have passed and your assets don't yet cover your expenses.", "info");
  }
}

/** Pay down the loan between turns. Returns the same state if nothing can be paid. */
export function repayLoan(state: GameState, amount: number): GameState {
  const pay = Math.floor(Math.min(amount, state.cash, state.loan));
  if (pay <= 0 || state.status !== "playing") return state;
  const d = clone(state);
  d.cash -= pay;
  d.loan -= pay;
  say(d, `You repaid ${pay} of your loan.`, "good");
  return d;
}

export function newGame(professionId: string, seed: number): GameState {
  const p = PROFESSIONS.find((x) => x.id === professionId) ?? PROFESSIONS[0];
  const d: GameState = {
    version: 1,
    professionId: p.id,
    month: 0,
    cash: p.savings,
    jobIncome: p.income,
    livingExpenses: p.expenses,
    smarts: 0,
    holdings: [],
    liabilities: [],
    loan: 0,
    rng: seed | 0,
    nextUid: 1,
    pending: null,
    lastCardId: null,
    sickThisMonth: false,
    status: "playing",
    log: [],
    stats: { assetsBought: 0, splurgesBought: 0, splurgesSkipped: 0, scamsLost: 0, scamsAvoided: 0, loansTaken: 0, coursesTaken: 0 },
  };
  d.pending = drawCard(d);
  return d;
}

// ─── End-of-game reflections ───────────────────────────────────────────────
export interface Reflection {
  text: string;
  /** A lesson in the Book Library that explains the idea. */
  lessonId: string;
}

export function reflections(state: GameState): Reflection[] {
  const s = summarize(state);
  const out: Reflection[] = [];
  const p = professionOf(state);

  if (state.status === "won") {
    out.push({ text: `You reached freedom in ${state.month} months: ${s.passiveIncome} a month from assets against ${s.totalExpenses} of expenses. Your salary didn't get you there. Your assets did.`, lessonId: "cq-freedom-formula" });
  } else if (s.freedom > 0) {
    out.push({ text: `Your assets covered ${Math.round(s.freedom * 100)}% of your expenses. Reaching 100% is the goal, and every asset moves the number.`, lessonId: "cq-freedom-formula" });
  } else {
    out.push({ text: "None of your income came from assets, so it all depended on you showing up. Getting even one asset early makes every later month easier.", lessonId: "rd-assets-liabilities" });
  }
  if (state.stats.splurgesBought >= 3) {
    out.push({ text: `You bought ${state.stats.splurgesBought} things that took money out of your pocket. Each one delayed the day your assets covered your expenses.`, lessonId: "rd-assets-liabilities" });
  } else if (state.stats.splurgesSkipped >= 3) {
    out.push({ text: `You skipped ${state.stats.splurgesSkipped} tempting purchases. That kept money working for you instead.`, lessonId: "pm-wealth-you-dont-see" });
  }
  if (state.stats.scamsLost > 0) {
    out.push({ text: "You lost money to an offer that promised fast, guaranteed returns. Ask how it makes money and who has done it before, every time.", lessonId: "bb-guard-treasure" });
  } else if (state.stats.scamsAvoided > 0) {
    out.push({ text: "You walked away from an offer that was too good to be true. That protected your savings.", lessonId: "ig-invest-vs-speculate" });
  }
  if (state.stats.loansTaken >= 3 || state.status === "lost") {
    out.push({ text: "Loans cost you interest every month, which shrinks the money you can put into assets. Borrowing to buy an asset can work, borrowing to cover spending rarely does.", lessonId: "pm-room-for-error" });
  }
  if (p.quadrant === "S" && state.month > 0) {
    out.push({ text: "As a self-employed person your income stopped whenever you couldn't work. Assets and systems keep paying when you can't.", lessonId: "cq-from-job-to-system" });
  }
  if (s.byQuadrant.B > 0 && s.byQuadrant.I > 0) {
    out.push({ text: "You built income from both a business and investments. Mixing the two spreads the risk.", lessonId: "cq-four-quadrants" });
  } else if (state.holdings.length > 0) {
    out.push({ text: "All your assets came from one side. Businesses pay more but carry risk, investments pay less but are steadier. A mix is safer.", lessonId: "cq-four-quadrants" });
  }
  if (state.stats.coursesTaken === 0 && state.smarts === 0) {
    out.push({ text: "You never learned anything new. Even free lessons gave better deals to people who took them.", lessonId: "rd-work-to-learn" });
  }
  return out.slice(0, 5);
}
