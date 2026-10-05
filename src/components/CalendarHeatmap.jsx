import './CalendarHeatmap.css';

function CalendarHeatmap({ 
  days,
  isBinary = false,
  tooltipFormatter
}) {
  if (!days || days.length === 0) return null;

  // Find the first day and pad with previous days of the week
  const firstDate = new Date(days[0].date + 'T00:00:00');
  const firstDayOfWeek = firstDate.getDay();

  // Pad at the beginning
  const paddedDays = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const padDate = new Date(firstDate);
    padDate.setDate(padDate.getDate() - (i + 1));
    paddedDays.push({
      date: null,
      isPadding: true
    });
  }

  paddedDays.reverse();

  const allCells = [...paddedDays, ...days];

  // Pad at the end to complete the last week
  const remainder = allCells.length % 7;
  if (remainder !== 0) {
    const padCount = 7 - remainder;
    for (let i = 0; i < padCount; i++) {
      allCells.push({
        date: null,
        isPadding: true
      });
    }
  }

  // Split into weeks (rows)
  const weeks = [];
  for (let i = 0; i < allCells.length; i += 7) {
    weeks.push(allCells.slice(i, i + 7));
  }

  // Get color class
  const getColorClass = (day) => {
    if (day.isPadding) return 'cell-padding';
    
    if (isBinary) {
      return day.completed ? 'cell-completed' : 'cell-empty';
    }
    
    if (day.totalHabits === 0) return 'cell-level-0';
    if (day.percentage === 0) return 'cell-level-0';
    if (day.percentage < 25) return 'cell-level-1';
    if (day.percentage < 50) return 'cell-level-2';
    if (day.percentage < 75) return 'cell-level-3';
    if (day.percentage < 100) return 'cell-level-4';
    return 'cell-level-5';
  };

  // Get month label for a row (shown when month changes)
  const getMonthLabel = (week, prevMonth) => {
    const firstRealDay = week.find(d => !d.isPadding);
    if (!firstRealDay) return null;

    const date = new Date(firstRealDay.date + 'T00:00:00');
    const month = date.getMonth();

    if (month !== prevMonth) {
      return {
        text: date.toLocaleDateString('en-US', { month: 'short' }),
        month
      };
    }
    return null;
  };

  // Calculate month labels going from top (most recent) to bottom (oldest)
  let lastMonth = -1;
  const rowsWithLabels = weeks.map((week) => {
    const monthInfo = getMonthLabel(week, lastMonth);
    if (monthInfo) {
      lastMonth = monthInfo.month;
      return { week, label: monthInfo.text };
    }
    return { week, label: null };
  });

  const dayLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  return (
    <div className="cal-heatmap">
      {/* Day-of-week header */}
      <div className="cal-day-header">
        <div className="cal-month-spacer"></div>
        {dayLabels.map((label) => (
          <div key={label} className="cal-day-label">
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="cal-grid">
        {rowsWithLabels.map((row, rowIdx) => (
          <div key={rowIdx} className="cal-week-row">
            <div className="cal-month-label">{row.label || ''}</div>
            {row.week.map((day, dayIdx) => (
              <div
                key={`${rowIdx}-${dayIdx}`}
                className={`cal-cell ${getColorClass(day)}`}
                title={day.isPadding ? '' : (tooltipFormatter ? tooltipFormatter(day) : '')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CalendarHeatmap;