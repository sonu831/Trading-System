function istOffsetMinutes() {
  return Number(process.env.IST_OFFSET_MINUTES) || 330;
}

function nowIST() {
  const offsetMs = istOffsetMinutes() * 60 * 1000;
  return new Date(Date.now() + offsetMs);
}

function nextWeeklyExpiryIST(underlying) {
  underlying = (underlying || 'NIFTY').toUpperCase();
  const expiryDay = underlying === 'BANKNIFTY' ? 3 : 4;
  const cutoffHour = 12;

  const now = nowIST();
  const dow = now.getUTCDay();
  const hours = now.getUTCHours();

  let daysUntil = (expiryDay - dow + 7) % 7;
  if (daysUntil === 0 && hours >= cutoffHour) daysUntil = 7;

  const expiry = new Date(now);
  expiry.setUTCDate(expiry.getUTCDate() + daysUntil);
  expiry.setUTCHours(15, 30, 0, 0);

  const offsetMs = istOffsetMinutes() * 60 * 1000;
  return new Date(expiry.getTime() - offsetMs);
}

module.exports = { nowIST, nextWeeklyExpiryIST, istOffsetMinutes };
