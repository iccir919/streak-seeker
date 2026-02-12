const STORAGE_KEY = 'streak_seeker_data';

// Get all data
export const getData = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    return {
      habits: [],
      logs: {}
    };
  }
  return JSON.parse(data);
};

// Save all data
export const saveData = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

// Get all habits
export const getHabits = () => {
  const data = getData();
  return data.habits.sort((a, b) => a.order - b.order);
};

// Add habit
export const addHabit = (habit) => {
  const data = getData();
  const newHabit = {
    id: crypto.randomUUID(),
    name: habit.name,
    icon: habit.icon || '⭐',
    color: habit.color || '#000000',
    createdAt: new Date().toISOString().split('T')[0],
    order: data.habits.length,
    ...habit
  };
  data.habits.push(newHabit);
  saveData(data);
  return newHabit;
};

// Update habit
export const updateHabit = (habitId, updates) => {
  const data = getData();
  const habitIndex = data.habits.findIndex(h => h.id === habitId);
  if (habitIndex !== -1) {
    data.habits[habitIndex] = { ...data.habits[habitIndex], ...updates };
    saveData(data);
    return data.habits[habitIndex];
  }
  return null;
};

// Delete habit
export const deleteHabit = (habitId) => {
  const data = getData();
  data.habits = data.habits.filter(h => h.id !== habitId);
  // Also remove all logs for this habit
  Object.keys(data.logs).forEach(date => {
    delete data.logs[date][habitId];
  });
  saveData(data);
};

// Reorder habits
export const reorderHabits = (habitIds) => {
  const data = getData();
  habitIds.forEach((id, index) => {
    const habit = data.habits.find(h => h.id === id);
    if (habit) {
      habit.order = index;
    }
  });
  saveData(data);
};

// Toggle completion for a specific date
export const toggleCompletion = (habitId, date) => {
  const data = getData();
  if (!data.logs[date]) {
    data.logs[date] = {};
  }
  data.logs[date][habitId] = !data.logs[date][habitId];
  saveData(data);
  return data.logs[date][habitId];
};

// Get completion status for a habit on a date
export const isCompleted = (habitId, date) => {
  const data = getData();
  return data.logs[date]?.[habitId] || false;
};

// Get logs for a habit
export const getHabitLogs = (habitId) => {
  const data = getData();
  const logs = {};
  Object.keys(data.logs).forEach(date => {
    if (data.logs[date][habitId] !== undefined) {
      logs[date] = data.logs[date][habitId];
    }
  });
  return logs;
};