import React, { useState } from "react";
import { BookOpen, X } from "@phosphor-icons/react";
import { BOOK_BY_KEY, currentDayNumber, loadDismissed, loadReadIds, pickLesson, saveDismissed, type NudgeContext } from "../lib/bookLibrary";

interface WisdomNudgeProps {
  context: NudgeContext;
  /** Opens the full lesson in the Book Library. */
  onOpenLesson: (lessonId: string) => void;
}

/**
 * A small, dismissible reminder that shows one relevant lesson from the
 * Book Library at the moment it applies (invoices on Billing, savings on the
 * Scorecard, and so on). One lesson per place per day, and it prefers lessons
 * the person hasn't read yet.
 */
export default function WisdomNudge({ context, onOpenLesson }: WisdomNudgeProps) {
  const today = currentDayNumber();
  const [dismissed, setDismissed] = useState(() => loadDismissed()[context] === today);
  const [lesson] = useState(() => pickLesson(context, today, loadReadIds()));

  if (!lesson || dismissed) return null;
  const book = BOOK_BY_KEY[lesson.book];

  const dismiss = () => {
    setDismissed(true);
    saveDismissed({ ...loadDismissed(), [context]: today });
  };

  return (
    <aside className={`rounded-2xl border p-3.5 mb-4 flex items-start gap-3 text-left ${book.accent.card}`} aria-label="Money lesson">
      <BookOpen className={`w-5 h-5 shrink-0 mt-0.5 ${book.accent.text}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">From {book.title}</p>
        <p className={`text-xs font-black mt-0.5 ${book.accent.text}`}>{lesson.title}</p>
        <p className="text-[11px] text-slate-700 leading-relaxed mt-1">{lesson.forYourBusiness}</p>
        <button type="button" onClick={() => onOpenLesson(lesson.id)} className={`text-[11px] font-bold mt-1.5 underline cursor-pointer ${book.accent.text}`}>
          Read the full lesson
        </button>
      </div>
      <button type="button" onClick={dismiss} aria-label="Hide this lesson for today" className="text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer">
        <X className="w-4 h-4" />
      </button>
    </aside>
  );
}
