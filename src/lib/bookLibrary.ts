// The lessons behind Aziiki's "Book Library" and the small nudges that appear
// through the app.
//
// COPYRIGHT RULES for this file (see docs/content-and-copyright.md, and
// bookLibrary.test.ts, which enforces the mechanical ones):
//  - Only IDEAS are used, never the books' wording. Every lesson is written
//    fresh, short, and in Aziiki's own voice. No quotations, no excerpts, no
//    stories or characters lifted from a book, no chapter titles.
//  - A book is named only to say where an idea comes from (with the author),
//    and the person is pointed to the book itself. No covers, logos or
//    brand names are used, and nothing implies an author or publisher
//    endorses Aziiki.
//  - Each lesson ends with something the person can do inside Aziiki, so the
//    content is Aziiki's own teaching, not a substitute for the book.
//
// These are learning notes, not financial, tax or legal advice.

export type BookKey = "richdad" | "quadrant" | "babylon" | "intelligent" | "psychology";

/** Screens a lesson can send someone to (matches App.tsx tab ids). */
export type LessonTab = "dashboard" | "billing" | "crm" | "wealth" | "stock" | "purchaseOrders" | "reports" | "game";

/** Places in the app where a lesson can show up as a nudge. */
export type NudgeContext =
  | "dashboard"
  | "billing"
  | "crm"
  | "wealth"
  | "stock"
  | "purchaseOrders"
  | "team"
  | "ai"
  | "personal"
  | "reports";

export interface Book {
  key: BookKey;
  title: string;
  author: string;
  blurb: string;
  // Tailwind classes, kept here so the shelf and the reading view agree.
  accent: { card: string; text: string; bar: string };
}

export interface Lesson {
  id: string;
  book: BookKey;
  title: string;
  /** The idea, in two or three plain sentences. */
  idea: string;
  /** What it means for someone running a small business. */
  forYourBusiness: string;
  /** One concrete thing to do in Aziiki. */
  tryIt: { text: string; tab?: LessonTab };
  contexts: NudgeContext[];
}

export const BOOKS: Book[] = [
  {
    key: "richdad",
    title: "Rich Dad Poor Dad",
    author: "Robert Kiyosaki",
    blurb: "What money means when you stop working only for a paycheck.",
    accent: { card: "bg-emerald-50 border-emerald-200", text: "text-emerald-800", bar: "bg-emerald-600" },
  },
  {
    key: "quadrant",
    title: "Rich Dad's CASHFLOW Quadrant",
    author: "Robert Kiyosaki",
    blurb: "Four ways to earn: employee, self-employed, business owner, investor.",
    accent: { card: "bg-teal-50 border-teal-200", text: "text-teal-800", bar: "bg-teal-600" },
  },
  {
    key: "babylon",
    title: "The Richest Man in Babylon",
    author: "George S. Clason",
    blurb: "Old parables with simple habits that still build savings.",
    accent: { card: "bg-amber-50 border-amber-200", text: "text-amber-800", bar: "bg-amber-500" },
  },
  {
    key: "intelligent",
    title: "The Intelligent Investor",
    author: "Benjamin Graham",
    blurb: "How to invest calmly and avoid the mistakes that cost the most.",
    accent: { card: "bg-indigo-50 border-indigo-200", text: "text-indigo-800", bar: "bg-indigo-600" },
  },
  {
    key: "psychology",
    title: "The Psychology of Money",
    author: "Morgan Housel",
    blurb: "Why how you behave with money matters more than how much you know.",
    accent: { card: "bg-sky-50 border-sky-200", text: "text-sky-800", bar: "bg-sky-600" },
  },
];

