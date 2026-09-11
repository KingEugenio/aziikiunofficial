import React, { useEffect, useState } from "react";
import {
  Question as HelpCircle,
  EnvelopeSimple as Mail,
  Phone,
  WhatsappLogo,
  ShieldCheck,
  FileText,
  ArrowSquareOut,
  CaretDown,
} from "@phosphor-icons/react";
import { api } from "../lib/api";

interface HelpSupportPageProps {
  onGoToGuide: () => void;
  onShowPrivacyPolicy: () => void;
  onShowTermsOfService: () => void;
  onShowRefundPolicy: () => void;
}

const FALLBACK_SETTINGS: Record<string, string> = {
  support_email: "support@aziiki.com",
};

function FaqAccordion() {
  const [items, setItems] = useState<Array<{ id: string; question: string; answer: string }>>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    api.config
      .faq()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-3">
      <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
        <HelpCircle className="w-4 h-4 text-emerald-600" /> Frequently Asked Questions
      </h3>
      <div className="space-y-2">
        {items.map((item) => {
          const open = openId === item.id;
          return (
            <div key={item.id} className="border border-slate-150 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : item.id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
              >
                <span className="text-xs font-bold text-slate-800">{item.question}</span>
                <CaretDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && <p className="px-4 pb-3.5 text-[11px] text-slate-500 leading-relaxed">{item.answer}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HelpSupportPage({ onGoToGuide, onShowPrivacyPolicy, onShowTermsOfService, onShowRefundPolicy }: HelpSupportPageProps) {
  const [settings, setSettings] = useState<Record<string, string>>(FALLBACK_SETTINGS);

  useEffect(() => {
    api.config
      .siteSettings()
      .then((data) => {
        setSettings((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v.trim() !== "")) }));
      })
      .catch(() => {
        // Fail open to the hardcoded fallback above.
      });
  }, []);

  return (
    <div className="space-y-6 text-left animate-fade-in">
      <div>
        <h2 className="text-lg font-black text-slate-900">Help & Support</h2>
        <p className="text-xs text-slate-400 mt-1">Answers, ways to reach us, and the fine print.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Help Center</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Browse the App Guide & Academy for walkthroughs of every screen.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onGoToGuide}
          className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer flex items-center gap-1"
        >
          Visit App Guide & Academy <ArrowSquareOut className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-900">Contact Support</h3>
        </div>
        <div className="space-y-2 text-xs pl-1">
          {settings.support_email && (
            <a href={`mailto:${settings.support_email}`} className="flex items-center gap-2 text-slate-700 hover:text-emerald-600">
              <Mail className="w-3.5 h-3.5" /> {settings.support_email}
            </a>
          )}
          {settings.support_phone && (
            <a href={`tel:${settings.support_phone}`} className="flex items-center gap-2 text-slate-700 hover:text-emerald-600">
              <Phone className="w-3.5 h-3.5" /> {settings.support_phone}
            </a>
          )}
        </div>
        {settings.whatsapp_link && (
          <a
            href={settings.whatsapp_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-emerald-50/70 border border-emerald-150 rounded-2xl p-3"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <WhatsappLogo className="w-4.5 h-4.5" weight="fill" />
            </div>
            <span className="text-[11px] text-emerald-800">
              <span className="font-bold block">Chat on WhatsApp</span>
              Message us on WhatsApp for faster support
            </span>
            <ArrowSquareOut className="w-3.5 h-3.5 text-emerald-600 ml-auto shrink-0" />
          </a>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-900">Legal & Policies</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1">
          <button type="button" onClick={onShowPrivacyPolicy} className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-emerald-600 cursor-pointer">
            <FileText className="w-3.5 h-3.5" /> Privacy Policy
          </button>
          <button type="button" onClick={onShowTermsOfService} className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-emerald-600 cursor-pointer">
            <FileText className="w-3.5 h-3.5" /> Terms of Service
          </button>
          <button type="button" onClick={onShowRefundPolicy} className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-emerald-600 cursor-pointer">
            <FileText className="w-3.5 h-3.5" /> Refund Policy
          </button>
        </div>
      </div>

      <FaqAccordion />
    </div>
  );
}
