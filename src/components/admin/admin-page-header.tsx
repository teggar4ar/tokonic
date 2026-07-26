type AdminPageHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function AdminPageHeader({ title, description, action }: AdminPageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-heading sm:text-page-title">{title}</h1>
        {description ? <p className="mt-1 max-w-prose text-sm text-muted-foreground sm:text-base">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