export const LESSONS: Lesson[] = [
  // ─── Rich Dad Poor Dad ───────────────────────────────────────────────
  {
    id: "rd-assets-liabilities",
    book: "richdad",
    title: "Follow the cash: assets vs liabilities",
    idea: "Something is an asset if it puts money into your pocket, and a liability if it takes money out. It doesn't matter what people call it. A car you finance is usually a liability even though it feels like something you own.",
    forYourBusiness: "Look at what you own and ask one question of each item: does it pay me every month, or do I pay for it every month? Shop stock that sells is working for you. Equipment that sits idle is not.",
    tryIt: { text: "List what you own in Wealth & Goals and mark which items pay you regularly.", tab: "wealth" },
    contexts: ["wealth", "stock"],
  },
  {
    id: "rd-work-to-learn",
    book: "richdad",
    title: "Skills first, pay second",
    idea: "Early on, the skills you pick up (selling, leading people, handling money, explaining things clearly) can be worth more over time than a slightly higher wage today.",
    forYourBusiness: "Every customer conversation is practice. The owners who grow fastest keep getting better at selling and at reading their numbers, not just at their craft.",
    tryIt: { text: "After your next big sale, note in the customer's record what worked in the conversation.", tab: "crm" },
    contexts: ["crm", "team"],
  },
  {
    id: "rd-mind-your-business",
    book: "richdad",
    title: "Build your own asset column",
    idea: "Your job or trade pays the bills, but your real business is the collection of assets you keep building on the side. Don't spend a whole career making other people's assets grow while yours stays empty.",
    forYourBusiness: "Decide a fixed share of every good month's profit that goes into something that will pay you later, before it can be spent on anything else.",
    tryIt: { text: "Set a goal in Wealth & Goals and move a fixed share of this month's profit into it.", tab: "wealth" },
    contexts: ["dashboard", "personal"],
  },
  {
    id: "rd-emotions",
    book: "richdad",
    title: "Fear and excitement steer your money",
    idea: "Most people react to money with fear of running short or excitement about treating themselves. Neither feeling is wrong, but acting on it without thinking is how people stay stuck.",
    forYourBusiness: "When you feel a strong urge to spend, or to hold on to something that isn't working, pause and write down the number first. Numbers are calmer than feelings.",
    tryIt: { text: "Before your next non-essential purchase, check your Scorecard to see what it does to your cash." , tab: "dashboard" },
    contexts: ["personal", "dashboard"],
  },
  {
    id: "rd-financial-literacy",
    book: "richdad",
    title: "Financial literacy is a learnable skill",
    idea: "Being able to read an income statement and a balance sheet, understand what makes an investment pay, and know the basic rules that apply to you changes the decisions you make.",
    forYourBusiness: "Your reports are your own income statement. Getting comfortable reading them monthly is the single best habit you can build.",
    tryIt: { text: "Open this month's report and find your three biggest costs.", tab: "reports" },
    contexts: ["reports", "ai"],
  },
  {
    id: "rd-rules-of-the-game",
    book: "richdad",
    title: "Know the rules: records, tax and structure",
    idea: "How you set up and record your earnings affects how much you keep. Businesses that keep clean records and understand the rules that apply to them tend to keep more and worry less.",
    forYourBusiness: "Clean invoices and receipts are the foundation. This is a learning note, not tax advice: for your own situation, ask a licensed accountant in your country.",
    tryIt: { text: "Make sure this week's sales all have an invoice or receipt saved.", tab: "billing" },
    contexts: ["billing"],
  },

  // ─── Four ways to earn ───────────────────────────────────────────────
  {
    id: "cq-four-quadrants",
    book: "quadrant",
    title: "Four ways to earn",
    idea: "People earn money in four ways: as an employee, on their own account, as the owner of a business that runs without them, or as an investor whose money earns for them. The first two trade your time for money. The last two are built on systems and assets. Neither side is wrong, but they feel very different.",
    forYourBusiness: "Ask which of the four most of your income comes from today, and which one you want more of. Most small business owners start out on their own account and move toward owning a system by writing down how things are done so others can do them.",
    tryIt: { text: "Play Four Ways to Earn and watch how your income shifts from working for money to money working for you.", tab: "game" },
    contexts: ["dashboard", "team"],
  },
  {
    id: "cq-from-job-to-system",
    book: "quadrant",
    title: "Turn what you do into a system",
    idea: "A job stops paying the day you stop working. A business is a system of people, process and product that keeps working when you step away. The move from S to B is mostly about writing things down and teaching them.",
    forYourBusiness: "If you're the only one who can send an invoice, chase a payment or order stock, you own a job. Documenting each step is the first move toward owning a business.",
    tryIt: { text: "Set up document numbering and a template so anyone on your team can raise an invoice the same way.", tab: "billing" },
    contexts: ["billing", "team"],
  },
  {
    id: "cq-freedom-formula",
    book: "quadrant",
    title: "Freedom is passive income above expenses",
    idea: "One way to define financial freedom is when the income from your assets (not from your labour) covers your monthly expenses. It has nothing to do with how big your salary is, and everything to do with how much of your income doesn't need you to show up.",
    forYourBusiness: "Track two numbers: your monthly expenses, and the part of your income that arrives without new work from you. Watch the gap close.",
    tryIt: { text: "Add up your monthly expenses, then play Four Ways to Earn to see how fast income from assets can close the gap.", tab: "game" },
    contexts: ["dashboard", "wealth"],
  },
  {
    id: "cq-security-or-freedom",
    book: "quadrant",
    title: "Security or freedom: know what you're choosing",
    idea: "Different people want different things from money. Some value a steady paycheck, others value control of their time. Neither is wrong, but you'll make better choices once you know which you're actually optimising for.",
    forYourBusiness: "Write down what you want the business to give you (income, time, independence). It makes hard trade-offs, like taking on staff or a loan, much easier to judge.",
    tryIt: { text: "Write one sentence about what you want your business to give you in 3 years and make it a goal.", tab: "wealth" },
    contexts: ["wealth", "ai"],
  },

  // ─── The Richest Man in Babylon ──────────────────────────────────────
  {
    id: "bb-pay-yourself-first",
    book: "babylon",
    title: "Pay yourself first: keep a tenth",
    idea: "Before you pay anyone else, set aside at least a tenth of everything you earn. It becomes the seed of every later investment, and it works because it happens automatically instead of waiting for whatever is left over.",
    forYourBusiness: "Treat your savings like a bill that has to be paid first. Even a small share, moved the day money arrives, builds faster than a big share you only save when you remember.",
    tryIt: { text: "Use the Pay Myself First tool in Reports & Wisdom this week.", tab: "reports" },
    contexts: ["dashboard", "personal", "reports"],
  },
  {
    id: "bb-control-spending",
    book: "babylon",
    title: "Tell needs apart from wants",
    idea: "Your wants will always grow to match your income. Set a budget that covers what you truly need and protects your savings, and don't let wants quietly become needs.",
    forYourBusiness: "Before ordering stock or supplies, ask whether it's needed to serve customers this month or just something that would be nice to have.",
    tryIt: { text: "Check your purchase orders for anything that is a want, not a need.", tab: "purchaseOrders" },
    contexts: ["purchaseOrders", "stock", "personal"],
  },
  {
    id: "bb-make-money-multiply",
    book: "babylon",
    title: "Put your savings to work",
    idea: "Saved money that sits still earns nothing. Money placed in something that pays you, and then reinvested, earns on its earnings. Time does most of the work.",
    forYourBusiness: "Savings can be working capital, stock that turns quickly, or a safe investment. The point is that each unit of money has a job.",
    tryIt: { text: "Try the compound-growth calculator with your own numbers.", tab: "reports" },
    contexts: ["wealth", "reports"],
  },
  {
    id: "bb-guard-treasure",
    book: "babylon",
    title: "Guard your savings from loss",
    idea: "Promises of huge, fast returns are how most people lose their savings. Put money only where the risk is understood, and ask people who have handled money successfully before you commit.",
    forYourBusiness: "If a deal sounds too good to be true, slow down. Ask how it makes money, who has done it before, and what happens if it fails.",
    tryIt: { text: "Before your next investment, write down how it makes money and the worst that can happen.", tab: "wealth" },
    contexts: ["wealth", "ai"],
  },
  {
    id: "bb-future-income",
    book: "babylon",
    title: "Plan an income for later",
    idea: "You won't always be able to work at the same pace. Set up income that keeps coming in later, through long-term savings and assets, while you still can.",
    forYourBusiness: "Ask what would pay your bills if you couldn't work for three months. Build toward that answer a little each month.",
    tryIt: { text: "Set a savings goal equal to three months of expenses.", tab: "wealth" },
    contexts: ["wealth", "dashboard"],
  },
  {
    id: "bb-increase-earning",
    book: "babylon",
    title: "Increase your ability to earn",
    idea: "The more you learn about your trade, the more you can earn from it. Skill is an asset that grows with use and can't be taken from you.",
    forYourBusiness: "Learning to price better, sell better or serve a better customer is a direct raise. Put time on your calendar for it.",
    tryIt: { text: "Check which customers bring in the most, and think about how to serve more like them.", tab: "crm" },
    contexts: ["crm", "team"],
  },

  // ─── The Intelligent Investor ────────────────────────────────────────
  {
    id: "ig-margin-of-safety",
    book: "intelligent",
    title: "Keep a margin of safety",
    idea: "Pay well below what you think something is worth. That gap protects you when you're wrong, and everyone is wrong sometimes.",
    forYourBusiness: "Don't stretch every naira, cedi or shilling to the limit on stock or equipment. Leave room so one bad month doesn't sink you.",
    tryIt: { text: "Check your stock levels: is there money tied up in slow items you could free up?", tab: "stock" },
    contexts: ["stock", "purchaseOrders", "wealth"],
  },
  {
    id: "ig-mr-market",
    book: "intelligent",
    title: "Prices swing with moods, not just facts",
    idea: "Market prices move with mood as well as facts: excitement pushes them up too far and fear pushes them down too far. You are never forced to act on today's price, and you can use a very low or very high one when it suits your plan.",
    forYourBusiness: "A price on a screen is not the value of what you own. Don't sell in a panic because prices dropped or buy in a rush because they rose.",
    tryIt: { text: "Review your investments and write down why you own each one, before looking at today's price.", tab: "wealth" },
    contexts: ["wealth"],
  },
  {
    id: "ig-invest-vs-speculate",
    book: "intelligent",
    title: "Know a plan from a bet",
    idea: "Investing means studying something, protecting your money and expecting a fair return. Speculating is betting that a price will move. Both exist, but don't mistake one for the other, and never bet money you can't afford to lose.",
    forYourBusiness: "If you can't explain how the money is made, it's a bet. If you do bet, keep it to a small amount you could lose without harm.",
    tryIt: { text: "Mark each holding as an investment or a bet, and check the bets aren't too big.", tab: "wealth" },
    contexts: ["wealth", "ai"],
  },
  {
    id: "ig-know-your-type",
    book: "intelligent",
    title: "Choose a steady or a hands-on style",
    idea: "Some people want a simple, low-effort plan. Others are willing to spend real time researching each choice. Pick the style that fits your life and stick to it.",
    forYourBusiness: "If running your business already takes all your time, a simple, steady approach beats chasing tips.",
    tryIt: { text: "Decide how many hours a month you'll give to investing, and let that choose your approach.", tab: "wealth" },
    contexts: ["wealth"],
  },
  {
    id: "ig-your-worst-enemy",
    book: "intelligent",
    title: "Your own behaviour is the biggest risk",
    idea: "Most investment losses come from what people do (panic, chase, follow the crowd), not from the investments themselves. A written plan you made when calm helps you stay calm.",
    forYourBusiness: "Write your rules down while things are quiet: how much you'll put in, when you'll add, when you'll stop.",
    tryIt: { text: "Write three rules for your money and save them as a goal note.", tab: "wealth" },
    contexts: ["wealth", "ai"],
  },

  // ─── The Psychology of Money ─────────────────────────────────────────
  {
    id: "pm-wealth-you-dont-see",
    book: "psychology",
    title: "Money kept beats money shown",
    idea: "Spending shows what you bought, not what you have. Wealth is the part of your income you kept instead of turning into things people can see.",
    forYourBusiness: "A smart-looking shop with an empty bank balance is fragile. A modest one with strong savings survives bad months.",
    tryIt: { text: "Look at your cash this month: how much did you keep, rather than spend?", tab: "dashboard" },
    contexts: ["dashboard", "personal"],
  },
  {
    id: "pm-getting-vs-staying-rich",
    book: "psychology",
    title: "Growing fast and lasting long need different habits",
    idea: "Getting ahead usually takes risk and optimism. Staying ahead takes different habits: humility, caution and never betting everything on one outcome.",
    forYourBusiness: "Growing fast is exciting. Keep enough back that one bad customer or one slow season can't end the business.",
    tryIt: { text: "Check who owes you the most and how much of your income depends on them.", tab: "crm" },
    contexts: ["crm", "billing"],
  },
  {
    id: "pm-buy-time",
    book: "psychology",
    title: "Savings buy you time and choices",
    idea: "One of the most valuable things money can give you is a say over how you spend your days. Savings mean you can turn down a bad customer or a bad deal.",
    forYourBusiness: "An emergency fund isn't just for emergencies. It's what lets you walk away from a job that isn't worth it.",
    tryIt: { text: "Set an emergency-fund goal so you have room to say no.", tab: "wealth" },
    contexts: ["wealth", "dashboard"],
  },
  {
    id: "pm-compounding",
    book: "psychology",
    title: "Compounding needs time, so stay in the game",
    idea: "The biggest results come from earning decent returns for a very long time, not from finding a single perfect one. Anything that knocks you out early (debt, panic selling) interrupts the compounding.",
    forYourBusiness: "Survive first. A business that's still trading in ten years, earning a modest margin, beats one that grew fast and closed.",
    tryIt: { text: "Use the compound-growth calculator to see what a small monthly amount becomes over 10 years.", tab: "reports" },
    contexts: ["reports", "wealth"],
  },
  {
    id: "pm-room-for-error",
    book: "psychology",
    title: "Plan for being wrong",
    idea: "The future will surprise you. Saving without a specific reason, and keeping some slack, is what lets you survive the surprises you couldn't have predicted.",
    forYourBusiness: "Aim for enough cash to cover a few months of costs. It can feel wasteful right up until the day it isn't.",
    tryIt: { text: "Check how many months of expenses your current cash would cover.", tab: "dashboard" },
    contexts: ["dashboard", "stock", "purchaseOrders"],
  },
  {
    id: "pm-luck-and-risk",
    book: "psychology",
    title: "Judge decisions, not just results",
    idea: "Luck and risk shape outcomes more than we like to admit. Don't copy someone's success without asking how much luck was involved, and don't blame yourself entirely for a loss that partly wasn't in your control.",
    forYourBusiness: "Judge decisions by the thinking behind them, not just by how they turned out. A good decision can still lose sometimes.",
    tryIt: { text: "Pick one recent big decision and write down what you knew when you made it.", tab: "dashboard" },
    contexts: ["ai", "wealth"],
  },
  {
    id: "pm-enough",
    book: "psychology",
    title: "Decide what enough looks like",
    idea: "If your goalpost moves every time you reach it, you'll never feel you've arrived, and you'll be tempted to take risks that could cost you what you already have.",
    forYourBusiness: "Decide what enough looks like for your business and your life, in numbers. It's easier to protect a target you've written down.",
    tryIt: { text: "Write down your enough number as a goal.", tab: "wealth" },
    contexts: ["wealth", "personal"],
  },
];

