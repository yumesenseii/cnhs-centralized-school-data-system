/**
 * Page header shell shared by admin and teacher portals.
 */
export default function Header({
  breadcrumb,
  title,
  description,
  controls,
}) {
  return (
    <header className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-[10px] font-medium text-slate-400">{breadcrumb}</p>
        <h1 className="mt-0.5 text-xl font-semibold tracking-[-0.03em] text-slate-800 sm:text-[22px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        ) : null}
      </div>

      {controls ? (
        <div className="flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto sm:justify-end">
          {controls}
        </div>
      ) : null}
    </header>
  );
}
