export const formatTime = (timestamp) => {
  if (!timestamp) return 'N/A';
  try {
    // Check if timestamp is a string and handle nanosecond precision
    // (e.g., "2026-01-18T17:29:14.679160385Z")
    let dateObj;
    if (typeof timestamp === 'string') {
      const timeStr = timestamp.replace(/(\.\d{3})\d+/, '$1');
      dateObj = new Date(timeStr);
    } else {
      dateObj = new Date(timestamp);
    }

    // Check for invalid date
    if (isNaN(dateObj.getTime())) return String(timestamp);

    return dateObj.toLocaleTimeString();
  } catch (e) {
    console.error('Error formatting time:', e);
    return String(timestamp);
  }
};

export const formatDate = (timestamp) => {
  if (!timestamp) return 'N/A';
  try {
    let dateObj;
    if (typeof timestamp === 'string') {
      const timeStr = timestamp.replace(/(\.\d{3})\d+/, '$1');
      dateObj = new Date(timeStr);
    } else {
      dateObj = new Date(timestamp);
    }

    if (isNaN(dateObj.getTime())) return String(timestamp);

    return dateObj.toLocaleDateString();
  } catch (e) {
    return String(timestamp);
  }
};
