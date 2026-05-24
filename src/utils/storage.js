const STORAGE_KEY = 'streak_seeker_data';
import { v4 as uuidv4 } from 'uuid';

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

export const addHabit = (habitData) => {
  const data = getData();
  const newHabit = {
    id: uuidv4(),
    name: habitData.name,
    icon: habitData.icon,
    color: habitData.color || '#000000',
    createdAt: new Date().toISOString(),
    order: data.habits.length,
    archived: false,
    archivedAt: null
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

// Archive a habit
export const archiveHabit = (habitId) => {
  const data = getData();
  const habit = data.habits.find(h => h.id === habitId);
  if (habit) {
    habit.archived = true;
    habit.archivedAt = new Date().toISOString();
    saveData(data);
  }
};

// Unarchive a habit
export const unarchiveHabit = (habitId) => {
  const data = getData();
  const habit = data.habits.find(h => h.id === habitId);
  if (habit) {
    habit.archived = false;
    habit.archivedAt = null;
    saveData(data);
  }
};

// Get only active (non-archived) habits
export const getActiveHabits = () => {
  const habits = getHabits();
  return habits.filter(h => !h.archived);
};

// Get only archived habits, sorted by most recent first
export const getArchivedHabits = () => {
  const habits = getHabits();
  return habits
    .filter(h => h.archived)
    .sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
};