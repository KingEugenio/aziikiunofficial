import React, { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CheckCircle, Circle, CaretDown, CaretUp, ArrowRight, Lightbulb } from "@phosphor-icons/react";
import { BOOKS, BOOK_BY_KEY, LESSONS, lessonById, lessonsForBook, loadReadIds, saveReadIds, type BookKey, type LessonTab } from "../lib/bookLibrary";

interface BookLibraryProps {
  /** Opens this lesson on arrival (from a nudge or the game). */
  focusLessonId?: string | null;
  onFocusHandled?: () => void;
  /** Sends the person to a screen a lesson suggests trying. */
  onGoToTab?: (tab: LessonTab) => void;
  /** The Four Ways to Earn game is a Phase 2 feature; hide links to it when it's off. */
  gameEnabled?: boolean;
}

const TAB_LABEL: Record<LessonTab, string> = {
  dashboard: "Scorecard",
  billing: "Billing",
  crm: "Customers",
  wealth: "Wealth & Goals",
  stock: "Warehouse Stock",
  purchaseOrders: "Purchase Orders",
  reports: "Reports",
  game: "Four Ways to Earn",
};

export default function BookLibrary({ focusLessonId, onFocusHandled, onGoToTab, gameEnabled = false }: BookLibraryProps) {
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds());
  const [bookKey, setBookKey] = useState<BookKey>("richdad");
  const [openId, setOpenId] = useState<string | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Arriving from a nudge or the game: open that lesson.
  useEffect(() => {
    if (!focusLessonId) return;
    const lesson = lessonById(focusLessonId);
    if (lesson) {
      setBookKey(lesson.book);
      setOpenId(lesson.id);
      requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
    onFocusHandled?.();
  }, [focusLessonId, onFocusHandled]);

  const toggleRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveReadIds(next);
      return next;
    });
  };

  const totalRead = LESSONS.filter((l) => readIds.has(l.id)).length;
  const book = BOOK_BY_KEY[bookKey];
  const lessons = useMemo(() => lessonsForBook(bookKey), [bookKey]);
  const readInBook = lessons.filter((l) => readIds.has(l.id)).length;

  return (
    <div ref={sectionRef} className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm text-left space-y-5" id="book-library">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider font-sans">Book Library</h3>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              {LESSONS.length} short lessons from {BOOKS.length} money books, each with something to try in Aziiki.
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-black text-slate-900">{totalRead} / {LESSONS.length}</p>
          <p className="text-[10px] text-slate-400">read</p>
        </div>
      </div>

      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={totalRead} aria-valuemin={0} aria-valuemax={LESSONS.length} aria-label="Lessons read">
        <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${(totalRead / LESSONS.length) * 100}%` }} />
      </div>

      {/* Shelf */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5" role="tablist" aria-label="Books">
        {BOOKS.map((b) => {
          const all = lessonsForBook(b.key);
          const done = all.filter((l) => readIds.has(l.id)).length;
          const active = b.key === bookKey;
          return (
            <button
              key={b.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => { setBookKey(b.key); setOpenId(null); }}
              className={`text-left rounded-2xl border p-3.5 transition-all cursor-pointer ${b.accent.card} ${active ? "ring-2 ring-offset-1 ring-slate-800/70" : "opacity-80 hover:opacity-100"}`}
            >
              <p className={`text-xs font-black leading-snug ${b.accent.text}`}>{b.title}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{b.author}</p>
              <p className="text-[10px] font-mono text-slate-600 mt-2">{done} / {all.length} read</p>
            </button>
          );
        })}
      </div>

      {/* Chosen book */}
      <div className={`rounded-2xl border p-4 ${book.accent.card}`}>
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-black ${book.accent.text}`}>{book.title}</p>
          <span className="text-[10px] font-mono text-slate-600">{readInBook} / {lessons.length}</span>
        </div>
        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{book.blurb}</p>
      </div>

      <ul className="space-y-2">
        {lessons.map((l, i) => {
          const open = openId === l.id;
          const read = readIds.has(l.id);
          const showTry = l.tryIt.tab && (l.tryIt.tab !== "game" || gameEnabled) && onGoToTab;
          return (
            <li key={l.id} className="border border-slate-200 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : l.id)}
                aria-expanded={open}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {read ? <CheckCircle weight="fill" className="w-5 h-5 text-emerald-600 shrink-0" /> : <Circle className="w-5 h-5 text-slate-300 shrink-0" />}
                <span className="flex-1 min-w-0">
                  <span className="block text-[10px] font-mono text-slate-400">Lesson {i + 1}</span>
                  <span className="block text-xs font-bold text-slate-900 leading-snug">{l.title}</span>
                </span>
                {open ? <CaretUp className="w-4 h-4 text-slate-400 shrink-0" /> : <CaretDown className="w-4 h-4 text-slate-400 shrink-0" />}
              </button>
              {open && (
                <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-100 animate-fade-in">
                  <div>
                    <p className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-wider mb-1">The idea</p>
                    <p className="text-xs text-slate-700 leading-relaxed">{l.idea}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-wider mb-1">For your business</p>
                    <p className="text-xs text-slate-700 leading-relaxed">{l.forYourBusiness}</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider">Try it in Aziiki</p>
                      <p className="text-xs text-emerald-900 leading-relaxed mt-0.5">{l.tryIt.text}</p>
                      {showTry && (
                        <button
                          type="button"
                          onClick={() => onGoToTab!(l.tryIt.tab!)}
                          className="mt-2 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                        >
                          Open {TAB_LABEL[l.tryIt.tab!]} <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => toggleRead(l.id)}
                      className={`text-[11px] font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors ${read ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
                    >
                      {read ? "Mark as unread" : "Mark as read"}
                    </button>
                    {i < lessons.length - 1 && (
                      <button type="button" onClick={() => setOpenId(lessons[i + 1].id)} className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer">
                        Next lesson <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-[10px] text-slate-400 leading-relaxed">
        Each lesson is written by Aziiki in its own words to explain an idea, and names the book the idea comes from so you can read it for yourself. The books are not reproduced here, and their authors and publishers are not affiliated with or endorsing Aziiki. Book titles belong to their owners. These are learning notes, not financial, tax or legal advice.
      </p>
    </div>
  );
}
