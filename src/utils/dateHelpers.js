// Get today's date in YYYY-MM-DD format
export const getToday = () => {
  const today = new Date();
  return formatDate(today);
};

// Format date to YYYY-MM-DD
export const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get day of week (Mon, Tue, etc.)
export const getDayOfWeek = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
};

// Calculate current streak
export const calculateCurrentStreak = (logs) => {
  let streak = 0;
  let currentDate = new Date();
  
  while (true) {
    const dateStr = formatDate(currentDate);
    if (logs[dateStr]) {
      streak++;
    } else {
      break;
    }
    currentDate.setDate(currentDate.getDate() - 1);
  }
  
  // A streak is 2 or more days in a row.
  return streak >= 2 ? streak : 0;
};

// Calculate longest streak
export const calculateLongestStreak = (logs) => {
  const dates = Object.keys(logs).filter(date => logs[date]).sort();
  if (dates.length === 0) return 0;
  
  let longest = 1;
  let current = 1;
  
  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1]);
    const currDate = new Date(dates[i]);
    const dayDiff = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
    
    if (dayDiff === 1) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  
  return longest;
};

// Longest range the Overall and Detail views will show.
export const MAX_RANGE_DAYS = 730;

// Add (or subtract) whole calendar days to a 'YYYY-MM-DD' string.
export const addDays = (dateStr, n) => {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + n);
  return formatDate(date);
};

// Every run of consecutive completed days, oldest first, as
// { start, end, length } with 'YYYY-MM-DD' strings. Uses calendar-day
// steps, so daylight saving changes cannot split a run.
export const getStreakRuns = (logs) => {
  const dates = Object.keys(logs).filter(date => logs[date]).sort();
  const runs = [];
  let run = null;
  for (const date of dates) {
    if (run && addDays(run.end, 1) === date) {
      run.end = date;
      run.length++;
    } else {
      run = { start: date, end: date, length: 1 };
      runs.push(run);
    }
  }
  return runs;
};

// Keeps a start/end pair valid after the user edits one of them.
// - neither date can be in the future
// - if start ends up after end, the date the user did NOT edit follows
// - the range can't be longer than MAX_RANGE_DAYS (start is pulled in)
// `changed` is 'start' or 'end'.
export const normalizeRange = (start, end, changed) => {
  const today = getToday();
  if (end > today) end = today;
  if (start > today) start = today;

  if (start > end) {
    if (changed === 'start') end = start;
    else start = end;
  }

  const earliest = addDays(end, -(MAX_RANGE_DAYS - 1));
  if (start < earliest) start = earliest;

  return { start, end };
};

// Turns a stored date value into a local 'YYYY-MM-DD' string.
// Habits store createdAt/archivedAt as ISO timestamps, while logs use
// plain date strings, so everything is converted to date strings
// before comparing. Returns null for empty or invalid values.
export const toDateString = (value) => {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return null;
  return formatDate(parsed);
};

// Splits a list of days into 7-day groups counted back from the LAST
// day, so the newest group is always a full 7 days. Only the oldest
// group can be shorter. Used for the weekly trend points.
export const groupIntoWeeks = (days) => {
  const groups = [];
  for (let end = days.length; end > 0; end -= 7) {
    groups.unshift(days.slice(Math.max(0, end - 7), end));
  }
  return groups;
};
// Number of calendar days from startStr to endStr, counting both ends.
// Uses Math.round so the local-midnight difference stays whole across
// daylight saving changes.
export const countDaysInclusive = (startStr, endStr) => {
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
};

// The preset buttons, in days (2, 4, 8 and 12 whole weeks). The default
// range is the smallest preset that covers the whole history, so a short
// history is not stretched across a long range.
export const PRESET_DAYS = [14, 28, 56, 84];

// Up to 14 days of history opens on 2 weeks, up to 28 on 4 weeks, up to 56
// on 8 weeks, and anything longer opens on the last 12 weeks.
// `firstDayStr` is the first day tracked, as a 'YYYY-MM-DD' string, or
// null when unknown.
export const getDefaultPresetDays = (firstDayStr) => {
  if (!firstDayStr) return PRESET_DAYS[0];
  const history = countDaysInclusive(firstDayStr, getToday());
  const fit = PRESET_DAYS.find(days => history <= days);
  return fit || PRESET_DAYS[PRESET_DAYS.length - 1];
};