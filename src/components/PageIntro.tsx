export function PageIntro({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-2xl font-semibold text-slate-50">{title}</h2>
      <p className="text-sm text-slate-200">{children}</p>
    </div>
  );
}
