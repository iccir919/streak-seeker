import { useRef, useEffect, useState } from 'react';
import './GitHubHeatmap.css';

function GitHubHeatmap({ 
  days,
  isBinary = false,
  tooltipFormatter
}) {
  const containerRef = useRef(null);
  const [cellSize, setCellSize] = useState(14);

  if (!days || days.length === 0) return null;

  // Find the start date and pad with previous days to align with Sunday
  const firstDate = new Date(days[0].date + 'T00:00:00');
  const firstDayOfWeek = firstDate.getDay();

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

  // Calculate weeks (columns)
  const weeks = [];
  for (let i = 0; i < allCells.length; i += 7) {
    weeks.push(allCells.slice(i, i + 7));
  }

  // Auto-calculate cell size based on container width
  useEffect(() => {
    if (!containerRef.current) return;

    const calculateCellSize = () => {
      const containerWidth = containerRef.current.offsetWidth;
      const dayLabelWidth = 22;
      const gapWidth = 4;
      const cellGap = 3;
      
      const availableWidth = containerWidth - dayLabelWidth - gapWidth;
      const totalGapsWidth = (weeks.length - 1) * cellGap;
      const calculatedSize = Math.floor((availableWidth - totalGapsWidth) / weeks.length);
      
      // Removed cap to let cells fill container
      const finalSize = Math.max(8, calculatedSize);
      setCellSize(finalSize);
    };

    calculateCellSize();
    window.addEventListener('resize', calculateCellSize);
    return () => window.removeEventListener('resize', calculateCellSize);
  }, [weeks.length]);

  // Get color class based on completion
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

  // Get month labels with their column positions
  const getMonthLabels = () => {
    const labels = [];
    let lastMonth = -1;

    weeks.forEach((week, weekIndex) => {
      const firstRealDay = week.find(d => !d.isPadding);
      if (!firstRealDay) return;

      const date = new Date(firstRealDay.date + 'T00:00:00');
      const month = date.getMonth();

      if (month !== lastMonth && date.getDate() <= 7) {
        labels.push({
          text: date.toLocaleDateString('en-US', { month: 'short' }),
          weekIndex
        });
        lastMonth = month;
      }
    });

    return labels;
  };

  const monthLabels = getMonthLabels();
  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  return (
    <div className="gh-heatmap" ref={containerRef} style={{ '--cell-size': `${cellSize}px` }}>
      {/* Month labels at top */}
      <div className="gh-month-labels">
        <div className="gh-day-label-spacer"></div>
        <div className="gh-month-labels-row">
          {weeks.map((_, idx) => {
            const label = monthLabels.find(m => m.weekIndex === idx);
            return (
              <div key={idx} className="gh-month-label-cell">
                {label ? label.text : ''}
              </div>
            );
          })}
        </div>
      </div>

      {/* Heatmap with day labels */}
      <div className="gh-heatmap-body">
        <div className="gh-day-labels">
          {dayLabels.map((label, idx) => (
            <div key={idx} className="gh-day-label">
              {label}
            </div>
          ))}
        </div>

        <div className="gh-weeks">
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="gh-week-column">
              {week.map((day, dayIdx) => (
                <div
                  key={`${weekIdx}-${dayIdx}`}
                  className={`gh-cell ${getColorClass(day)}`}
                  title={day.isPadding ? '' : (tooltipFormatter ? tooltipFormatter(day) : '')}
                />
              ))}
              {week.length < 7 && Array.from({ length: 7 - week.length }).map((_, idx) => (
                <div key={`empty-${idx}`} className="gh-cell cell-padding" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GitHubHeatmap;