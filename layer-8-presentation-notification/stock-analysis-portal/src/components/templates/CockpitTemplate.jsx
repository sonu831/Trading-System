export default function CockpitTemplate({ safetyBar, chart, context, hero, chain, details }) {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      {/* Sticky safety bar */}
      {safetyBar}

      {/* Main grid */}
      <div className="grid gap-4 p-4
        grid-cols-1
        md:grid-cols-2
        lg:grid-cols-3
        xl:grid-cols-[1fr_300px_300px]">

        {/* Chart — spans 2 cols on md, 1 on lg/xl */}
        <div className="md:col-span-2 lg:col-span-1 xl:col-span-1 min-h-[360px] lg:min-h-[400px]">
          {chart}
        </div>

        {/* Hero + context */}
        <div className="flex flex-col gap-4">
          <div>{hero}</div>
          <div className="flex-1">{context}</div>
        </div>

        {/* Chain or details */}
        <div className="md:col-span-2 lg:col-span-1 xl:col-span-1">
          {chain || details}
        </div>
      </div>

      {/* Collapsible bottom panels */}
      {details && (
        <div className="p-4 border-t border-border">
          {details}
        </div>
      )}
    </div>
  );
}
