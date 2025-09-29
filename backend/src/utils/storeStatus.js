// Utilities to compute store open/closed status consistently

function parseTimeToMinutes(t) {
  if (!t || typeof t !== 'string') return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const mm = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  return hh * 60 + mm;
}

function isWithinWindow(nowMin, openMin, closeMin) {
  if (openMin == null || closeMin == null) return false;
  if (openMin === closeMin) return false; // zero window => closed
  if (closeMin > openMin) {
    // same day window
    return nowMin >= openMin && nowMin < closeMin; // close boundary exclusive
  } else {
    // crosses midnight (e.g., 18:00 -> 02:00)
    return nowMin >= openMin || nowMin < closeMin;
  }
}

function computeEffectiveClosed(status, hours, now = new Date()) {
  // Manual closed takes precedence
  if (status && status.closed_now) return true;
  // Automatic mode (is_manual_mode === false): follow schedule
  if (!status || status.is_manual_mode === false) {
    const dow = now.getDay();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const today = (hours || []).find(h => Number(h.day) === dow);
    if (!today || !today.enabled) return true; // no schedule => closed
    const openMin = parseTimeToMinutes(today.open);
    const closeMin = parseTimeToMinutes(today.close);
    const open = isWithinWindow(nowMin, openMin, closeMin);
    return !open;
  }
  // Manual mode and not explicitly closed => open
  return false;
}

// Find the next boundary Date when status might change
// Returns a JS Date or null if no scheduled change
function getNextBoundary(status, hours, now = new Date()) {
  // If manual closed with a reopen_at, that's the next boundary
  if (status && status.closed_now && status.reopen_at) {
    const reopen = new Date(status.reopen_at);
    if (reopen > now) return reopen;
  }

  // In manual mode without closed_now true, there is no time-based boundary
  if (status && status.is_manual_mode === true && !status.closed_now) return null;

  // Automatic mode: compute next open/close time
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayIdx = now.getDay();

  // Helper to build Date from day offset and minutes
  const buildDate = (dayOffset, minutes) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    const hh = Math.floor(minutes / 60);
    const mm = minutes % 60;
    d.setHours(hh, mm, 0, 0);
    return d;
  };

  // Determine today's window
  const getDayCfg = (idx) => (hours || []).find(h => Number(h.day) === ((idx % 7) + 7) % 7);
  const today = getDayCfg(todayIdx);

  const currentClosed = computeEffectiveClosed(status, hours, now);

  // If no valid hours today and we're closed, find the next enabled day's open
  const findNextOpen = () => {
    for (let i = 0; i < 8; i++) {
      const cfg = getDayCfg(todayIdx + i);
      if (cfg && cfg.enabled) {
        const openMin = parseTimeToMinutes(cfg.open);
        if (openMin == null) continue;
        if (i === 0) {
          // Today: if open time is still ahead
          if (nowMin < openMin) return buildDate(0, openMin);
          // If close < open means overnight start today
          const closeMin = parseTimeToMinutes(cfg.close);
          if (closeMin != null && closeMin < openMin) {
            // Overnight window: if we are before close, we're actually open; won't reach here typically
            // Next open is tomorrow's open; continue loop
          }
        } else {
          return buildDate(i, openMin);
        }
      }
    }
    return null;
  };

  const findNextClose = () => {
    if (!today || !today.enabled) return null;
    const openMin = parseTimeToMinutes(today.open);
    const closeMin = parseTimeToMinutes(today.close);
    if (openMin == null || closeMin == null || openMin === closeMin) return null;
    if (closeMin > openMin) {
      // same-day window
      if (nowMin < closeMin) return buildDate(0, closeMin);
      return findNextOpen();
    } else {
      // overnight: close is tomorrow
      if (nowMin >= openMin) {
        // we're in the nightly open period, closes after midnight
        return buildDate(1, closeMin);
      } else {
        // before open, the next close corresponds to tomorrow's close after opening tonight
        // but next significant change for closed state is the open later today; handled by findNextOpen
        return findNextOpen();
      }
    }
  };

  if (currentClosed) {
    return findNextOpen();
  } else {
    return findNextClose();
  }
}

module.exports = {
  parseTimeToMinutes,
  isWithinWindow,
  computeEffectiveClosed,
  getNextBoundary,
  composePublicStatus: (status, hours, now = new Date()) => {
    const effectiveClosed = computeEffectiveClosed(status, hours, now);
    const nextBoundary = getNextBoundary(status, hours, now);
    const reopenAt = effectiveClosed
      ? (nextBoundary ? nextBoundary.toISOString() : (status?.reopen_at || null))
      : null;
    return {
      closedNow: !!status?.closed_now,
      effectiveClosed,
      reopenAt,
      reason: status?.reason || '',
      isManualMode: !!status?.is_manual_mode,
      nextChangeAt: nextBoundary ? nextBoundary.toISOString() : null
    };
  }
};
