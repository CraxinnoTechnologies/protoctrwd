"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  CreditCard,
  Edit,
  Download,
  MapPin,
  Package,
  Receipt,
  ShoppingBag,
  User,
  History,
  GitBranch,
  Trash2,
  Plus,
} from "lucide-react";
import type {
  OrderChannel,
  OrderHistoryRow,
  OrderItemRow,
  OrderRow,
  OrderStatus,
  PaymentStatus,
} from "@/lib/db";
import { ORDER_STATUS_LABEL, ORDER_STATUS_OPTIONS, statusBadgeClass } from "./status";

type Detail = { order: OrderRow; items: OrderItemRow[]; history: OrderHistoryRow[] };

export function OrderDetailView({
  channel,
  orderId,
}: {
  channel: OrderChannel;
  orderId: string;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 404) setDetail(null);
        return;
      }
      const data = (await res.json()) as Detail;
      setDetail(data);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as Detail;
        setDetail(data);
        setSaveMsg("Saved");
        setTimeout(() => setSaveMsg(null), 1400);
      } finally {
        setBusy(false);
      }
    },
    [orderId]
  );

  const handleDelete = async () => {
    if (!confirm("Permanently delete this order?")) return;
    setBusy(true);
    try {
      await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      router.push(`/orders/${channelSlug(channel)}`);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !detail) {
    return (
      <div className="py-20 text-center text-muted-foreground text-sm">Loading order…</div>
    );
  }
  if (!detail) {
    return (
      <div className="py-20 text-center">
        <div className="font-medium text-foreground mb-2">Order not found</div>
        <Link
          href={`/orders/${channelSlug(channel)}`}
          className="text-[13px] text-muted-foreground underline underline-offset-2"
        >
          Back to orders
        </Link>
      </div>
    );
  }

  const { order, items, history } = detail;
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalBoxes = items.reduce((s, i) => s + i.quantity, 0);
  const tax = order.tax;
  const shipping = order.add_shipping_cost ? order.shipping_cost : 0;
  const total = subtotal - order.discount + tax + shipping;

  return (
    <div className="flex flex-col gap-5">
      <BackLink channel={channel} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-border">
        <div>
          <div className="text-[20px] sm:text-[22px] font-semibold tracking-[-0.015em]">
            Order ID:{" "}
            <span className="font-mono">#{order.order_number}</span>
          </div>
          <div className="text-muted-foreground text-[13px] mt-0.5 font-mono">
            {formatLong(order.order_date)}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PaymentPill status={order.payment_status} />
          {order.payment_status !== "paid" && (
            <button
              type="button"
              onClick={() => patch({ payment_status: "paid", mark_as_paid: true })}
              className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-1.5 shadow-xs hover:opacity-90 cursor-pointer"
            >
              <CreditCard size={13} /> Pay Now
            </button>
          )}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-1.5 shadow-xs hover:opacity-90 cursor-pointer"
          >
            <Edit size={13} /> Edit
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-1.5 shadow-xs hover:opacity-90 cursor-pointer"
          >
            <Download size={13} /> Print Packing Slip PDF
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-1.5 shadow-xs hover:opacity-90 cursor-pointer"
          >
            <Download size={13} /> Print Order Details PDF
          </button>
        </div>
      </div>

      <div>
        <div className="text-[20px] font-semibold tracking-[-0.01em]">{order.company}</div>
        <div className="text-muted-foreground text-[12.5px]">Company Name</div>
      </div>

      <Section>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <CustomerCard order={order} onPatch={patch} />
          <OrderInfoCard order={order} onPatch={patch} />
          <BillingCard order={order} onPatch={patch} />
        </div>
      </Section>

      <Section>
        <CardHeader icon={<MapPin size={14} />} title="Addresses" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <AddressEditor
            label="Billing Address"
            value={order.billing_address}
            onSave={(v) => patch({ billing_address: v })}
          />
          <AddressEditor
            label="Shipping Address"
            value={order.shipping_address}
            onSave={(v) => patch({ shipping_address: v })}
          />
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <OrderStatusCard order={order} onPatch={patch} />
        <ShippingCard order={order} onPatch={patch} />
      </div>

      <ProductsCard
        orderId={order.id}
        items={items}
        subtotal={subtotal}
        totalBoxes={totalBoxes}
        onChange={refresh}
      />

      <TotalsCard
        order={order}
        subtotal={subtotal}
        tax={tax}
        shipping={shipping}
        total={total}
      />

      <HistoryCard history={history} />

      <div className="flex justify-end pt-3 pb-6 border-t border-border">
        <button
          type="button"
          onClick={handleDelete}
          className="h-9 px-3.5 rounded-md border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-[13px] font-medium inline-flex items-center gap-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
        >
          <Trash2 size={13} /> Delete order
        </button>
      </div>

      {(busy || saveMsg) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-foreground text-background text-[12px] px-3 py-1.5 rounded-full shadow-md">
          {busy ? "Saving…" : saveMsg}
        </div>
      )}
    </div>
  );
}

