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
  
  return streak;
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