export const BOOK_BY_KEY: Record<BookKey, Book> = Object.fromEntries(BOOKS.map((b) => [b.key, b])) as Record<BookKey, Book>;

export function lessonsForBook(book: BookKey): Lesson[] {
  return LESSONS.filter((l) => l.book === book);
}

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

/**
 * The lesson to nudge with in a given place. Rotates once a day (same lesson
 * all day, so the app doesn't feel jumpy), and prefers one the person hasn't
 * read yet. `dayNumber` is days since 1970, passed in so this stays pure.
 */
export function pickLesson(context: NudgeContext, dayNumber: number, readIds: ReadonlySet<string>): Lesson | undefined {
  const pool = LESSONS.filter((l) => l.contexts.includes(context));
  if (pool.length === 0) return undefined;
  const unread = pool.filter((l) => !readIds.has(l.id));
  const from = unread.length > 0 ? unread : pool;
  return from[dayNumber % from.length];
}

// ─── Reading progress (kept in this browser only) ─────────────────────────
const READ_KEY = "aziiki_wisdom_read_v1";
const DISMISS_KEY = "aziiki_wisdom_dismissed_v1";

export function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveReadIds(ids: ReadonlySet<string>): void {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage can be blocked or full; reading still works, it just won't be remembered.
  }
}

/** Contexts whose nudge was dismissed today, as { context: dayNumber }. */
export function loadDismissed(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveDismissed(map: Record<string, number>): void {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(map));
  } catch {
    // Not remembering a dismissal is harmless.
  }
}

export const currentDayNumber = (now = Date.now()): number => Math.floor(now / 86_400_000);
