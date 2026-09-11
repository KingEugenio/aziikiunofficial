import React, { useEffect, useState } from "react";
import { Plus, Trash as Trash2, CheckCircle, Circle } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { LoadingSwap } from "../components/LoadingSwap";
import { SkeletonAdminItemList } from "../components/Skeleton";

interface GuideItem {
  id: string;
  title: string;
  description: string | null;
  isDone: boolean;
  createdAt: string;
}

/**
 * A checkable punch-list for the app owner, separate from AppGuide.tsx
 * (which is the end-user-facing Academy) - setup steps, improvement ideas,
 * and important reminders that live in the portal instead of scattered
 * across chat history.
 */
export default function GuidesPanel() {
  const [items, setItems] = useState<GuideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.admin.guideItems
      .list()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsAdding(true);
    try {
      await api.admin.guideItems.create(title, description);
      setTitle("");
      setDescription("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that item.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggle = async (item: GuideItem) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isDone: !i.isDone } : i)));
    try {
      await api.admin.guideItems.setDone(item.id, !item.isDone);
    } catch {
      load();
    }
  };

  const handleDelete = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await api.admin.guideItems.remove(id);
    } catch {
      load();
    }
  };

  const pending = items.filter((i) => !i.isDone);
  const done = items.filter((i) => i.isDone);

  return (
    <div className="space-y-6">
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Setup steps and improvement ideas for running Aziiki - not shown to end users. Check items off as you handle them, or
        add your own.
      </p>

      <form onSubmit={handleAdd} className="border border-slate-200 rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-800">Add an item</h3>
        <input
          type="text"
          required
          maxLength={200}
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs focus:border-emerald-500"
        />
        <textarea
          maxLength={2000}
          rows={2}
          placeholder="Details (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs resize-none focus:border-emerald-500"
        />
        {error && <p className="text-[10px] text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={isAdding}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> {isAdding ? "Adding..." : "Add"}
        </button>
      </form>

      <LoadingSwap isLoading={loading} skeleton={<SkeletonAdminItemList />}>
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-800">To do ({pending.length})</h3>
            {pending.length === 0 ? (
              <p className="text-xs text-slate-400">Nothing outstanding.</p>
            ) : (
              pending.map((item) => (
                <div key={item.id} className="border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
                  <button type="button" onClick={() => handleToggle(item)} className="text-slate-300 hover:text-emerald-600 cursor-pointer shrink-0 mt-0.5">
                    <Circle className="w-4.5 h-4.5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900">{item.title}</p>
                    {item.description && <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>}
                  </div>
                  <button type="button" onClick={() => handleDelete(item.id)} aria-label="Delete" className="text-slate-300 hover:text-rose-600 cursor-pointer shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {done.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400">Done ({done.length})</h3>
              {done.map((item) => (
                <div key={item.id} className="border border-slate-150 rounded-2xl p-4 flex items-start gap-3 opacity-60">
                  <button type="button" onClick={() => handleToggle(item)} className="text-emerald-600 cursor-pointer shrink-0 mt-0.5">
                    <CheckCircle className="w-4.5 h-4.5" weight="fill" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-700 line-through">{item.title}</p>
                    {item.description && <p className="text-[11px] text-slate-450 mt-0.5 leading-relaxed">{item.description}</p>}
                  </div>
                  <button type="button" onClick={() => handleDelete(item.id)} aria-label="Delete" className="text-slate-300 hover:text-rose-600 cursor-pointer shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </LoadingSwap>
    </div>
  );
}
