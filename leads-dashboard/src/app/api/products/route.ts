import { NextResponse, type NextRequest } from "next/server";
import { listProductGroups } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const catalog = req.nextUrl.searchParams.get("catalog") ?? "normal";
  return NextResponse.json({ groups: listProductGroups(catalog) });
}
