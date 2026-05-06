"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  RefreshCw,
  Eye,
  Pencil,
  Archive,
  PackageCheck,
  PackageOpen,
  Save,
  CalendarClock,
  CookingPot,
  Ship,
  FolderX,
  ChevronsUpDown,
  Trash2,
  ArchiveRestore,
} from "lucide-react";
import type { OrderChannel, OrderRow, OrderStatus } from "@/lib/db";
import { ORDER_STATUS_LABEL, statusBadgeClass } from "./status";
import { PageHeader } from "../app-shell/PageHeader";

const channelSlug = (c: OrderChannel) => (c === "request" ? "requests" : c);

type Counts = Record<OrderStatus | "all" | "archived", number>;

type Tab =
  | { kind: "status"; key: OrderStatus | "all" }
  | { kind: "archived" };

const TABS: { tab: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { tab: { kind: "status", key: "all" }, label: "All Orders", icon: PackageOpen },
  { tab: { kind: "status", key: "waiting_for_scheduling" }, label: "Waiting for Scheduling", icon: Save },
  { tab: { kind: "status", key: "scheduled_for_production" }, label: "Scheduled for Production", icon: CalendarClock },
  { tab: { kind: "status", key: "in_production" }, label: "In Production", icon: CookingPot },
  { tab: { kind: "status", key: "shipped" }, label: "Shipped", icon: Ship },
  { tab: { kind: "status", key: "void" }, label: "Void", icon: FolderX },
  { tab: { kind: "archived" }, label: "Archived Orders", icon: Archive },
];

type SortKey = "order_date" | "amount" | "status" | "company";

