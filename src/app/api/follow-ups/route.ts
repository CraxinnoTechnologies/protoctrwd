import { NextResponse } from "next/server";
import { createFollowUp, followUpCounts, listFollowUps } from "@/lib/follow-ups";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = listFollowUps();
  const counts = followUpCounts();
  return NextResponse.json({ items, counts });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { title, contact_name, company, email, phone, due_date, notes } = body as Record<
    string,
    unknown
  >;

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (typeof contact_name !== "string" || !contact_name.trim()) {
    return NextResponse.json({ error: "Contact name is required" }, { status: 400 });
  }
  if (typeof due_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
    return NextResponse.json({ error: "due_date must be YYYY-MM-DD" }, { status: 400 });
  }

  const created = createFollowUp({
    title: title.trim(),
    contact_name: contact_name.trim(),
    company: typeof company === "string" ? company.trim() || null : null,
    email: typeof email === "string" ? email.trim() || null : null,
    phone: typeof phone === "string" ? phone.trim() || null : null,
    due_date,
    notes: typeof notes === "string" ? notes.trim() || null : null,
  });
  return NextResponse.json({ item: created }, { status: 201 });
}
