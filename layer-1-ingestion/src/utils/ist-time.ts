/** IST-aware time helpers — NEVER use host clock's new Date() directly. */
function istOffsetMinutes(): number { return Number(process.env.IST_OFFSET_MINUTES) || 330; }

function nowIST(): Date { return new Date(Date.now() + istOffsetMinutes() * 60 * 1000); }

function tradingDateIST(): string {
  const d = nowIST();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function nextWeeklyExpiryIST(expiryWeekday: number, rollAfter: string): string {
  const now = nowIST();
  const dow = now.getUTCDay();
  let daysAhead = (expiryWeekday - dow + 7) % 7;
  const [rh, rm] = rollAfter.split(':').map(Number);
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (daysAhead === 0 && mins >= rh * 60 + rm) daysAhead = 7;
  const expiry = new Date(now);
  expiry.setUTCDate(expiry.getUTCDate() + daysAhead);
  return `${expiry.getUTCFullYear()}-${String(expiry.getUTCMonth() + 1).padStart(2, '0')}-${String(expiry.getUTCDate()).padStart(2, '0')}`;
}

export = { istOffsetMinutes, nowIST, tradingDateIST, nextWeeklyExpiryIST };
