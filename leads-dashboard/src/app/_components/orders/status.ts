import type { OrderStatus } from "@/lib/db";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  waiting_for_scheduling: "Waiting for Scheduling",
  scheduled_for_production: "Scheduled for Production",
  in_production: "In Production",
  shipped: "Shipped",
  void: "Void",
};

export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = (
  Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]
).map((value) => ({ value, label: ORDER_STATUS_LABEL[value] }));

export function statusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case "waiting_for_scheduling":
      return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400";
    case "scheduled_for_production":
      return "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-400";
    case "in_production":
      return "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-400";
    case "shipped":
      return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400";
    case "void":
      return "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400";
  }
}
