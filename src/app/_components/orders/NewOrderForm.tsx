"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronLeft, Info, Minus, Plus } from "lucide-react";
import type { CustomerRow, OrderChannel, ProductRow } from "@/lib/db";

type ProductGroup = {
  key: string;
  label: string;
  price_unit: string;
  products: ProductRow[];
};

const channelSlug = (c: OrderChannel) => (c === "request" ? "requests" : c);

const TAX_RATE = 0.07;
const RUSH_FEE_DEFAULT = 50;
const SHIPPING_COST_DEFAULT = 75;

type Toggles = {
  bill_to_parent: boolean;
  add_shipping_cost: boolean;
  send_order_confirmation: boolean;
  tax: boolean;
  rush: boolean;
  discount: boolean;
};

type Discount = {
  type: "percent" | "amount";
  value: string;
};

export function NewOrderForm({
  channel,
  channelLabel,
}: {
  channel: OrderChannel;
  channelLabel: string;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState<string>("");
  const [orderDate, setOrderDate] = useState<string>(today);
  const [poNumber, setPoNumber] = useState("");
  const [paymentTerm, setPaymentTerm] = useState("Credit Card");
  const [notes, setNotes] = useState("");

  const [toggles, setToggles] = useState<Toggles>({
    bill_to_parent: false,
    add_shipping_cost: false,
    send_order_confirmation: false,
    tax: false,
    rush: false,
    discount: false,
  });
  const [discount, setDiscount] = useState<Discount>({ type: "amount", value: "" });
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ])
      .then(
        ([c, p]: [
          { items: CustomerRow[] },
          { groups: ProductGroup[] }
        ]) => {
          if (!active) return;
          setCustomers(c.items);
          setGroups(p.groups);
          if (c.items[0]) {
            setCustomerId(c.items[0].id);
            setPaymentTerm(c.items[0].payment_term ?? "Credit Card");
          }
          setLoaded(true);
        }
      )
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      active = false;
    };
  }, []);

  const customer = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customers, customerId]
  );

  const allProducts = useMemo(
    () => groups.flatMap((g) => g.products),
    [groups]
  );

  const lineItems = useMemo(() => {
    return allProducts
      .map((p) => {
        const q = Math.max(0, Math.floor(Number(quantities[p.id] || 0)));
        return { product: p, qty: q };
      })
      .filter((r) => r.qty > 0);
  }, [allProducts, quantities]);

  const subtotal = lineItems.reduce((s, r) => s + r.product.price * r.qty, 0);
  const totalBoxes = lineItems.reduce((s, r) => s + r.qty, 0);
  const tax = toggles.tax ? Math.round(subtotal * TAX_RATE * 100) / 100 : 0;
  const rushFee = toggles.rush ? RUSH_FEE_DEFAULT : 0;
  const shipping = toggles.add_shipping_cost ? SHIPPING_COST_DEFAULT : 0;
  const discountAmount = toggles.discount
    ? discount.type === "percent"
      ? Math.round(subtotal * (Number(discount.value) || 0) * 100) / 10000
      : Number(discount.value) || 0
    : 0;
  const total =
    Math.round((subtotal - discountAmount + tax + rushFee + shipping) * 100) / 100;

  const setQty = (productId: string, value: string) => {
    setQuantities((q) => {
      const next = { ...q };
      if (!value || value === "0") delete next[productId];
      else next[productId] = value;
      return next;
    });
  };

  const stepQty = (productId: string, delta: number) => {
    setQuantities((q) => {
      const cur = Math.max(0, Math.floor(Number(q[productId] || 0)));
      const nextVal = Math.max(0, cur + delta);
      const next = { ...q };
      if (nextVal === 0) delete next[productId];
      else next[productId] = String(nextVal);
      return next;
    });
  };

  const groupSelectedCount = (group: ProductGroup) =>
    group.products.reduce(
      (s, p) => s + Math.max(0, Math.floor(Number(quantities[p.id] || 0))),
      0
    );

  const toggleCollapsed = (key: string) =>
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customer) {
      setError("Please select a customer.");
      return;
    }
    if (!orderDate) {
      setError("Order date is required.");
      return;
    }
    if (lineItems.length === 0) {
      setError("Add at least one product quantity.");
      return;
    }

    setSubmitting(true);
    try {
      const orderNumber = generateOrderNumber(channel);
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_number: orderNumber,
          po_number: poNumber.trim() || null,
          company: customer.name,
          customer: customer.name,
          customer_id: customer.id,
          order_date: orderDate,
          channel,
          status: "waiting_for_scheduling",
          billing_address: customer.billing_address,
          shipping_address: customer.shipping_address,
          payment_term: paymentTerm,
          notes: notes.trim() || null,
          bill_to_parent: toggles.bill_to_parent,
          add_shipping_cost: toggles.add_shipping_cost,
          shipping_cost: SHIPPING_COST_DEFAULT,
          send_order_confirmation: toggles.send_order_confirmation,
          tax_enabled: toggles.tax,
          tax_rate: TAX_RATE,
          rush_fee: rushFee,
          discount: toggles.discount ? Number(discount.value) || 0 : 0,
          discount_type: toggles.discount ? discount.type : "amount",
          mark_as_paid: true,
          payment_status: "paid",
          items: lineItems.map((r) => ({
            name: r.product.name,
            size: r.product.size,
            color_code: r.product.color_code,
            type_type: r.product.type_type,
            price: r.product.price,
            quantity: r.qty,
          })),
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { item: { id: string } };
      router.push(`/orders/${channelSlug(channel)}/${data.item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

  if (!loaded) {
    return <div className="py-20 text-center text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Link
        href={`/orders/${channelSlug(channel)}`}
        className="inline-flex items-center gap-2 text-[14px] text-foreground hover:text-foreground"
      >
        <span className="w-8 h-8 inline-flex items-center justify-center rounded-full border border-border bg-background">
          <ChevronLeft size={15} />
        </span>
        <span className="font-semibold">Add New Order</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Customer Information */}
        <Section title="Customer Information" subtitle="Select Customer, Payment terms and Location">
          <Field label="Select Customer">
            <select
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                const c = customers.find((cc) => cc.id === e.target.value);
                if (c) setPaymentTerm(c.payment_term);
              }}
              className={inputCls}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field label="Order Date">
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="PO No.">
              <input
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="Enter PO Number"
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        {/* Billing Information */}
        <Section title="Billing Information" subtitle="Tax and offer details are entered here.">
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <Field label="Payment Term">
              <select
                value={paymentTerm}
                onChange={(e) => setPaymentTerm(e.target.value)}
                className={inputCls}
              >
                {["Credit Card", "ACH", "Check", "Wire", "Net 30"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <ToggleRow
              label="Bill to Parent Company"
              labelTop
              checked={toggles.bill_to_parent}
              onChange={(v) => setToggles((t) => ({ ...t, bill_to_parent: v }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4">
            <ToggleRow
              label="Add Shipping/Freight Cost"
              checked={toggles.add_shipping_cost}
              onChange={(v) => setToggles((t) => ({ ...t, add_shipping_cost: v }))}
            />
            <ToggleRow
              label="Send Order Confirmation"
              checked={toggles.send_order_confirmation}
              onChange={(v) => setToggles((t) => ({ ...t, send_order_confirmation: v }))}
            />
            <ToggleRow
              label={
                <span className="inline-flex items-center gap-1.5">
                  Tax <Info size={11} className="text-muted-foreground" />
                </span>
              }
              checked={toggles.tax}
              onChange={(v) => setToggles((t) => ({ ...t, tax: v }))}
            />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium">Apply Discount</span>
                <input
                  type="checkbox"
                  className="w-4 h-4 cursor-pointer accent-foreground"
                  checked={toggles.discount}
                  onChange={(e) =>
                    setToggles((t) => ({ ...t, discount: e.target.checked }))
                  }
                />
              </div>
              {toggles.discount && (
                <div className="flex items-center gap-3 mt-1">
                  <Radio
                    label="% Off"
                    name="discount_type"
                    value="percent"
                    selected={discount.type}
                    onSelect={(v) => setDiscount((d) => ({ ...d, type: v as "percent" | "amount" }))}
                  />
                  <Radio
                    label="Set Amount"
                    name="discount_type"
                    value="amount"
                    selected={discount.type}
                    onSelect={(v) => setDiscount((d) => ({ ...d, type: v as "percent" | "amount" }))}
                  />
                </div>
              )}
            </div>
            <ToggleRow
              label="RUSH Fee"
              checked={toggles.rush}
              onChange={(v) => setToggles((t) => ({ ...t, rush: v }))}
            />
            {toggles.discount && (
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-muted-foreground">$</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount.value}
                  onChange={(e) => setDiscount((d) => ({ ...d, value: e.target.value }))}
                  className={inputCls}
                />
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* Products */}
      <Section title="Products Selection" subtitle="Select the Products as well as the quantity">
        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => {
              const count = groupSelectedCount(g);
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(`cat-${g.key}`);
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    setCollapsed((c) => ({ ...c, [g.key]: false }));
                  }}
                  className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11.5px] font-medium cursor-pointer ${
                    count > 0
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {g.label.split("—")[0].trim()}
                  {count > 0 && (
                    <span className="tabular-nums opacity-90">· {count}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="text-[13px] font-semibold text-muted-foreground">
            Using <span className="text-foreground">(Normal)</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <CategoryTable
              key={g.key}
              group={g}
              quantities={quantities}
              collapsed={!!collapsed[g.key]}
              onToggle={() => toggleCollapsed(g.key)}
              onSetQty={setQty}
              onStep={stepQty}
            />
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <div className="text-[11.5px] text-muted-foreground space-y-1">
            <div>* Some deliveries may take up to 7-14 business days.</div>
            <div>* Wood Grains &amp; Specialty Colors can take up to 3 months.</div>
            <div>* Additional charges apply for incorrect shipping addresses &amp; returns.</div>
          </div>
          <div className="flex items-center justify-end gap-3 text-[13px]">
            <span className="bg-card border border-border rounded-md px-3 py-1.5 font-semibold tabular-nums">
              ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="bg-card border border-border rounded-md px-3 py-1.5 text-muted-foreground tabular-nums">
              {totalBoxes} Boxes
            </span>
          </div>
        </div>
      </Section>

      {/* Shipping address + Totals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-1">
        <div>
          <div className="text-[11.5px] font-semibold tracking-[0.06em] uppercase text-muted-foreground mb-2">
            Shipping Address
          </div>
          <div className="text-[13.5px] whitespace-pre-line">
            {customer?.shipping_address ?? "—"}
          </div>
        </div>
        <div className="flex flex-col gap-2 text-[14px]">
          <Line label="Subtotal" value={subtotal} />
          {toggles.tax && <Line label={`Tax (${(TAX_RATE * 100).toFixed(0)}%)`} value={tax} />}
          {toggles.discount && discountAmount > 0 && (
            <Line label="Discount" value={-discountAmount} />
          )}
          {toggles.rush && rushFee > 0 && <Line label="RUSH Fee" value={rushFee} />}
          {toggles.add_shipping_cost && shipping > 0 && (
            <Line label="Shipping" value={shipping} />
          )}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <span className="text-[22px] font-bold">Total</span>
            <span className="text-[22px] font-bold tabular-nums">
              ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-right text-[11.5px] text-muted-foreground">
            Discounts &amp; Tax Included
          </div>
        </div>
      </div>

      {/* Notes */}
      <Section title="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="Notes"
          className={`${inputCls} h-auto py-2.5 resize-y min-h-[120px] bg-background`}
        />
      </Section>

      {error && (
        <div className="text-[13px] text-red-600 dark:text-red-400">{error}</div>
      )}

      {/* Footer actions */}
      <div className="flex justify-end gap-2 pb-6">
        <Link
          href={`/orders/${channelSlug(channel)}`}
          className="h-11 px-5 inline-flex items-center rounded-md border border-border bg-background text-foreground text-[14px] font-medium hover:bg-accent"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="h-11 px-5 rounded-md bg-primary text-primary-foreground text-[14px] font-semibold hover:opacity-90 disabled:opacity-60 cursor-pointer"
        >
          {submitting ? "Creating…" : "Pay now"}
        </button>
      </div>
    </form>
  );
}

// ---------- atoms ----------

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-50 dark:bg-[#0f0f11] border border-border rounded-[14px] p-4 sm:p-5">
      <div className="text-[16px] font-semibold tracking-[-0.005em]">{title}</div>
      {subtitle && (
        <div className="text-muted-foreground text-[12.5px] mt-0.5 mb-4">{subtitle}</div>
      )}
      {!subtitle && <div className="mb-3" />}
      <div className="border-t border-border pt-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  labelTop,
}: {
  label: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  labelTop?: boolean;
}) {
  if (labelTop) {
    return (
      <div className="flex flex-col gap-1.5 items-end pb-2">
        <span className="text-[12.5px] font-semibold">{label}</span>
        <Switch checked={checked} onChange={onChange} />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-[13px] font-medium">{label}</span>
      <Switch checked={checked} onChange={onChange} />
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

function Radio({
  label,
  name,
  value,
  selected,
  onSelect,
}: {
  label: string;
  name: string;
  value: string;
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer text-[12.5px]">
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected === value}
        onChange={() => onSelect(value)}
        className="w-3.5 h-3.5 accent-foreground cursor-pointer"
      />
      {label}
    </label>
  );
}

function CategoryTable({
  group,
  quantities,
  collapsed,
  onToggle,
  onSetQty,
  onStep,
}: {
  group: ProductGroup;
  quantities: Record<string, string>;
  collapsed: boolean;
  onToggle: () => void;
  onSetQty: (id: string, value: string) => void;
  onStep: (id: string, delta: number) => void;
}) {
  const selectedCount = group.products.reduce(
    (s, p) => s + Math.max(0, Math.floor(Number(quantities[p.id] || 0))),
    0
  );
  const groupSubtotal = group.products.reduce((s, p) => {
    const q = Math.max(0, Math.floor(Number(quantities[p.id] || 0)));
    return s + p.price * q;
  }, 0);

  return (
    <div
      id={`cat-${group.key}`}
      className="bg-card border border-border rounded-md overflow-hidden"
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-3 bg-zinc-50 dark:bg-[#0f0f11] border-b border-border cursor-pointer hover:bg-accent/50 text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <ChevronDown
            size={14}
            className={`shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
          <span className="text-[13.5px] font-semibold tracking-[-0.005em] truncate">
            {group.label}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11.5px] text-muted-foreground font-mono">
            Price / {group.price_unit}
          </span>
          {selectedCount > 0 && (
            <span className="text-[11.5px] tabular-nums bg-foreground text-background rounded-full px-2 py-0.5">
              {selectedCount} · ${groupSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>
      </button>
      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <Th>Description</Th>
                <Th>Color Code</Th>
                <Th align="right">Price ({group.price_unit})</Th>
                <Th align="center">Qty</Th>
                <Th align="right">Line total</Th>
              </tr>
            </thead>
            <tbody>
              {group.products.map((p) => {
                const q = Math.max(0, Math.floor(Number(quantities[p.id] || 0)));
                const lineTotal = p.price * q;
                return (
                  <tr
                    key={p.id}
                    className={`border-t border-border transition-colors ${
                      q > 0 ? "bg-foreground/[0.04] dark:bg-foreground/[0.06]" : ""
                    }`}
                  >
                    <td className="px-3.5 py-2.5">
                      <div className="font-medium">{p.name}</div>
                      {p.size && (
                        <div className="text-[11.5px] text-muted-foreground">
                          {p.size} · {p.type_type}
                        </div>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-muted-foreground">
                      {p.color_code ?? "—"}
                    </td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums">
                      ${p.price.toFixed(2)}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <div className="inline-flex items-center gap-0">
                        <button
                          type="button"
                          onClick={() => onStep(p.id, -1)}
                          disabled={q <= 0}
                          aria-label="Decrease"
                          className="w-7 h-8 inline-flex items-center justify-center rounded-l-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={quantities[p.id] ?? ""}
                          onChange={(e) => onSetQty(p.id, e.target.value)}
                          placeholder="0"
                          className="h-8 w-14 px-2 border-y border-border bg-background text-foreground text-[13px] text-center tabular-nums outline-none focus:ring-[2px] focus:ring-foreground/30 focus:relative"
                        />
                        <button
                          type="button"
                          onClick={() => onStep(p.id, +1)}
                          aria-label="Increase"
                          className="w-7 h-8 inline-flex items-center justify-center rounded-r-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums font-semibold">
                      {q > 0
                        ? `$${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : <span className="text-muted-foreground font-normal">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  const alignCls = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th
      className={`${alignCls} px-3.5 py-2.5 bg-zinc-50 dark:bg-[#0f0f11] border-b border-border font-medium text-muted-foreground text-[11.5px] tracking-[0.04em] uppercase whitespace-nowrap`}
    >
      {children}
    </th>
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

const inputCls =
  "h-10 w-full px-3 rounded-md border border-input bg-background text-foreground text-[13.5px] shadow-xs outline-none focus:border-ring focus:ring-[3px] focus:ring-foreground/20";

function generateOrderNumber(channel: OrderChannel): string {
  const base = Math.floor(100_000_000 + Math.random() * 900_000_000).toString();
  if (channel === "portal") return base;
  return `${channel.toUpperCase().slice(0, 3)}-${base.slice(0, 6)}`;
}
