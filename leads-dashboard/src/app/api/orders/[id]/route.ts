import { NextResponse, type NextRequest } from "next/server";
import {
  addOrderHistory,
  deleteOrder,
  getOrderDetail,
  recomputeOrderTotals,
  updateOrder,
  type OrderUpdatePatch,
} from "@/lib/orders";
import {
  ORDER_CHANNELS,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type OrderChannel,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const detail = getOrderDetail(id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const dateFields: (keyof typeof b)[] = [
    "order_date",
    "scheduled_production_date",
    "estimated_shipped_date",
    "actual_ship_date",
  ];
  for (const f of dateFields) {
    const v = b[f];
    if (v === undefined || v === null) continue;
    if (typeof v !== "string") {
      return NextResponse.json({ error: `${String(f)} must be a string` }, { status: 400 });
    }
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return NextResponse.json(
        { error: `${String(f)} must be YYYY-MM-DD` },
        { status: 400 }
      );
    }
  }
  if (b.status !== undefined && !ORDER_STATUSES.includes(b.status as OrderStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (
    b.payment_status !== undefined &&
    !PAYMENT_STATUSES.includes(b.payment_status as PaymentStatus)
  ) {
    return NextResponse.json({ error: "Invalid payment status" }, { status: 400 });
  }
  if (b.channel !== undefined && !ORDER_CHANNELS.includes(b.channel as OrderChannel)) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }

  const numOrUndef = (v: unknown) =>
    v === undefined ? undefined : typeof v === "number" ? v : Number(v);
  const boolOrUndef = (v: unknown) =>
    typeof v === "boolean" ? v : v === undefined ? undefined : undefined;
  const strOrUndef = (v: unknown) =>
    v === null ? null : typeof v === "string" ? v : undefined;

  const patch: OrderUpdatePatch = {
    order_number: typeof b.order_number === "string" ? b.order_number : undefined,
    po_number: strOrUndef(b.po_number),
    total_boxes: numOrUndef(b.total_boxes),
    company: typeof b.company === "string" ? b.company : undefined,
    customer: typeof b.customer === "string" ? b.customer : undefined,
    order_date: typeof b.order_date === "string" ? b.order_date : undefined,
    amount: numOrUndef(b.amount),
    status: (b.status as OrderStatus | undefined) ?? undefined,
    channel: (b.channel as OrderChannel | undefined) ?? undefined,
    notes: strOrUndef(b.notes),
    payment_term: strOrUndef(b.payment_term),
    payment_status: (b.payment_status as PaymentStatus | undefined) ?? undefined,
    tax: numOrUndef(b.tax),
    tax_rate: numOrUndef(b.tax_rate),
    discount: numOrUndef(b.discount),
    shipping_cost: numOrUndef(b.shipping_cost),
    add_shipping_cost: boolOrUndef(b.add_shipping_cost),
    freight: boolOrUndef(b.freight),
    plain_box: boolOrUndef(b.plain_box),
    send_email_status: boolOrUndef(b.send_email_status),
    send_order_confirmation: boolOrUndef(b.send_order_confirmation),
    mark_as_paid: boolOrUndef(b.mark_as_paid),
    bill_to_parent: boolOrUndef(b.bill_to_parent),
    billing_address: strOrUndef(b.billing_address),
    shipping_address: strOrUndef(b.shipping_address),
    scheduled_production_date: strOrUndef(b.scheduled_production_date),
    estimated_shipped_date: strOrUndef(b.estimated_shipped_date),
    actual_ship_date: strOrUndef(b.actual_ship_date),
    tracking: strOrUndef(b.tracking),
    archived: typeof b.archived === "boolean" ? b.archived : undefined,
  };

  const before = getOrderDetail(id);
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = updateOrder(id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Append history events for meaningful changes
  if (patch.status && patch.status !== before.order.status) {
    addOrderHistory(id, `Status updated as '${humanStatus(patch.status)}'`);
  }
  if (patch.payment_status && patch.payment_status !== before.order.payment_status) {
    addOrderHistory(id, `Payment marked as ${patch.payment_status}`);
  }
  if (
    patch.scheduled_production_date &&
    patch.scheduled_production_date !== before.order.scheduled_production_date
  ) {
    addOrderHistory(
      id,
      `Order scheduled to ${formatHumanDate(patch.scheduled_production_date)}`
    );
  }
  if (patch.archived !== undefined && patch.archived !== (before.order.archived === 1)) {
    addOrderHistory(id, patch.archived ? "Order archived" : "Order restored");
  }

  if (patch.tax_rate !== undefined || patch.discount !== undefined) {
    recomputeOrderTotals(id);
  }

  return NextResponse.json(getOrderDetail(id));
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ok = deleteOrder(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

function humanStatus(s: OrderStatus): string {
  return s
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
function formatHumanDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}
