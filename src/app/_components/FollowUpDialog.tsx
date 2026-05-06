"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { FollowUpRow } from "@/lib/db";
import { todayISO } from "./utils";

export type FollowUpDraft = {
  title: string;
  contact_name: string;
  company: string;
  email: string;
  phone: string;
  due_date: string;
  notes: string;
};

const EMPTY: FollowUpDraft = {
  title: "",
  contact_name: "",
  company: "",
  email: "",
  phone: "",
  due_date: "",
  notes: "",
};

export function FollowUpDialog({
  open,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial?: FollowUpRow | null;
  onClose: () => void;
  onSubmit: (draft: FollowUpDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<FollowUpDraft>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setDraft({
        title: initial.title,
        contact_name: initial.contact_name,
        company: initial.company ?? "",
        email: initial.email ?? "",
        phone: initial.phone ?? "",
        due_date: initial.due_date,
        notes: initial.notes ?? "",
      });
    } else {
      setDraft({ ...EMPTY, due_date: todayISO() });
    }
    setError(null);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = <K extends keyof FollowUpDraft>(k: K, v: FollowUpDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim() || !draft.contact_name.trim() || !draft.due_date) {
      setError("Title, contact name and due date are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(draft);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-[520px] bg-card text-foreground border border-border rounded-[12px] shadow-lg overflow-hidden"
      >
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[15px] font-semibold">
              {initial ? "Edit follow-up" : "New follow-up"}
            </div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              {initial ? "Update the details below." : "Track a task tied to a lead."}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground bg-transparent border-0 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3.5">
          <Field label="Title" required className="col-span-2">
            <input
              autoFocus
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Send quote, Follow-up call"
              className={inputCls}
            />
          </Field>
          <Field label="Contact name" required>
            <input
              value={draft.contact_name}
              onChange={(e) => set("contact_name", e.target.value)}
              placeholder="John Smith"
              className={inputCls}
            />
          </Field>
          <Field label="Company">
            <input
              value={draft.company}
              onChange={(e) => set("company", e.target.value)}
              placeholder="Acme Inc."
              className={inputCls}
            />
          </Field>
          <Field label="Email">
            <input
              value={draft.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="john@acme.com"
              type="email"
              className={inputCls}
            />
          </Field>
          <Field label="Phone">
            <input
              value={draft.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+1 555 010 0000"
              className={inputCls}
            />
          </Field>
          <Field label="Due date" required className="col-span-2">
            <input
              type="date"
              value={draft.due_date}
              onChange={(e) => set("due_date", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Notes" className="col-span-2">
            <textarea
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              placeholder="Anything to remember…"
              className={`${inputCls} resize-y min-h-[68px] py-2`}
            />
          </Field>
          {error && (
            <div className="col-span-2 text-[12.5px] text-red-600 dark:text-red-400">{error}</div>
          )}
        </div>
        <div className="px-5 py-3.5 border-t border-border flex items-center justify-end gap-2 bg-zinc-50 dark:bg-[#0f0f11]">
          <button
            type="button"
            onClick={onClose}
            className="h-[34px] px-3 rounded-md border border-border bg-background text-foreground text-[13px] font-medium cursor-pointer hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="h-[34px] px-3.5 rounded-md bg-primary text-primary-foreground text-[13px] font-medium cursor-pointer hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "Saving…" : initial ? "Save changes" : "Create follow-up"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "h-[34px] w-full px-3 rounded-md border border-input bg-background text-foreground text-[13.5px] shadow-xs outline-none focus:border-ring focus:ring-[3px] focus:ring-foreground/20";

function Field({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[12px] font-medium text-muted-foreground">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
