"use client";

import { List, LayoutGrid, Search } from "lucide-react";
import type { Filter, View } from "./types";

type Counts = { total: number; pending: number; completed: number; overdue: number };

export function FilterBar({
  view,
  setView,
  filter,
  setFilter,
  query,
  setQuery,
  counts,
}: {
  view: View;
  setView: (v: View) => void;
  filter: Filter;
  setFilter: (f: Filter) => void;
  query: string;
  setQuery: (q: string) => void;
  counts: Counts;
}) {
  return (
    <div className="flex items-center gap-2.5 flex-wrap mb-3.5">
      <div>
        <div className="text-[15px] font-semibold">Follow Ups</div>
        <div className="text-[12.5px] text-muted-foreground">
          Upcoming and overdue follow-ups for your leads.
        </div>
      </div>
      <div className="flex-1" />
      <div className="relative flex-1 min-w-[200px] max-w-[360px]">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground inline-flex">
          <Search size={14} />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search leads, contacts, companies…"
          className="h-[34px] w-full pl-8 pr-3 rounded-md border border-input bg-background text-foreground text-[13.5px] shadow-xs outline-none focus:border-ring focus:ring-[3px] focus:ring-foreground/20"
        />
      </div>
      <TabGroup>
        <TabBtn active={view === "list"} onClick={() => setView("list")}>
          <List size={13} /> List
        </TabBtn>
        <TabBtn active={view === "grid"} onClick={() => setView("grid")}>
          <LayoutGrid size={13} /> Grid
        </TabBtn>
      </TabGroup>
      <TabGroup>
        {(
          [
            { k: "all", label: "All", count: counts.total },
            { k: "pending", label: "Pending", count: counts.pending },
            { k: "completed", label: "Completed", count: counts.completed },
            { k: "overdue", label: "Overdue", count: counts.overdue },
          ] as const
        ).map((t) => (
          <TabBtn key={t.k} active={filter === t.k} onClick={() => setFilter(t.k)}>
            {t.label}{" "}
            <span className="text-[11px] tabular-nums text-muted-foreground ml-0.5">
              ({t.count})
            </span>
          </TabBtn>
        ))}
      </TabGroup>
    </div>
  );
}

function TabGroup({ children }: { children: React.ReactNode }) {
  return <div className="inline-flex p-[3px] rounded-lg bg-muted gap-0.5">{children}</div>;
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-0 font-medium text-[12.5px] px-3 py-1.5 rounded-md cursor-pointer inline-flex items-center gap-1.5 ${
        active
          ? "bg-background text-foreground shadow-xs dark:bg-[#1b1b1f]"
          : "bg-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
