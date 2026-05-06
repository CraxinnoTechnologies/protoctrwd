import { NextResponse } from "next/server";
import { listCustomers } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ items: listCustomers() });
}
