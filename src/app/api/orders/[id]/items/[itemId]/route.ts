import { NextResponse, type NextRequest } from "next/server";
import {
  addOrderHistory,
  deleteOrderItem,
  recomputeOrderTotals,
  updateOrderItem,
} from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const num = (v: unknown) =>
    v === undefined ? undefined : typeof v === "number" ? v : Number(v);

  const item = updateOrderItem(itemId, {
    name: typeof b.name === "string" ? b.name : undefined,
    size: typeof b.size === "string" ? b.size : undefined,
    color_code: typeof b.color_code === "string" ? b.color_code : undefined,
    type_type: typeof b.type_type === "string" ? b.type_type : undefined,
    price: num(b.price),
    quantity: num(b.quantity),
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  recomputeOrderTotals(id);
  return NextResponse.json({ item });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await ctx.params;
  const ok = deleteOrderItem(itemId);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  recomputeOrderTotals(id);
  addOrderHistory(id, "Line item removed");
  return NextResponse.json({ ok: true });
}
