"use client";

import { Phone, Mail, Check, Trash2, Eye } from "lucide-react";
import type { FollowUpRow } from "@/lib/db";
import { StatusBadge } from "./StatusBadge";
import { formatDueDate } from "./utils";

const HEADERS = ["Follow-up", "Contact", "Email / Phone", "Date", "Status"];

export function LeadList({
  leads,
  onComplete,
  onDelete,
  onView,
}: {
  leads: FollowUpRow[];
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onView: (lead: FollowUpRow) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-[10px] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {HEADERS.map((h) => (
                <th
                  key={h}
                  className="text-left px-3.5 py-2.5 bg-zinc-50 dark:bg-[#0f0f11] border-b border-border font-medium text-muted-foreground text-[11.5px] tracking-[0.04em] uppercase whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
              <th className="text-right px-3.5 py-2.5 bg-zinc-50 dark:bg-[#0f0f11] border-b border-border font-medium text-muted-foreground text-[11.5px] tracking-[0.04em] uppercase whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="hover:bg-accent border-b border-border last:border-0">
                <td className="px-3.5 py-3 align-middle">
                  <div className="font-semibold">{l.title}</div>
                </td>
                <td className="px-3.5 py-3 align-middle">
                  <div className="font-semibold">{l.contact_name}</div>
                  <div className="text-muted-foreground text-[12px]">{l.company || "—"}</div>
                </td>
                <td className="px-3.5 py-3 align-middle">
                  <div className="text-muted-foreground text-[12.5px] inline-flex items-center gap-1.5">
                    <Mail size={11} />
                    {l.email || "—"}
                  </div>
                  <div className="text-muted-foreground text-[12.5px] inline-flex items-center gap-1.5">
                    <Phone size={11} />
                    {l.phone || "—"}
                  </div>
                </td>
                <td className="px-3.5 py-3 align-middle text-muted-foreground font-mono text-[12px] whitespace-nowrap">
                  {formatDueDate(l.due_date)}
                </td>
                <td className="px-3.5 py-3 align-middle">
                  <StatusBadge status={l.status} />
                </td>
                <td className="px-3.5 py-3 align-middle">
                  <div className="flex gap-0.5 justify-end">
                    <IconBtn title="View" onClick={() => onView(l)}>
                      <Eye size={13} />
                    </IconBtn>
                    {l.status !== "completed" && (
                      <IconBtn title="Mark complete" onClick={() => onComplete(l.id)}>
                        <Check size={13} />
                      </IconBtn>
                    )}
                    <IconBtn title="Delete" onClick={() => onDelete(l.id)}>
                      <Trash2 size={13} />
                    </IconBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-[26px] h-[26px] inline-flex items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground cursor-pointer hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}
