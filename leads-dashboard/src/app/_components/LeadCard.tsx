"use client";

import { Calendar, Mail, Phone, ArrowRight, Check, Trash2 } from "lucide-react";
import type { FollowUpRow } from "@/lib/db";
import { StatusBadge } from "./StatusBadge";
import { formatDueDate, initials } from "./utils";

export function LeadCard({
  lead,
  onComplete,
  onDelete,
  onView,
}: {
  lead: FollowUpRow;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onView: (lead: FollowUpRow) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden transition hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08),0_2px_4px_-2px_rgba(0,0,0,0.08)]">
      <div className="flex justify-between items-center px-3.5 py-2.5 border-b border-border text-[11.5px] text-muted-foreground">
        <span className="font-mono font-medium inline-flex items-center gap-1.5">
          <Calendar size={12} /> {formatDueDate(lead.due_date)}
        </span>
        <StatusBadge status={lead.status} />
      </div>
      <div className="px-3.5 pt-3 pb-2 flex flex-col gap-1.5">
        <div className="text-[14px] font-semibold tracking-[-0.005em] truncate" title={lead.title}>
          {lead.title}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-100 dark:from-zinc-800 dark:to-zinc-900 text-foreground text-[11px] font-semibold inline-flex items-center justify-center">
            {initials(lead.contact_name)}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium leading-tight truncate">
              {lead.contact_name}
            </div>
            <div className="text-[11.5px] text-muted-foreground leading-tight truncate">
              {lead.company || "—"}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1 px-3.5 pt-1.5 pb-2.5 text-[12px] text-muted-foreground">
        <div className="flex items-center gap-1.5 min-w-0">
          <Mail size={12} className="shrink-0" />
          <span className="truncate">{lead.email || "—"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Phone size={12} className="shrink-0" /> {lead.phone || "—"}
        </div>
      </div>
      <div className="flex justify-end items-center gap-1 px-2.5 py-2 border-t border-border bg-zinc-50 dark:bg-[#0f0f11]">
        {lead.status !== "completed" && (
          <button
            type="button"
            onClick={() => onComplete(lead.id)}
            className="h-7 px-2.5 rounded-md border-0 bg-transparent text-muted-foreground text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer hover:bg-accent hover:text-foreground"
          >
            <Check size={12} /> Complete
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(lead.id)}
          className="h-7 px-2.5 rounded-md border-0 bg-transparent text-muted-foreground text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer hover:bg-accent hover:text-foreground"
        >
          <Trash2 size={12} /> Delete
        </button>
        <button
          type="button"
          onClick={() => onView(lead)}
          className="h-7 px-2.5 rounded-md border-0 bg-foreground text-background text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90"
        >
          View <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}
