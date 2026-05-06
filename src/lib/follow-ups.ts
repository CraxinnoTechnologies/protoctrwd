import db, { FOLLOW_UP_STATUSES, type FollowUpRow, type FollowUpStatus } from "./db";
import crypto from "crypto";

export type FollowUpInput = {
  title: string;
  contact_name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  due_date: string;
  status?: FollowUpStatus;
  notes?: string | null;
};

function deriveStatus(due_date: string, current?: FollowUpStatus): FollowUpStatus {
  if (current === "completed") return "completed";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(due_date + "T00:00:00");
  return due < today ? "overdue" : "pending";
}

function refreshOverdue(): void {
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    `UPDATE follow_ups
     SET status = 'overdue', updated_at = datetime('now')
     WHERE status = 'pending' AND due_date < ?`
  ).run(today);
}

export function listFollowUps(): FollowUpRow[] {
  refreshOverdue();
  return db
    .prepare(
      `SELECT * FROM follow_ups ORDER BY
        CASE status WHEN 'overdue' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
        due_date ASC,
        created_at DESC`
    )
    .all() as FollowUpRow[];
}

export function getFollowUp(id: string): FollowUpRow | undefined {
  return db.prepare("SELECT * FROM follow_ups WHERE id = ?").get(id) as FollowUpRow | undefined;
}

export function createFollowUp(input: FollowUpInput): FollowUpRow {
  const id = crypto.randomUUID();
  const status = deriveStatus(input.due_date, input.status);
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  db.prepare(
    `INSERT INTO follow_ups (id, title, status, contact_name, company, email, phone, due_date, notes, created_at, updated_at)
     VALUES (@id, @title, @status, @contact_name, @company, @email, @phone, @due_date, @notes, @created_at, @updated_at)`
  ).run({
    id,
    title: input.title,
    status,
    contact_name: input.contact_name,
    company: input.company ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    due_date: input.due_date,
    notes: input.notes ?? null,
    created_at: now,
    updated_at: now,
  });
  return getFollowUp(id)!;
}

export function updateFollowUp(
  id: string,
  patch: Partial<FollowUpInput> & { status?: FollowUpStatus }
): FollowUpRow | undefined {
  const existing = getFollowUp(id);
  if (!existing) return undefined;

  const merged: FollowUpRow = { ...existing };
  for (const key of [
    "title",
    "contact_name",
    "company",
    "email",
    "phone",
    "due_date",
    "notes",
  ] as const) {
    const val = patch[key];
    if (val !== undefined) {
      (merged as Record<string, unknown>)[key] = val;
    }
  }
  const next = merged;

  let status: FollowUpStatus = (patch.status ?? next.status) as FollowUpStatus;
  if (!FOLLOW_UP_STATUSES.includes(status)) status = "pending";
  if (status !== "completed") status = deriveStatus(next.due_date, status);

  db.prepare(
    `UPDATE follow_ups
     SET title = @title,
         status = @status,
         contact_name = @contact_name,
         company = @company,
         email = @email,
         phone = @phone,
         due_date = @due_date,
         notes = @notes,
         updated_at = datetime('now')
     WHERE id = @id`
  ).run({
    id,
    title: next.title,
    status,
    contact_name: next.contact_name,
    company: next.company,
    email: next.email,
    phone: next.phone,
    due_date: next.due_date,
    notes: next.notes,
  });
  return getFollowUp(id);
}

export function deleteFollowUp(id: string): boolean {
  const r = db.prepare("DELETE FROM follow_ups WHERE id = ?").run(id);
  return r.changes > 0;
}

export function followUpCounts() {
  refreshOverdue();
  const rows = db
    .prepare(`SELECT status, COUNT(*) as c FROM follow_ups GROUP BY status`)
    .all() as Array<{ status: FollowUpStatus; c: number }>;
  const counts = { total: 0, pending: 0, completed: 0, overdue: 0 };
  for (const r of rows) {
    counts[r.status] = r.c;
    counts.total += r.c;
  }
  return counts;
}
