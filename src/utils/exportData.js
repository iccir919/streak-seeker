import { getData, getHabits } from './storage';
import { getToday, toDateString } from './dateHelpers';

// --- JSON: a full backup of everything Streak Seeker stores ---------------

// `version` is the format of this file, so a future version of the app can
// tell how to read an older backup.
export const buildJson = () => ({
  app: 'streak-seeker',
  version: 1,
  exportedAt: new Date().toISOString(),
  data: getData()
});

// --- CSV: one row per habit per day, for spreadsheets ----------------------

// Quotes a cell when it needs it. A cell that starts with = + - or @ would
// be run as a formula by Excel or Sheets, so it gets a leading apostrophe.
const csvCell = (value) => {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// Columns: date, time (HH:MM when it was ticked on the day itself,
// otherwise blank), habit, completed (yes/no), archived_on (the day the
// habit was archived, blank for habits that are still active).
export const buildCsv = () => {
  const data = getData();
  const timestamps = data.timestamps || {};
  const rows = [['date', 'time', 'habit', 'completed', 'archived_on']];

  Object.keys(data.logs).sort().forEach((date) => {
    getHabits().forEach((habit) => {
      const done = data.logs[date][habit.id];
      if (done === undefined) return;
      rows.push([
        date,
        (timestamps[date] && timestamps[date][habit.id]) || '',
        habit.name,
        done ? 'yes' : 'no',
        (habit.archived && toDateString(habit.archivedAt)) || ''
      ]);
    });
  });

  return rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
};

// --- Saving the file --------------------------------------------------------

// Uses the browser's normal download. The file is built in memory on this
// device and never sent anywhere.
const downloadFile = (filename, content, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

export const downloadJson = () => {
  downloadFile(
    `streak-seeker-backup-${getToday()}.json`,
    JSON.stringify(buildJson(), null, 2),
    'application/json'
  );
};

export const downloadCsv = () => {
  // The leading BOM makes Excel read the file as UTF-8 (habit names with
  // accents or symbols).
  downloadFile(
    `streak-seeker-history-${getToday()}.csv`,
    '\uFEFF' + buildCsv(),
    'text/csv;charset=utf-8'
  );
};