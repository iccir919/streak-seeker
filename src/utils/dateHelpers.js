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

// Get date N days ago
export const getDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date);
};

// Get array of last N days
export const getLastNDays = (n) => {
  const dates = [];
  for (let i = n - 1; i >= 0; i--) {
    dates.push(getDaysAgo(i));
  }
  return dates;
};

// Get day of week (Mon, Tue, etc.)
export const getDayOfWeek = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
};

// Calculate current streak
export const calculateCurrentStreak = (logs) => {
  const today = getToday();
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

// Get completion stats for different periods
export const getCompletionStats = (logs, createdAt) => {
  const today = new Date();
  const created = new Date(createdAt);
  
  const getLast = (days) => {
    let completed = 0;
    let total = 0;
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = formatDate(date);
      if (logs[dateStr] !== undefined) {
        total++;
        if (logs[dateStr]) completed++;
      }
    }
    return { completed, total, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };
  
  const getAllTime = () => {
    const daysSinceCreation = Math.floor((today - created) / (1000 * 60 * 60 * 24)) + 1;
    let completed = 0;
    for (let i = 0; i < daysSinceCreation; i++) {
      const date = new Date(created);
      date.setDate(date.getDate() + i);
      const dateStr = formatDate(date);
      if (logs[dateStr]) completed++;
    }
    return { completed, total: daysSinceCreation, rate: Math.round((completed / daysSinceCreation) * 100) };
  };
  
  return {
    last7: getLast(7),
    last30: getLast(30),
    last90: getLast(90),
    allTime: getAllTime()
  };
};