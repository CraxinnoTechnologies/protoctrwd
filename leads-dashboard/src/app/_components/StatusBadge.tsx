import type { FollowUpStatus } from "@/lib/db";

export function StatusBadge({ status }: { status: FollowUpStatus }) {
  const label = status[0].toUpperCase() + status.slice(1);
  const cls = {
    overdue:
      "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400",
    pending:
      "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    completed:
      "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
  }[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-5 px-2 rounded-full border text-[11px] font-medium ${cls}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-85" />
      {label}
    </span>
  );
}