function channelSlug(c: OrderChannel) {
  return c === "request" ? "requests" : c;
}

function BackLink({ channel }: { channel: OrderChannel }) {
  return (
    <Link
      href={`/orders/${channelSlug(channel)}`}
      className="inline-flex items-center gap-2 text-[14px] text-foreground hover:text-foreground"
    >
      <span className="w-8 h-8 inline-flex items-center justify-center rounded-full border border-border bg-background">
        <ChevronLeft size={15} />
      </span>
      <span className="font-semibold">View Order Details</span>
    </Link>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-zinc-50 dark:bg-[#0f0f11] border border-border rounded-[12px] p-4 sm:p-5">
      {children}
    </div>
  );
}

function CardHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-card border border-border text-foreground">
        {icon}
      </span>
      <span className="text-[14px] font-semibold">{title}</span>
    </div>
  );
}

function PaymentPill({ status }: { status: PaymentStatus }) {
  const cls =
    status === "paid"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
      : status === "refunded"
        ? "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
        : "border-red-400 bg-transparent text-red-600 dark:border-red-900 dark:text-red-400";
  return (
    <span
      className={`h-9 px-4 inline-flex items-center justify-center rounded-md border text-[13px] font-medium capitalize ${cls}`}
    >
      {status}
    </span>
  );
}

// ----- Customer card -----
function CustomerCard({
  order,
  onPatch,
}: {
  order: OrderRow;
  onPatch: (b: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <div>
      <CardHeader icon={<User size={14} />} title="Customer" />
      <Row label="Name">
        <InlineText
          value={order.customer}
          onSave={(v) => onPatch({ customer: v })}
          required
        />
      </Row>
      <Row label="Company">
        <InlineText value={order.company} onSave={(v) => onPatch({ company: v })} required />
      </Row>
    </div>
  );
}

function OrderInfoCard({
  order,
  onPatch,
}: {
  order: OrderRow;
  onPatch: (b: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <div>
      <CardHeader icon={<ShoppingBag size={14} />} title="Order Info" />
      <Row label="Order Date">
        <InlineDate value={order.order_date} onSave={(v) => onPatch({ order_date: v })} />
      </Row>
      <Row label="Shipping Status">
        <span className="text-[13px] font-medium">
          {ORDER_STATUS_LABEL[order.status]}
        </span>
      </Row>
      <Row label="Order Status">
        <select
          value={order.status}
          onChange={(e) => onPatch({ status: e.target.value as OrderStatus })}
          className={`appearance-none pr-7 pl-2.5 h-7 rounded-md border text-[12.5px] font-medium cursor-pointer outline-none focus:ring-[3px] focus:ring-foreground/20 ${statusBadgeClass(order.status)}`}
        >
          {ORDER_STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value} className="bg-background text-foreground">
              {s.label}
            </option>
          ))}
        </select>
      </Row>
      <Toggle
        label="Send Email with Status Update"
        checked={!!order.send_email_status}
        onChange={(v) => onPatch({ send_email_status: v })}
        compact
      />
      <Toggle
        label="Freight"
        checked={!!order.freight}
        onChange={(v) => onPatch({ freight: v })}
      />
      <Toggle
        label="Plain box"
        checked={!!order.plain_box}
        onChange={(v) => onPatch({ plain_box: v })}
      />
    </div>
  );
}

