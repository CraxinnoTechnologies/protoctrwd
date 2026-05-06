"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutGrid,
  SlidersHorizontal,
  ShoppingBag,
  Truck,
  ClipboardList,
  FileText,
  Users,
  UserRound,
  Settings,
  LogOut,
  ChevronDown,
  Sparkle,
  type LucideIcon,
} from "lucide-react";

type Sub = { label: string; href: string };
type Item = {
  icon: LucideIcon;
  label: string;
  href?: string;
  children?: Sub[];
};

const NAV: Item[] = [
  { icon: LayoutGrid, label: "Dashboard", href: "/dashboard" },
  { icon: SlidersHorizontal, label: "FMS", href: "/fms" },
  {
    icon: ShoppingBag,
    label: "Orders",
    children: [
      { label: "Portal Orders", href: "/orders/portal" },
      { label: "Web Orders", href: "/orders/web" },
      { label: "Stock Orders", href: "/orders/stock" },
      { label: "Order Requests", href: "/orders/requests" },
    ],
  },
  {
    icon: Truck,
    label: "Vendors",
    children: [
      { label: "All Vendors", href: "/vendors" },
      { label: "Vendor Catalog", href: "/vendors/catalog" },
    ],
  },
  {
    icon: ClipboardList,
    label: "Inventory",
    children: [
      { label: "Stock", href: "/inventory/stock" },
      { label: "Transfers", href: "/inventory/transfers" },
    ],
  },
  {
    icon: FileText,
    label: "Reports",
    children: [
      { label: "Sales", href: "/reports/sales" },
      { label: "Production", href: "/reports/production" },
    ],
  },
  { icon: Users, label: "Customers", href: "/customers" },
  {
    icon: Sparkle,
    label: "Leads",
    children: [{ label: "Follow-ups", href: "/leads" }],
  },
  {
    icon: UserRound,
    label: "Team Workers",
    children: [{ label: "All Workers", href: "/team" }],
  },
  {
    icon: Settings,
    label: "Settings",
    children: [
      { label: "General", href: "/settings" },
      { label: "Billing", href: "/settings/billing" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  const initiallyOpen = (() => {
    const open: Record<string, boolean> = {};
    for (const it of NAV) {
      if (it.children?.some((s) => pathname.startsWith(s.href))) open[it.label] = true;
    }
    return open;
  })();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(initiallyOpen);
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const it of NAV) {
        if (it.children?.some((s) => pathname.startsWith(s.href))) next[it.label] = true;
      }
      return next;
    });
  }, [pathname]);

  const toggle = (label: string) =>
    setOpenGroups((g) => ({ ...g, [label]: !g[label] }));

  return (
    <div className="flex flex-col h-full w-full p-3 text-[13px]">
      <Brand />
      <div className="px-2.5 pt-3 pb-1.5 text-muted-foreground text-[11px] font-medium tracking-[0.06em] uppercase">
        Menu
      </div>
      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {NAV.map((it) =>
          it.children ? (
            <NavGroup
              key={it.label}
              item={it}
              open={!!openGroups[it.label]}
              onToggle={() => toggle(it.label)}
              pathname={pathname}
            />
          ) : (
            <NavLink key={it.label} icon={it.icon} label={it.label} href={it.href!} active={pathname === it.href} />
          )
        )}
      </nav>
      <div className="pt-3 mt-2 border-t border-border">
        <button
          type="button"
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer text-left"
        >
          <LogOut size={14} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="px-1.5 pt-1 pb-2.5 flex items-center gap-2.5">
      <div
        className="w-10 h-10 rounded-full inline-flex items-center justify-center shrink-0 ring-2 ring-yellow-400/80 dark:ring-yellow-500/70"
        style={{ background: "linear-gradient(135deg,#1f3a8a,#1e3a8a 60%,#1d4ed8)" }}
      >
        <span className="font-display font-extrabold text-white tracking-[0.02em] text-[12px] leading-none">
          RWD
        </span>
      </div>
      <div className="flex flex-col leading-tight">
        <span className="font-display font-extrabold text-[14px] tracking-[0.04em]">RWD</span>
        <span className="text-[10.5px] text-muted-foreground tracking-[0.04em] uppercase">
          Operations
        </span>
      </div>
    </div>
  );
}

function NavLink({
  icon: Icon,
  label,
  href,
  active,
  trailing,
}: {
  icon: LucideIcon;
  label: string;
  href: string;
  active: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md select-none text-[13px] ${
        active
          ? "bg-foreground text-background font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      <Icon size={14} className="shrink-0" />
      <span className="flex-1">{label}</span>
      {trailing}
    </Link>
  );
}

function NavGroup({
  item,
  open,
  onToggle,
  pathname,
}: {
  item: Item;
  open: boolean;
  onToggle: () => void;
  pathname: string;
}) {
  const Icon = item.icon;
  const isActiveBranch = item.children?.some((s) => pathname.startsWith(s.href)) ?? false;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md select-none cursor-pointer w-full text-left text-[13px] ${
          isActiveBranch
            ? "bg-foreground text-background font-medium"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
      >
        <Icon size={14} className="shrink-0" />
        <span className="flex-1">{item.label}</span>
        <ChevronDown
          size={13}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && item.children && (
        <div className="flex flex-col gap-px mt-1 mb-1.5 ml-3 pl-3 border-l border-border">
          {item.children.map((s) => {
            const active = pathname === s.href || pathname.startsWith(s.href + "/");
            return (
              <Link
                key={s.href}
                href={s.href}
                className={`flex items-center gap-2 pl-2 pr-2 py-1.5 rounded-md text-[12.5px] ${
                  active
                    ? "bg-zinc-200 dark:bg-zinc-800 text-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <span
                  className={`w-1 h-1 rounded-full ${active ? "bg-foreground" : "bg-zinc-400 dark:bg-zinc-600"}`}
                />
                {s.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
