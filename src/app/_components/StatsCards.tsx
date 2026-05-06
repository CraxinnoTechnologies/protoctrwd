import { ArrowUpRight, Clock, CheckCircle2, AlertCircle } from "lucide-react";

type Counts = { total: number; pending: number; completed: number; overdue: number };

export function StatsCards({ counts }: { counts: Counts }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr] gap-3 mb-5">
      <div className="bg-foreground text-background border border-foreground rounded-[10px] p-4 flex flex-col gap-1.5">
        <div className="text-[12px] font-medium opacity-70">Total Follow Ups</div>
        <div className="text-[30px] font-bold tracking-[-0.02em] leading-none tabular-nums">
          {counts.total}
        </div>
        <div className="flex items-center justify-between text-[11.5px] opacity-70">
          <span>
            {counts.overdue} overdue · {counts.completed} completed
          </span>
          <ArrowUpRight size={13} />
        </div>
      </div>
      <Card label="Pending" value={counts.pending} hint="Awaiting action" Icon={Clock} />
      <Card
        label="Completed"
        value={counts.completed}
        hint="This month"
        Icon={CheckCircle2}
        valueClass="text-emerald-700 dark:text-emerald-400"
      />
      <Card
        label="Overdue"
        value={counts.overdue}
        hint="Needs attention"
        Icon={AlertCircle}
        valueClass="text-red-600 dark:text-red-400"
      />
    </div>
  );
}

function Card({
  label,
  value,
  hint,
  Icon,
  valueClass = "",
}: {
  label: string;
  value: number;
  hint: string;
  Icon: React.ComponentType<{ size?: number }>;
  valueClass?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-[10px] p-4 flex flex-col gap-1.5">
      <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
      <div
        className={`text-[30px] font-bold tracking-[-0.02em] leading-none tabular-nums ${valueClass}`}
      >
        {value}
      </div>
      <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
        <span>{hint}</span>
        <Icon size={13} />
      </div>
    </div>
  );
}
