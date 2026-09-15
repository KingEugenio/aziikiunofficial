import React, { useEffect, useState } from "react";
import { ClipboardText, Plus, Trash as Trash2, ChartBar } from "@phosphor-icons/react";
import { api, type SurveyQuestion } from "../lib/api";
import { LoadingSwap } from "../components/LoadingSwap";
import { SkeletonAdminItemList } from "../components/Skeleton";

interface SurveyRow {
  id: string;
  title: string;
  description?: string;
  questions: SurveyQuestion[];
  isActive: boolean;
  createdAt: string;
  responseCount: number;
}

interface ResultsData {
  survey: { id: string; title: string };
  responseCount: number;
  questions: Array<{ id: string; prompt: string; type: "text" | "choice"; counts?: Record<string, number>; answers?: string[] }>;
}

function SurveyResults({ surveyId, onClose }: { surveyId: string; onClose: () => void }) {
  const [results, setResults] = useState<ResultsData | null>(null);

  useEffect(() => {
    api.admin.surveys.results(surveyId).then(setResults).catch(() => setResults(null));
  }, [surveyId]);

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
      {!results ? (
        <p className="text-[10px] text-slate-400">Loading results...</p>
      ) : results.responseCount === 0 ? (
        <p className="text-[10px] text-slate-400">No responses yet.</p>
      ) : (
        results.questions.map((q) => (
          <div key={q.id} className="bg-slate-50 rounded-xl p-3 space-y-1.5">
            <p className="text-[11px] font-bold text-slate-700">{q.prompt}</p>
            {q.type === "choice" ? (
              <div className="space-y-1">
                {Object.entries(q.counts ?? {}).map(([option, count]) => (
                  <div key={option} className="flex items-center justify-between text-[10px] text-slate-600">
                    <span>{option}</span>
                    <span className="font-mono font-bold">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {(q.answers ?? []).map((answer, i) => (
                  <li key={i} className="text-[10px] text-slate-600 border-b border-slate-100 pb-1 last:border-0">
                    {answer}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))
      )}
      <button type="button" onClick={onClose} className="text-[10px] font-bold text-slate-400 hover:text-slate-700 cursor-pointer">
        Hide results
      </button>
    </div>
  );
}

const emptyQuestion = (): SurveyQuestion => ({ id: `q${Math.random().toString(36).slice(2, 8)}`, type: "text", prompt: "" });

export default function SurveysPanel() {
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openResultsId, setOpenResultsId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<SurveyQuestion[]>([emptyQuestion()]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.admin.surveys
      .list()
      .then(setSurveys)
      .catch(() => setSurveys([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const updateQuestion = (id: string, patch: Partial<SurveyQuestion>) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const cleaned = questions
        .filter((q) => q.prompt.trim())
        .map((q) => ({
          ...q,
          options: q.type === "choice" ? (q.options ?? []).map((o) => o.trim()).filter(Boolean) : undefined,
        }));
      if (cleaned.length === 0) throw new Error("Add at least one question.");
      await api.admin.surveys.create({ title, description: description || undefined, questions: cleaned });
      setTitle("");
      setDescription("");
      setQuestions([emptyQuestion()]);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that survey.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (row: SurveyRow) => {
    setSurveys((prev) => prev.map((s) => (s.id === row.id ? { ...s, isActive: !s.isActive } : s)));
    try {
      await api.admin.surveys.setActive(row.id, !row.isActive);
    } catch {
      load();
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="border border-slate-200 rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <ClipboardText className="w-3.5 h-3.5" /> Create a new survey
        </h3>
        <input
          type="text"
          required
          maxLength={200}
          placeholder="Survey title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs focus:border-emerald-500"
        />
        <input
          type="text"
          maxLength={1000}
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs focus:border-emerald-500"
        />

        <div className="space-y-2.5">
          {questions.map((q, i) => (
            <div key={q.id} className="bg-slate-50 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Question ${i + 1}`}
                  value={q.prompt}
                  onChange={(e) => updateQuestion(q.id, { prompt: e.target.value })}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] outline-none focus:border-emerald-500"
                />
                <select
                  value={q.type}
                  onChange={(e) => updateQuestion(q.id, { type: e.target.value as "text" | "choice", options: e.target.value === "choice" ? [""] : undefined })}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] outline-none"
                >
                  <option value="text">Free text</option>
                  <option value="choice">Multiple choice</option>
                </select>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setQuestions((prev) => prev.filter((x) => x.id !== q.id))}
                    aria-label="Remove question"
                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {q.type === "choice" && (
                <div className="space-y-1.5 pl-1">
                  {(q.options ?? [""]).map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={`Option ${oi + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const next = [...(q.options ?? [])];
                          next[oi] = e.target.value;
                          updateQuestion(q.id, { options: next });
                        }}
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] outline-none focus:border-emerald-500"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateQuestion(q.id, { options: [...(q.options ?? [""]), ""] })}
                    className="text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer"
                  >
                    + Add option
                  </button>
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
            className="text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add question
          </button>
        </div>

        {error && <p className="text-[10px] text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={isSaving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50"
        >
          {isSaving ? "Creating..." : "Create survey"}
        </button>
      </form>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-800">Surveys</h3>
        <LoadingSwap isLoading={loading} skeleton={<SkeletonAdminItemList />}>
        {surveys.length === 0 ? (
          <p className="text-xs text-slate-400">No surveys yet.</p>
        ) : (
          surveys.map((s) => (
            <div key={s.id} className="border border-slate-200 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900">{s.title}</p>
                  {s.description && <p className="text-[11px] text-slate-500 mt-0.5">{s.description}</p>}
                  <p className="text-[9px] font-mono text-slate-400 mt-1.5">{s.responseCount} response{s.responseCount === 1 ? "" : "s"}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setOpenResultsId(openResultsId === s.id ? null : s.id)}
                    className="text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1"
                  >
                    <ChartBar className="w-3 h-3" /> Results
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(s)}
                    className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer ${
                      s.isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"
                    }`}
                  >
                    {s.isActive ? "Active" : "Inactive"}
                  </button>
                </div>
              </div>
              {openResultsId === s.id && <SurveyResults surveyId={s.id} onClose={() => setOpenResultsId(null)} />}
            </div>
          ))
        )}
        </LoadingSwap>
      </div>
    </div>
  );
}
