import { NextResponse, type NextRequest } from "next/server";
import { addOrderHistory, addOrderItem, getOrder, recomputeOrderTotals } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const order = getOrder(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
  const price = num(b.price);
  const quantity = num(b.quantity);
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "price must be non-negative" }, { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity < 1) {
    return NextResponse.json({ error: "quantity must be >= 1" }, { status: 400 });
  }

  const item = addOrderItem(id, {
    name,
    size: typeof b.size === "string" ? b.size : null,
    color_code: typeof b.color_code === "string" ? b.color_code : null,
    type_type: typeof b.type_type === "string" ? b.type_type : null,
    price,
    quantity: Math.floor(quantity),
  });
  recomputeOrderTotals(id);
  addOrderHistory(id, `Line item added: ${name}`);
  return NextResponse.json({ item }, { status: 201 });
}
