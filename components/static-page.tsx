export function StaticPage({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 py-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/5">
            <Icon className="h-4.5 w-4.5 text-navy" strokeWidth={1.75} />
          </span>
        )}
        <h1 className="font-heading text-2xl font-semibold text-ink">{title}</h1>
      </div>
      <div className="flex flex-col gap-3 font-body text-sm leading-relaxed text-ink-soft">
        {children}
      </div>
    </div>
  );
}
