import React, { useEffect, useState } from "react";
import { FloppyDisk as Save, Plus, Trash as Trash2, InstagramLogo, FacebookLogo, TiktokLogo, EnvelopeSimple as Mail, Phone, WhatsappLogo } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { LoadingSwap } from "../components/LoadingSwap";
import { SkeletonAdminBranding, SkeletonAdminItemList } from "../components/Skeleton";

interface FaqRow {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}

const FIELD_GROUPS: { title: string; icon: any; fields: { key: string; label: string; placeholder: string; multiline?: boolean }[] }[] = [
  {
    title: "Contact",
    icon: Mail,
    fields: [
      { key: "support_email", label: "Support email", placeholder: "support@aziiki.com" },
      { key: "support_phone", label: "Support phone", placeholder: "+233 55 987 6543" },
      { key: "whatsapp_link", label: "WhatsApp link", placeholder: "https://wa.me/233..." },
    ],
  },
  {
    title: "Social links",
    icon: InstagramLogo,
    fields: [
      { key: "social_instagram", label: "Instagram", placeholder: "https://instagram.com/..." },
      { key: "social_facebook", label: "Facebook", placeholder: "https://facebook.com/..." },
      { key: "social_tiktok", label: "TikTok", placeholder: "https://tiktok.com/@..." },
    ],
  },
  {
    title: "Legal text",
    icon: Mail,
    fields: [
      { key: "legal_terms_of_service", label: "Terms of Service", placeholder: "Full terms of service text...", multiline: true },
      { key: "legal_refund_policy", label: "Refund Policy", placeholder: "Full refund policy text...", multiline: true },
    ],
  },
];

function SiteSettingsForm() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  useEffect(() => {
    api.admin.siteSettings
      .list()
      .then((rows) => setValues(Object.fromEntries(rows.map((r) => [r.key, r.value]))))
      .catch(() => setValues({}))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (key: string) => {
    setSavingKey(key);
    setSavedKey(null);
    try {
      await api.admin.siteSettings.set(key, values[key] ?? "");
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2000);
    } catch {
      // Best-effort - the field just keeps its unsaved value on screen.
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <LoadingSwap isLoading={loading} skeleton={<SkeletonAdminBranding />}>
      <div className="space-y-6">
        {FIELD_GROUPS.map((group) => {
          const GroupIcon = group.icon;
          return (
            <div key={group.title} className="border border-slate-200 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <GroupIcon className="w-3.5 h-3.5" /> {group.title}
              </h3>
              {group.fields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">{field.label}</label>
                  <div className="flex items-start gap-2">
                    {field.multiline ? (
                      <textarea
                        rows={4}
                        placeholder={field.placeholder}
                        value={values[field.key] ?? ""}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs resize-none focus:border-emerald-500"
                      />
                    ) : (
                      <input
                        type="text"
                        placeholder={field.placeholder}
                        value={values[field.key] ?? ""}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs focus:border-emerald-500"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleSave(field.key)}
                      disabled={savingKey === field.key}
                      className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-2 rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {savingKey === field.key ? "..." : savedKey === field.key ? "Saved" : "Save"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </LoadingSwap>
  );
}

function FaqEditor() {
  const [items, setItems] = useState<FaqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.admin.faqItems
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
      await api.admin.faqItems.create(question, answer, items.length);
      setQuestion("");
      setAnswer("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that FAQ item.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggle = async (item: FaqRow) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isActive: !i.isActive } : i)));
    try {
      await api.admin.faqItems.update(item.id, { isActive: !item.isActive });
    } catch {
      load();
    }
  };

  const handleDelete = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await api.admin.faqItems.remove(id);
    } catch {
      load();
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="border border-slate-200 rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-800">Add an FAQ item</h3>
        <input
          type="text"
          required
          maxLength={300}
          placeholder="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs focus:border-emerald-500"
        />
        <textarea
          required
          maxLength={3000}
          rows={3}
          placeholder="Answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
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
        <div className="space-y-2">
          {items.length === 0 ? (
            <p className="text-xs text-slate-400">No FAQ items yet.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="border border-slate-200 rounded-2xl p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900">{item.question}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{item.answer}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggle(item)}
                    className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer ${
                      item.isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"
                    }`}
                  >
                    {item.isActive ? "Visible" : "Hidden"}
                  </button>
                  <button type="button" onClick={() => handleDelete(item.id)} aria-label="Delete" className="text-slate-300 hover:text-rose-600 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </LoadingSwap>
    </div>
  );
}

/**
 * Everything shown on the app's Help & Support page (contact info, social
 * links, legal text) and FAQ, editable here without a code change or
 * redeploy - the exact ask behind this screen's existence.
 */
export default function SiteContentPanel() {
  const [tab, setTab] = useState<"settings" | "faq">("settings");

  return (
    <div className="space-y-5">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setTab("settings")}
          className={`text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer ${tab === "settings" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}
        >
          Contact, Social & Legal
        </button>
        <button
          type="button"
          onClick={() => setTab("faq")}
          className={`text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer ${tab === "faq" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}
        >
          FAQ
        </button>
      </div>
      {tab === "settings" ? <SiteSettingsForm /> : <FaqEditor />}
    </div>
  );
}
