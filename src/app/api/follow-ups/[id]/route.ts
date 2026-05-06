import { NextResponse, type NextRequest } from "next/server";
import { deleteFollowUp, getFollowUp, updateFollowUp } from "@/lib/follow-ups";
import { FOLLOW_UP_STATUSES, type FollowUpStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const item = getFollowUp(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const patch = body as Record<string, unknown>;

  if (patch.status !== undefined) {
    if (!FOLLOW_UP_STATUSES.includes(patch.status as FollowUpStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
  }
  if (patch.due_date !== undefined) {
    if (typeof patch.due_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(patch.due_date)) {
      return NextResponse.json({ error: "due_date must be YYYY-MM-DD" }, { status: 400 });
    }
  }

  const updated = updateFollowUp(id, {
    title: typeof patch.title === "string" ? patch.title : undefined,
    contact_name: typeof patch.contact_name === "string" ? patch.contact_name : undefined,
    company: typeof patch.company === "string" ? patch.company : undefined,
    email: typeof patch.email === "string" ? patch.email : undefined,
    phone: typeof patch.phone === "string" ? patch.phone : undefined,
    due_date: typeof patch.due_date === "string" ? patch.due_date : undefined,
    notes: typeof patch.notes === "string" ? patch.notes : undefined,
    status: (patch.status as FollowUpStatus | undefined) ?? undefined,
  });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ok = deleteFollowUp(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
