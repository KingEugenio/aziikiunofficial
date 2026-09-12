import React from "react";
import { motion } from "motion/react";
import { Check, type Icon } from "@phosphor-icons/react";

interface QuestionCardProps {
  label: string;
  icon?: Icon;
  selected?: boolean;
  onSelect: () => void;
  index?: number;
}

/** A single-tap answer card. Selecting it is the entire interaction - no
 * separate "confirm" step, no form fields. */
export default function QuestionCard({ label, icon: OptionIcon, selected, onSelect, index = 0 }: QuestionCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05, ease: "easeOut" }}
      whileTap={{ scale: 0.97 }}
      className={`w-full flex items-center gap-3 text-left px-4 py-3.5 rounded-2xl border-2 transition-colors cursor-pointer font-sans ${
        selected
          ? "border-[color:var(--color-onboard-teal)] bg-[color:var(--color-onboard-teal)]/10"
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-[color:var(--color-onboard-teal)]/40 hover:bg-[color:var(--color-onboard-cream)]"
      }`}
    >
      {OptionIcon && (
        <span
          className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
            selected ? "bg-[color:var(--color-onboard-teal)]/15 text-[color:var(--color-onboard-teal)]" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
          }`}
        >
          <OptionIcon className="w-4.5 h-4.5" weight="bold" />
        </span>
      )}
      <span
        className={`text-sm font-semibold ${
          selected ? "text-[color:var(--color-onboard-teal)]" : "text-slate-700 dark:text-slate-300"
        }`}
      >
        {label}
      </span>
      {selected && (
        <span className="ml-auto w-5 h-5 rounded-full bg-[color:var(--color-onboard-teal)] text-white flex items-center justify-center shrink-0">
          <Check className="w-3 h-3" weight="bold" />
        </span>
      )}
    </motion.button>
  );
}