function BillingCard({
  order,
  onPatch,
}: {
  order: OrderRow;
  onPatch: (b: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <div>
      <CardHeader icon={<Receipt size={14} />} title="Billing Information" />
      <Row label="Payment term">
        <InlineSelect
          value={order.payment_term ?? "Credit Card"}
          options={["Credit Card", "ACH", "Check", "Wire", "Net 30"]}
          onSave={(v) => onPatch({ payment_term: v })}
        />
      </Row>
      <Row label="Tax">
        <span className="text-[13px] font-medium tabular-nums">
          ${order.tax.toFixed(2)}
        </span>
      </Row>
      <Row label="Discount Price">
        <InlineMoney
          value={order.discount}
          onSave={(v) => onPatch({ discount: v })}
        />
      </Row>
      <Row label="PO No.">
        <InlineText
          value={order.po_number ?? ""}
          onSave={(v) => onPatch({ po_number: v || null })}
        />
      </Row>
      <YesNo
        label="Send Order Confirmation"
        checked={!!order.send_order_confirmation}
        onChange={(v) => onPatch({ send_order_confirmation: v })}
      />
      <YesNo
        label="Mark as Paid"
        checked={!!order.mark_as_paid}
        onChange={(v) =>
          onPatch({ mark_as_paid: v, payment_status: v ? "paid" : "pending" })
        }
      />
      <YesNo
        label="Bill to Parent Company"
        checked={!!order.bill_to_parent}
        onChange={(v) => onPatch({ bill_to_parent: v })}
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_1.4fr] gap-3 py-1.5 items-center min-h-[28px]">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <span className="text-[13px] text-foreground">{children}</span>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  compact,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 ${compact ? "" : "border-t border-border mt-1.5 pt-2"}`}
    >
      <span className="text-[12.5px] font-medium">{label}</span>
      {compact ? (
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 cursor-pointer accent-foreground"
        />
      ) : (
        <Switch checked={checked} onChange={onChange} />
      )}
    </div>
  );
}

function YesNo({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-1.5">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 cursor-pointer accent-foreground"
      />
      <span className="text-[12.5px] font-medium w-7 text-right">{checked ? "Yes" : "No"}</span>
    </div>
  );
}

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition cursor-pointer ${
        checked ? "bg-foreground" : "bg-zinc-300 dark:bg-zinc-700"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-background transition transform ${
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

// ----- Inline editors -----
function InlineText({
  value,
  onSave,
  required,
}: {
  value: string;
  onSave: (v: string) => void;
  required?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (required && !v.trim()) {
          setV(value);
          return;
        }
        if (v !== value) onSave(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-full bg-transparent border-b border-transparent hover:border-border focus:border-ring text-[13px] py-1 outline-none"
    />
  );
}

function InlineDate({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (v: string) => void;
}) {
  return (
    <input
      type="date"
      value={value ?? ""}
      onChange={(e) => onSave(e.target.value)}
      className="bg-transparent border-b border-transparent hover:border-border focus:border-ring text-[13px] py-1 outline-none"
    />
  );
}

function InlineSelect({
  value,
  options,
  onSave,
}: {
  value: string;
  options: string[];
  onSave: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onSave(e.target.value)}
      className="bg-transparent text-[13px] py-1 outline-none cursor-pointer"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function InlineMoney({
  value,
  onSave,
}: {
  value: number;
  onSave: (v: number) => void;
}) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-muted-foreground">$</span>
      <input
        type="number"
        step="0.01"
        min={0}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = Number(v);
          if (!Number.isFinite(n) || n < 0) {
            setV(String(value));
            return;
          }
          if (n !== value) onSave(n);
        }}
        className="w-24 bg-transparent border-b border-transparent hover:border-border focus:border-ring text-[13px] py-1 outline-none tabular-nums"
      />
    </span>
  );
}

