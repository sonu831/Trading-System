// @ts-nocheck
export default function SectorRotation({ sectors = null }) {
  if (!sectors || sectors.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold">Sector rotation</h2>
          <span className="text-[11px] text-text-tertiary">top-weighted first</span>
        </div>
        <div className="flex items-center justify-center py-8 text-xs text-text-tertiary">— Sector data unavailable</div>
      </div>
    );
  }

  const badgeClass = (s) => {
    const map = { STRONG_UP: 'badge-ok', UP: 'badge-ok', FLAT: 'badge-neutral', DOWN: 'badge-err' };
    return map[s] || 'badge-neutral';
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold">Sector rotation</h2>
        <span className="text-[11px] text-text-tertiary">top-weighted first</span>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
        {sectors.map((s, i) => (
          <div key={i} className="flex items-center justify-between px-2.5 py-2 border border-border rounded-lg text-sm font-semibold">
            <span>{s.name}</span>
            <span className={`badge ${badgeClass(s.status)} text-[10px] font-bold px-2 py-1 rounded-full border`}>{s.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
