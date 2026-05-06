export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="m-0 text-[26px] sm:text-[28px] font-semibold tracking-[-0.02em] leading-tight">
          {title}
        </h1>
        {subtitle && (
          <div className="text-muted-foreground text-[13.5px] mt-1">{subtitle}</div>
        )}
      </div>
      {actions && <div className="flex gap-2 items-center flex-wrap">{actions}</div>}
    </div>
  );
}