export function OrdersView({
  channel,
  channelLabel,
  title,
  subtitle,
}: {
  channel: OrderChannel;
  channelLabel: string;
  title: string;
  subtitle?: string;
}) {
  const [items, setItems] = useState<OrderRow[]>([]);
  const [counts, setCounts] = useState<Counts>({
    all: 0,
    archived: 0,
    waiting_for_scheduling: 0,
    scheduled_for_production: 0,
    in_production: 0,
    shipped: 0,
    void: 0,
  });
  const [activeTab, setActiveTab] = useState<Tab>({ kind: "status", key: "all" });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("order_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders?channel=${channel}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: OrderRow[]; counts: Counts };
      setItems(data.items);
      setCounts(data.counts);
    } finally {
      setLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let r = items;

    if (activeTab.kind === "archived") {
      r = r.filter((o) => o.archived === 1);
    } else {
      r = r.filter((o) => o.archived === 0);
      if (activeTab.key !== "all") r = r.filter((o) => o.status === activeTab.key);
    }

    if (q) {
      r = r.filter((o) =>
        [o.order_number, o.po_number, o.company, o.customer]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    const dir = sortDir === "asc" ? 1 : -1;
    return [...r].sort((a, b) => {
      switch (sortKey) {
        case "amount":
          return (a.amount - b.amount) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
        case "company":
          return a.company.localeCompare(b.company) * dir;
        case "order_date":
        default:
          return a.order_date.localeCompare(b.order_date) * dir;
      }
    });
  }, [items, activeTab, query, sortKey, sortDir]);

  const handleArchive = async (row: OrderRow) => {
    setBusy(true);
    try {
      await fetch(`/api/orders/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: row.archived === 0 }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleShip = async (row: OrderRow) => {
    setBusy(true);
    try {
      await fetch(`/api/orders/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "shipped" }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (row: OrderRow) => {
    if (!confirm(`Permanently delete order ${row.order_number}?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/orders/${row.id}`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (row: OrderRow, status: OrderStatus) => {
    if (status === row.status) return;
    setBusy(true);
    try {
      await fetch(`/api/orders/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const tabCount = (tab: Tab): number => {
    if (tab.kind === "archived") return counts.archived;
    if (tab.key === "all") return counts.all;
    return counts[tab.key];
  };

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 mb-4">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground inline-flex">
            <Search size={15} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by order ID, PO, company or customer…"
            className="h-11 w-full pl-9 pr-3 rounded-lg border border-input bg-background text-foreground text-[14px] shadow-xs outline-none focus:border-ring focus:ring-[3px] focus:ring-foreground/20"
          />
        </div>
        <Link
          href={`/orders/${channelSlug(channel)}/new`}
          className="h-11 px-4 rounded-lg bg-primary text-primary-foreground text-[13.5px] font-semibold inline-flex items-center gap-2 shadow-xs hover:opacity-90 cursor-pointer whitespace-nowrap"
        >
          <Plus size={15} /> Add New Order
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 overflow-x-auto">
          <div className="inline-flex items-center gap-0.5 min-w-max">
            {TABS.map(({ tab, label, icon: Icon }) => {
              const isActive =
                (tab.kind === "archived" && activeTab.kind === "archived") ||
                (tab.kind === "status" &&
                  activeTab.kind === "status" &&
                  tab.key === activeTab.key);
              const count = tabCount(tab);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`h-9 px-3.5 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium transition cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                  <span
                    className={`tabular-nums text-[11px] ${
                      isActive ? "opacity-80" : "text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          title="Refresh"
          className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-md bg-foreground text-background hover:opacity-90 cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="bg-card border border-border rounded-[10px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <Th>Order ID</Th>
                <Th align="right">Total Boxes</Th>
                <Th sortable active={sortKey === "company"} dir={sortDir} onClick={() => toggleSort("company")}>
                  Company Name
                </Th>
                <Th>Customer Name</Th>
                <Th sortable active={sortKey === "order_date"} dir={sortDir} onClick={() => toggleSort("order_date")}>
                  Order Date
                </Th>
                <Th align="right" sortable active={sortKey === "amount"} dir={sortDir} onClick={() => toggleSort("amount")}>
                  Amount
                </Th>
                <Th sortable active={sortKey === "status"} dir={sortDir} onClick={() => toggleSort("status")}>
                  Status
                </Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3.5 py-12 text-center text-muted-foreground text-[13px]"
                  >
                    {query
                      ? "No orders match your search."
                      : "No orders in this view yet."}
                  </td>
                </tr>
              ) : (
                filtered.map((o) => (
                  <tr
                    key={o.id}
                    className="hover:bg-accent border-b border-border last:border-0"
                  >
                    <td className="px-3.5 py-3 align-middle">
                      <div className="font-semibold tabular-nums">{o.order_number}</div>
                      <div className="text-muted-foreground text-[11.5px] mt-0.5">
                        {o.po_number ? `PO: ${o.po_number}` : "N/A"}
                      </div>
                    </td>
                    <td className="px-3.5 py-3 align-middle text-right tabular-nums">
                      {o.total_boxes}
                    </td>
                    <td className="px-3.5 py-3 align-middle">{o.company}</td>
                    <td className="px-3.5 py-3 align-middle">{o.customer}</td>
                    <td className="px-3.5 py-3 align-middle text-muted-foreground font-mono text-[12.5px] whitespace-nowrap">
                      {formatDate(o.order_date)}
                    </td>
                    <td className="px-3.5 py-3 align-middle text-right tabular-nums font-medium">
                      ${o.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3.5 py-3 align-middle">
                      <StatusSelect
                        value={o.status}
                        onChange={(s) => handleStatusChange(o, s)}
                      />
                    </td>
                    <td className="px-3.5 py-3 align-middle">
                      <div className="flex gap-0.5 justify-end">
                        <IconLink title="View" href={`/orders/${channelSlug(channel)}/${o.id}`}>
                          <Eye size={14} />
                        </IconLink>
                        <IconLink title="Edit" href={`/orders/${channelSlug(channel)}/${o.id}`}>
                          <Pencil size={14} />
                        </IconLink>
                        <IconBtn
                          title={o.archived === 1 ? "Restore" : "Archive"}
                          onClick={() => handleArchive(o)}
                        >
                          {o.archived === 1 ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                        </IconBtn>
                        {o.status !== "shipped" && o.archived === 0 && (
                          <IconBtn title="Mark shipped" onClick={() => handleShip(o)}>
                            <PackageCheck size={14} />
                          </IconBtn>
                        )}
                        <IconBtn title="Delete" onClick={() => handleDelete(o)}>
                          <Trash2 size={14} />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {busy && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-foreground text-background text-[12px] px-3 py-1.5 rounded-full shadow-md">
          Saving…
        </div>
      )}
    </>
  );
}

function IconLink({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      title={title}
      href={href}
      className="w-[28px] h-[28px] inline-flex items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </Link>
  );
}

function Th({
  children,
  align = "left",
  sortable,
  active,
  dir,
  onClick,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  sortable?: boolean;
  active?: boolean;
  dir?: "asc" | "desc";
  onClick?: () => void;
}) {
  return (
    <th
      onClick={sortable ? onClick : undefined}
      className={`${align === "right" ? "text-right" : "text-left"} ${
        sortable ? "cursor-pointer select-none" : ""
      } px-3.5 py-2.5 bg-zinc-50 dark:bg-[#0f0f11] border-b border-border font-medium text-muted-foreground text-[11.5px] tracking-[0.04em] uppercase whitespace-nowrap`}
    >
      <span className="inline-flex items-center gap-1.5">
        {children}
        {sortable && (
          <ChevronsUpDown
            size={12}
            className={active ? "text-foreground" : "opacity-60"}
            style={active && dir === "asc" ? { transform: "rotate(180deg)" } : undefined}
          />
        )}
      </span>
    </th>
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
      className="w-[28px] h-[28px] inline-flex items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground cursor-pointer hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: OrderStatus;
  onChange: (s: OrderStatus) => void;
}) {
  return (
    <div className={`relative inline-block`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as OrderStatus)}
        className={`appearance-none pr-7 pl-2.5 h-7 rounded-full border text-[11.5px] font-medium cursor-pointer outline-none focus:ring-[3px] focus:ring-foreground/20 ${statusBadgeClass(value)}`}
      >
        {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((s) => (
          <option key={s} value={s} className="bg-background text-foreground">
            {ORDER_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <ChevronsUpDown
        size={11}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-70"
      />
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()}`;
}
