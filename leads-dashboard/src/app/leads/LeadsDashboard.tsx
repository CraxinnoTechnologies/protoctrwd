"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Download, Plus, SearchX } from "lucide-react";
import type { FollowUpRow } from "@/lib/db";
import { StatsCards } from "@/app/_components/StatsCards";
import { FilterBar } from "@/app/_components/FilterBar";
import { LeadCard } from "@/app/_components/LeadCard";
import { LeadList } from "@/app/_components/LeadList";
import { FollowUpDialog, type FollowUpDraft } from "@/app/_components/FollowUpDialog";
import { PageHeader } from "@/app/_components/app-shell/PageHeader";
import type { Filter, View } from "@/app/_components/types";

type Counts = { total: number; pending: number; completed: number; overdue: number };

export default function LeadsDashboard({
  initialItems,
  initialCounts,
}: {
  initialItems: FollowUpRow[];
  initialCounts: Counts;
}) {
  const [items, setItems] = useState<FollowUpRow[]>(initialItems);
  const [counts, setCounts] = useState<Counts>(initialCounts);
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("grid");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FollowUpRow | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const v = (localStorage.getItem("ld-view") as View | null) ?? "grid";
      const f = (localStorage.getItem("ld-filter") as Filter | null) ?? "all";
      setView(v);
      setFilter(f);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("ld-view", view);
    } catch {}
  }, [view]);
  useEffect(() => {
    try {
      localStorage.setItem("ld-filter", filter);
    } catch {}
  }, [filter]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/follow-ups", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { items: FollowUpRow[]; counts: Counts };
    setItems(data.items);
    setCounts(data.counts);
  }, []);

  const handleCreateOrUpdate = useCallback(
    async (draft: FollowUpDraft) => {
      setBusy(true);
      try {
        const payload = {
          title: draft.title.trim(),
          contact_name: draft.contact_name.trim(),
          company: draft.company.trim(),
          email: draft.email.trim(),
          phone: draft.phone.trim(),
          due_date: draft.due_date,
          notes: draft.notes.trim(),
        };
        const url = editing ? `/api/follow-ups/${editing.id}` : "/api/follow-ups";
        const method = editing ? "PATCH" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `Request failed (${res.status})`);
        }
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [editing, refresh]
  );

  const handleComplete = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await fetch(`/api/follow-ups/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        });
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Delete this follow-up? This cannot be undone.")) return;
      setBusy(true);
      try {
        await fetch(`/api/follow-ups/${id}`, { method: "DELETE" });
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const handleView = useCallback((lead: FollowUpRow) => {
    setEditing(lead);
    setDialogOpen(true);
  }, []);

  const handleNew = useCallback(() => {
    setEditing(null);
    setDialogOpen(true);
  }, []);

  const handleExport = useCallback(() => {
    const headers = [
      "title",
      "status",
      "contact_name",
      "company",
      "email",
      "phone",
      "due_date",
      "notes",
    ];
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = items.map((i) =>
      headers.map((h) => escape((i as unknown as Record<string, unknown>)[h])).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `follow-ups-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [items]);

  const filtered = useMemo(() => {
    let r = items;
    if (filter !== "all") r = r.filter((l) => l.status === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter((l) =>
        [l.title, l.contact_name, l.company, l.email, l.phone]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    return r;
  }, [items, filter, query]);

  return (
    <>
      <PageHeader
        title="Leads Dashboard"
        subtitle="Track follow-ups and keep every lead moving forward."
        actions={
          <>
            <button
              type="button"
              onClick={handleExport}
              className="h-[34px] px-3 rounded-md border border-border bg-background text-foreground text-[13px] font-medium inline-flex items-center gap-1.5 shadow-xs hover:bg-accent cursor-pointer"
            >
              <Download size={13} /> Export
            </button>
            <button
              type="button"
              onClick={handleNew}
              className="h-[34px] px-3 rounded-md bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-1.5 shadow-xs hover:opacity-90 cursor-pointer"
            >
              <Plus size={13} /> New follow-up
            </button>
          </>
        }
      />

      <StatsCards counts={counts} />

      <FilterBar
        view={view}
        setView={setView}
        filter={filter}
        setFilter={setFilter}
        query={query}
        setQuery={setQuery}
        counts={counts}
      />

      {filtered.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground border border-dashed border-border rounded-[10px] bg-card flex flex-col items-center">
          <SearchX size={22} className="text-muted-foreground mb-2" />
          <div className="font-medium text-foreground mb-1">No follow-ups found</div>
          <div className="text-[13px]">
            {query || filter !== "all"
              ? "Try a different filter or clear your search."
              : "Create your first follow-up to get started."}
          </div>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((l) => (
            <LeadCard
              key={l.id}
              lead={l}
              onComplete={handleComplete}
              onDelete={handleDelete}
              onView={handleView}
            />
          ))}
        </div>
      ) : (
        <LeadList
          leads={filtered}
          onComplete={handleComplete}
          onDelete={handleDelete}
          onView={handleView}
        />
      )}

      {busy && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-foreground text-background text-[12px] px-3 py-1.5 rounded-full shadow-md">
          Saving…
        </div>
      )}

      <FollowUpDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreateOrUpdate}
      />
    </>
  );
}