// ----- Address editor -----
function AddressEditor({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string | null;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  return (
    <div className="bg-card border border-border rounded-md p-3 flex flex-col gap-1.5">
      <span className="text-[11.5px] font-medium text-muted-foreground tracking-[0.04em] uppercase">
        {label}
      </span>
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          if (v !== (value ?? "")) onSave(v);
        }}
        rows={3}
        placeholder="Street, City, State, ZIP"
        className="w-full bg-transparent text-[13px] outline-none resize-y min-h-[58px]"
      />
    </div>
  );
}

// ----- Order Status / Shipping cards -----
function OrderStatusCard({
  order,
  onPatch,
}: {
  order: OrderRow;
  onPatch: (b: Record<string, unknown>) => Promise<void>;
}) {
  const [scheduled, setScheduled] = useState(order.scheduled_production_date ?? "");
  const [estimated, setEstimated] = useState(order.estimated_shipped_date ?? "");
  const [actual, setActual] = useState(order.actual_ship_date ?? "");
  const [tracking, setTracking] = useState(order.tracking ?? "");

  useEffect(() => {
    setScheduled(order.scheduled_production_date ?? "");
    setEstimated(order.estimated_shipped_date ?? "");
    setActual(order.actual_ship_date ?? "");
    setTracking(order.tracking ?? "");
  }, [order]);

  const dirty =
    scheduled !== (order.scheduled_production_date ?? "") ||
    estimated !== (order.estimated_shipped_date ?? "") ||
    actual !== (order.actual_ship_date ?? "") ||
    tracking !== (order.tracking ?? "");

  return (
    <div className="bg-zinc-50 dark:bg-[#0f0f11] border border-border rounded-[12px] p-4 sm:p-5">
      <div className="text-[15px] font-semibold mb-4">Order Status</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Scheduled for Production Date">
          <input
            type="date"
            value={scheduled}
            onChange={(e) => setScheduled(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Estimated Shipped Date">
          <input
            type="date"
            value={estimated}
            onChange={(e) => setEstimated(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Actual Ship Date">
          <input
            type="date"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            className={inputCls}
            placeholder="MM/DD/YYYY"
          />
        </Field>
        <Field label="Tracking # or URL">
          <input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="Tracking URL"
            className={inputCls}
          />
        </Field>
      </div>
      <div className="flex items-center justify-between mt-4 gap-2">
        <button
          type="button"
          onClick={() =>
            onPatch({
              scheduled_production_date: scheduled || null,
              estimated_shipped_date: estimated || null,
              actual_ship_date: actual || null,
              tracking: tracking || null,
              send_email_status: true,
            })
          }
          disabled={!dirty}
          className="text-[12.5px] font-medium underline underline-offset-2 disabled:opacity-50 cursor-pointer"
        >
          Save and Send Update to Client
        </button>
        <button
          type="button"
          disabled={!dirty}
          onClick={() =>
            onPatch({
              scheduled_production_date: scheduled || null,
              estimated_shipped_date: estimated || null,
              actual_ship_date: actual || null,
              tracking: tracking || null,
            })
          }
          className="h-9 px-4 rounded-md bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200 text-[13px] font-medium disabled:opacity-50 enabled:bg-primary enabled:text-primary-foreground enabled:hover:opacity-90 enabled:cursor-pointer"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function ShippingCard({
  order,
  onPatch,
}: {
  order: OrderRow;
  onPatch: (b: Record<string, unknown>) => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(!!order.add_shipping_cost);
  const [cost, setCost] = useState(String(order.shipping_cost ?? 0));

  useEffect(() => {
    setEnabled(!!order.add_shipping_cost);
    setCost(String(order.shipping_cost ?? 0));
  }, [order]);

  const dirty =
    enabled !== !!order.add_shipping_cost ||
    Number(cost) !== order.shipping_cost;

  return (
    <div className="bg-zinc-50 dark:bg-[#0f0f11] border border-border rounded-[12px] p-4 sm:p-5">
      <div className="text-[15px] font-semibold mb-4">Shipping Information</div>
      <div className="flex items-start justify-between gap-4">
        <span className="text-[13px] font-medium leading-snug">
          Add Shipping/Freight
          <br />
          Cost
        </span>
        <Switch checked={enabled} onChange={setEnabled} />
      </div>
      {enabled && (
        <div className="mt-3">
          <Field label="Shipping cost">
            <input
              type="number"
              min={0}
              step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      )}
      <div className="flex justify-end mt-4">
        <button
          type="button"
          disabled={!dirty}
          onClick={() =>
            onPatch({
              add_shipping_cost: enabled,
              shipping_cost: Number(cost) || 0,
            })
          }
          className="h-9 px-4 rounded-md bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200 text-[13px] font-medium disabled:opacity-50 enabled:bg-primary enabled:text-primary-foreground enabled:hover:opacity-90 enabled:cursor-pointer"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium">{label}</span>
      {children}
    </label>
  );
}

// ----- Products -----
function ProductsCard({
  orderId,
  items,
  subtotal,
  totalBoxes,
  onChange,
}: {
  orderId: string;
  items: OrderItemRow[];
  subtotal: number;
  totalBoxes: number;
  onChange: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);

  const addItem = async (data: {
    name: string;
    size: string;
    color_code: string;
    type_type: string;
    price: number;
    quantity: number;
  }) => {
    await fetch(`/api/orders/${orderId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await onChange();
  };

  const deleteItem = async (itemId: string) => {
    if (!confirm("Remove this line item?")) return;
    await fetch(`/api/orders/${orderId}/items/${itemId}`, { method: "DELETE" });
    await onChange();
  };

  return (
    <div className="bg-zinc-50 dark:bg-[#0f0f11] border border-border rounded-[12px] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-card border border-border">
              <Package size={14} />
            </span>
            <span className="text-[15px] font-semibold">Products</span>
          </div>
          <div className="text-muted-foreground text-[12.5px] mt-1 ml-9">Order Details</div>
        </div>
        <button
          type="button"
          className="h-9 px-3.5 rounded-md bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90"
        >
          <GitBranch size={13} /> Split
        </button>
      </div>

      <div className="bg-card border border-border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Size</Th>
                <Th>Color Code</Th>
                <Th>Type Type</Th>
                <Th align="right">Price</Th>
                <Th align="right">Quantity</Th>
                <Th align="right" />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-border">
                  <td className="px-3.5 py-3">{it.name}</td>
                  <td className="px-3.5 py-3">{it.size ?? "—"}</td>
                  <td className="px-3.5 py-3">{it.color_code ?? "—"}</td>
                  <td className="px-3.5 py-3">{it.type_type ?? "—"}</td>
                  <td className="px-3.5 py-3 text-right tabular-nums">
                    ${it.price.toFixed(2)}
                  </td>
                  <td className="px-3.5 py-3 text-right tabular-nums">{it.quantity}</td>
                  <td className="px-3.5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => deleteItem(it.id)}
                      title="Remove"
                      className="w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {adding && (
                <NewItemRow onCancel={() => setAdding(false)} onSave={async (d) => {
                  await addItem(d);
                  setAdding(false);
                }} />
              )}
              {items.length === 0 && !adding && (
                <tr>
                  <td colSpan={7} className="px-3.5 py-8 text-center text-muted-foreground text-[13px]">
                    No products added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={adding}
          className="h-8 px-3 rounded-md border border-dashed border-border text-muted-foreground text-[12.5px] inline-flex items-center gap-1.5 hover:bg-accent hover:text-foreground cursor-pointer disabled:opacity-50"
        >
          <Plus size={13} /> Add line item
        </button>
        <div className="flex items-center gap-3 text-[13px]">
          <span className="bg-card border border-border rounded-md px-3 py-1.5 font-semibold tabular-nums">
            ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="bg-card border border-border rounded-md px-3 py-1.5 text-muted-foreground tabular-nums">
            {totalBoxes} Boxes
          </span>
        </div>
      </div>
    </div>
  );
}

function NewItemRow({
  onSave,
  onCancel,
}: {
  onSave: (d: {
    name: string;
    size: string;
    color_code: string;
    type_type: string;
    price: number;
    quantity: number;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [d, setD] = useState({
    name: "",
    size: "",
    color_code: "",
    type_type: "",
    price: "",
    quantity: "1",
  });
  const valid =
    d.name.trim() &&
    Number(d.price) >= 0 &&
    Number(d.quantity) >= 1 &&
    Number.isFinite(Number(d.price)) &&
    Number.isFinite(Number(d.quantity));
  return (
    <tr className="border-t border-border bg-zinc-50 dark:bg-[#0f0f11]">
      <td className="px-2 py-2">
        <input
          autoFocus
          value={d.name}
          onChange={(e) => setD({ ...d, name: e.target.value })}
          placeholder='2" 1301 White DE'
          className={inputCls}
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={d.size}
          onChange={(e) => setD({ ...d, size: e.target.value })}
          className={inputCls}
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={d.color_code}
          onChange={(e) => setD({ ...d, color_code: e.target.value })}
          className={inputCls}
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={d.type_type}
          onChange={(e) => setD({ ...d, type_type: e.target.value })}
          className={inputCls}
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="number"
          min={0}
          step="0.01"
          value={d.price}
          onChange={(e) => setD({ ...d, price: e.target.value })}
          className={`${inputCls} text-right tabular-nums`}
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="number"
          min={1}
          value={d.quantity}
          onChange={(e) => setD({ ...d, quantity: e.target.value })}
          className={`${inputCls} text-right tabular-nums`}
        />
      </td>
      <td className="px-2 py-2 text-right">
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 px-2 text-[12px] text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() =>
              onSave({
                name: d.name.trim(),
                size: d.size.trim(),
                color_code: d.color_code.trim(),
                type_type: d.type_type.trim(),
                price: Number(d.price),
                quantity: Math.floor(Number(d.quantity)),
              })
            }
            className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-medium disabled:opacity-50 enabled:hover:opacity-90 cursor-pointer"
          >
            Add
          </button>
        </div>
      </td>
    </tr>
  );
}

function Th({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`${align === "right" ? "text-right" : "text-left"} px-3.5 py-2.5 bg-zinc-50 dark:bg-[#0f0f11] border-b border-border font-medium text-muted-foreground text-[11.5px] tracking-[0.04em] uppercase whitespace-nowrap`}
    >
      {children}
    </th>
  );
}

// ----- Totals -----
function TotalsCard({
  order,
  subtotal,
  tax,
  shipping,
  total,
}: {
  order: OrderRow;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-3">
      <div>
        <div className="text-[11.5px] font-semibold tracking-[0.06em] uppercase text-muted-foreground mb-2">
          Shipping Address
        </div>
        <div className="text-[13px] whitespace-pre-line">
          {order.shipping_address ?? "—"}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 text-[14px]">
        <Line label="Subtotal" value={subtotal} />
        <Line label={`Tax (${(order.tax_rate * 100).toFixed(0)}%)`} value={tax} />
        {order.discount > 0 && <Line label="Discount" value={-order.discount} />}
        {shipping > 0 && <Line label="Shipping" value={shipping} />}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <span className="text-[20px] font-bold">Total</span>
          <span className="text-[20px] font-bold tabular-nums">
            ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="text-right text-[11.5px] text-muted-foreground">
          Discounts &amp; Tax Included
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span className="text-[13.5px]">{label}</span>
      <span className="text-[13.5px] tabular-nums text-foreground">
        ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}

// ----- History -----
function HistoryCard({ history }: { history: OrderHistoryRow[] }) {
  return (
    <div className="bg-zinc-50 dark:bg-[#0f0f11] border border-border rounded-[12px] p-4 sm:p-5">
      <CardHeader icon={<History size={14} />} title="Order History" />
      <div className="bg-card border border-border rounded-md divide-y divide-border">
        {history.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-[13px]">
            No history yet.
          </div>
        ) : (
          history.map((h) => (
            <div
              key={h.id}
              className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-2 px-4 py-3.5 text-[13px]"
            >
              <span className="text-muted-foreground font-mono">{formatHistory(h.created_at)}</span>
              <span>{h.event}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatLong(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]}, ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()}`;
}

function formatHistory(ts: string): string {
  const d = new Date(ts.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return ts;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${months[d.getMonth()]}, ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()} ${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

const inputCls =
  "h-9 w-full px-3 rounded-md border border-input bg-background text-foreground text-[13px] shadow-xs outline-none focus:border-ring focus:ring-[3px] focus:ring-foreground/20";
