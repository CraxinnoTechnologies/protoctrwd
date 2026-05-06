import { NextResponse, type NextRequest } from "next/server";
import {
  createOrderWithItems,
  listOrders,
  orderCounts,
  type LineItemInput,
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

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const channel = url.searchParams.get("channel") as OrderChannel | null;
  const status = url.searchParams.get("status") as OrderStatus | null;
  const archivedParam = url.searchParams.get("archived");
  const query = url.searchParams.get("q") ?? undefined;

  if (channel && !ORDER_CHANNELS.includes(channel)) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }
  if (status && !ORDER_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const archived =
    archivedParam === "1" ? true : archivedParam === "0" ? false : undefined;

  const items = listOrders({
    channel: channel ?? undefined,
    status: status ?? undefined,
    archived,
    query,
  });
  const counts = channel ? orderCounts(channel) : null;
  return NextResponse.json({ items, counts });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const order_number = typeof b.order_number === "string" ? b.order_number.trim() : "";
  const company = typeof b.company === "string" ? b.company.trim() : "";
  const customer = typeof b.customer === "string" ? b.customer.trim() : "";
  const order_date = typeof b.order_date === "string" ? b.order_date : "";
  const channel = (b.channel as OrderChannel) || "portal";
  const status = (b.status as OrderStatus) || "waiting_for_scheduling";
  const payment_status = b.payment_status as PaymentStatus | undefined;
  const po_number = typeof b.po_number === "string" ? b.po_number.trim() || null : null;
  const customer_id = typeof b.customer_id === "string" ? b.customer_id : null;
  const notes = typeof b.notes === "string" ? b.notes.trim() || null : null;

  if (!order_number) {
    return NextResponse.json({ error: "order_number is required" }, { status: 400 });
  }
  if (!company || !customer) {
    return NextResponse.json({ error: "company and customer are required" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(order_date)) {
    return NextResponse.json({ error: "order_date must be YYYY-MM-DD" }, { status: 400 });
  }
  if (!ORDER_CHANNELS.includes(channel)) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }
  if (!ORDER_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (payment_status && !PAYMENT_STATUSES.includes(payment_status)) {
    return NextResponse.json({ error: "Invalid payment status" }, { status: 400 });
  }

  const num = (v: unknown, def = 0) =>
    typeof v === "number" ? v : v == null ? def : Number(v);
  const bool = (v: unknown) => v === true;

  const lineItems: LineItemInput[] = Array.isArray(b.items)
    ? (b.items as Array<Record<string, unknown>>)
        .filter((it) => typeof it?.name === "string" && Number(it?.quantity) > 0)
        .map((it) => ({
          name: String(it.name),
          size: typeof it.size === "string" ? it.size : null,
          color_code: typeof it.color_code === "string" ? it.color_code : null,
          type_type: typeof it.type_type === "string" ? it.type_type : null,
          price: num(it.price),
          quantity: Math.max(1, Math.floor(num(it.quantity, 1))),
        }))
    : [];

  const item = createOrderWithItems(
    {
      order_number,
      po_number,
      total_boxes: 0, // recomputed from items
      company,
      customer,
      customer_id,
      order_date,
      amount: 0, // recomputed
      status,
      payment_status,
      channel,
      notes,
      billing_address: typeof b.billing_address === "string" ? b.billing_address : null,
      shipping_address: typeof b.shipping_address === "string" ? b.shipping_address : null,
      payment_term: typeof b.payment_term === "string" ? b.payment_term : "Credit Card",
      bill_to_parent: bool(b.bill_to_parent),
      add_shipping_cost: bool(b.add_shipping_cost),
      shipping_cost: num(b.shipping_cost),
      send_order_confirmation: bool(b.send_order_confirmation),
      mark_as_paid: bool(b.mark_as_paid),
      tax_enabled: b.tax_enabled === false ? false : true,
      tax_rate: num(b.tax_rate, 0.07),
      rush_fee: num(b.rush_fee),
      discount: num(b.discount),
      discount_type:
        b.discount_type === "percent" ? "percent" : "amount",
    },
    lineItems
  );
  return NextResponse.json({ item }, { status: 201 });
}
