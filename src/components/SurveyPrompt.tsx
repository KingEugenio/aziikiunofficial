import React, { useEffect, useState } from "react";
import { ClipboardText, X, CheckCircle } from "@phosphor-icons/react";
import { api, type SurveyQuestion } from "../lib/api";

interface Survey {
  id: string;
  title: string;
  description?: string;
  questions: SurveyQuestion[];
}

/**
 * Shows one active, not-yet-answered admin survey (see /admin -> Surveys) to
 * every signed-in user, inline in the main app. Dismissing without
 * submitting just hides it for this session - it reappears on next
 * reload until the user actually submits a response or an admin closes
 * the survey.
 */
export default function SurveyPrompt() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    api.surveys
      .listActive()
      .then(setSurveys)
      .catch(() => setSurveys([]));
  }, []);

  const survey = surveys.find((s) => s.id !== dismissedId && s.id !== submittedId);
  if (!survey) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await api.surveys.submitResponse(survey.id, answers);
      setSubmittedId(survey.id);
      setAnswers({});
    } catch {
      // Best-effort - the prompt just stays open so they can retry.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm animate-fade-in text-left space-y-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="bg-emerald-50 text-emerald-600 w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
            <ClipboardText className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-slate-800">{survey.title}</p>
            {survey.description && <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{survey.description}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissedId(survey.id)}
          aria-label="Dismiss survey"
          className="shrink-0 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-3">
        {survey.questions.map((q) => (
          <div key={q.id} className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 block">{q.prompt}</label>
            {q.type === "choice" ? (
              <div className="flex flex-wrap gap-1.5">
                {(q.options ?? []).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border cursor-pointer transition-colors ${
                      answers[q.id] === opt
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs focus:border-emerald-500"
              />
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || Object.keys(answers).length === 0}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        <CheckCircle className="w-3.5 h-3.5" /> {isSubmitting ? "Submitting..." : "Submit"}
      </button>
    </div>
  );
}
