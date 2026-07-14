// Lightweight canvas sparkline/candle chart — no chart library dependency.
function MiniChart({ data = [], height = 120, color = 'var(--color-primary)', kind = 'line' }) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas || data.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const min = Math.min(...data), max = Math.max(...data);
    const range = max - min || 1;
    const pad = 8;
    const x = (i) => pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = (v) => h - pad - ((v - min) / range) * (h - pad * 2);

    const resolved = getComputedStyle(canvas).getPropertyValue('--resolved-color') || color;

    // gradient fill under line
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, colorWithAlpha(color, 0.25));
    grad.addColorStop(1, colorWithAlpha(color, 0));

    ctx.beginPath();
    data.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
    ctx.lineTo(x(data.length - 1), h - pad);
    ctx.lineTo(x(0), h - pad);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    data.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
    ctx.strokeStyle = getCssColor(color);
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [data, height, color]);

  function getCssColor(v) {
    if (!v.startsWith('var(')) return v;
    const varName = v.slice(4, -1);
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#3B82F6';
  }
  function colorWithAlpha(v, a) {
    const c = getCssColor(v);
    if (c.startsWith('#')) {
      const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    return c;
  }

  return <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} />;
}
window.MiniChart = MiniChart;
