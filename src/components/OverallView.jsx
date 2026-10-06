import { useState, useRef, useLayoutEffect, useEffect, useMemo } from 'react';
import { getHabits, getHabitLogs } from '../utils/storage';
import { formatDate, normalizeRange, toDateString, groupIntoWeeks } from '../utils/dateHelpers';
import './OverallView.css';

// Earlier of: the day the habit was created, or its first logged
// completion. Returned as a 'YYYY-MM-DD' string so it compares cleanly
// against calendar days (a habit created at 3pm counts for that whole day).
const computeHabitStartStr = (habit, logs) => {
  const createdStr = toDateString(habit.createdAt);
  const firstLogStr = Object.keys(logs).filter(d => logs[d]).sort()[0] || null;
  if (createdStr && firstLogStr) return createdStr < firstLogStr ? createdStr : firstLogStr;
  return createdStr || firstLogStr;
};

// A habit counts on a day if it had started and was not yet archived.
const isActiveOnDate = (info, dateStr) => {
  if (!info.startStr) return false;
  if (dateStr < info.startStr) return false;
  if (info.archiveStr && dateStr > info.archiveStr) return false;
  return true;
};

// Wrapper only decides between the empty state and the real view. All
// hooks live in OverallContent so they always run in the same order.
function OverallView({ onBack }) {
  const habits = getHabits();

  if (habits.length === 0) {
    return (
      <div className="overall-view">
        <div className="overall-header">
          <button className="btn-back" onClick={onBack}>
            ←
          </button>
          <h1 className="overall-title">Overall Stats</h1>
        </div>
        <div className="overall-content">
          <div className="empty-state-overall">
            <div className="empty-state-icon">📊</div>
            <h2>No Data Yet</h2>
            <p>Add some habits and start tracking to see your stats here!</p>
            <button className="btn-back-to-main" onClick={onBack}>
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <OverallContent habits={habits} onBack={onBack} />;
}

function OverallContent({ habits, onBack }) {

  const getDefaultStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return formatDate(date);
  };

  const getDefaultEndDate = () => {
    return formatDate(new Date());
  };

  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(getDefaultEndDate());
  const [activePreset, setActivePreset] = useState(30);
  const [trendView, setTrendView] = useState('chart'); // 'chart' | 'heatmap'
  const [cellSize, setCellSize] = useState(20);
  const [isScrollable, setIsScrollable] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const hmContainerRef = useRef(null);
  const scrollRegionRef = useRef(null);
  const plotAreaRef = useRef(null);
  const tooltipRef = useRef(null);

  // Read storage ONCE per set of habits (not once per habit per day).
  // Each entry holds that habit's logs plus its start and archive days.
  const habitData = useMemo(() => {
    const map = {};
    habits.forEach(habit => {
      const logs = getHabitLogs(habit.id);
      map[habit.id] = {
        logs,
        startStr: computeHabitStartStr(habit, logs),
        archiveStr: toDateString(habit.archivedAt)
      };
    });
    return map;
  }, [habits]);

  const getActiveHabitsOnDate = (dateStr) => {
    return habits.filter(habit => isActiveOnDate(habitData[habit.id], dateStr));
  };

  const getDaysInRange = () => {
    const days = [];
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');

    let cursor = new Date(start);
    while (cursor <= end) {
      const dateStr = formatDate(cursor);

      const activeHabitsOnDate = getActiveHabitsOnDate(dateStr);

      let completedCount = 0;
      activeHabitsOnDate.forEach(habit => {
        if (habitData[habit.id].logs[dateStr]) completedCount++;
      });

      days.push({
        date: dateStr,
        completedCount,
        totalHabits: activeHabitsOnDate.length,
        percentage: activeHabitsOnDate.length > 0
          ? Math.round((completedCount / activeHabitsOnDate.length) * 100)
          : 0
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  };

  const calculateStats = (rangeData) => {
    let totalCompletions = 0;
    let totalPossible = 0;
    let perfectDays = 0;

    rangeData.forEach(day => {
      totalCompletions += day.completedCount;
      totalPossible += day.totalHabits;

      if (day.totalHabits > 0 && day.percentage === 100) {
        perfectDays++;
      }
    });

    const overallRate = totalPossible > 0 
      ? Math.round((totalCompletions / totalPossible) * 100) 
      : 0;

    const avgPerDay = rangeData.length > 0 
      ? (totalCompletions / rangeData.length).toFixed(1) 
      : 0;

    return {
      totalCompletions,
      totalPossible,
      overallRate,
      perfectDays,
      avgPerDay
    };
  };

  const getHabitStats = (rangeData) => {
    return habits.map(habit => {
      const info = habitData[habit.id];
      const logs = info.logs;
      
      let completions = 0;
      let activeDaysInPeriod = 0;
      
      rangeData.forEach(day => {
        if (isActiveOnDate(info, day.date)) {
          activeDaysInPeriod++;
          if (logs[day.date]) completions++;
        }
      });

      const rate = activeDaysInPeriod > 0 
        ? Math.round((completions / activeDaysInPeriod) * 100) 
        : 0;

      return {
        habit,
        completions,
        activeDays: activeDaysInPeriod,
        rate
      };
    })
    .filter(item => item.activeDays > 0)
    .sort((a, b) => b.rate - a.rate);
  };

  const getTrendData = (rangeData) => {
    const totalDays = rangeData.length;

    if (totalDays <= 14) {
      return rangeData.map(day => {
        const date = new Date(day.date + 'T00:00:00');
        return {
          label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          percentage: day.percentage
        };
      });
    } else if (totalDays < 180) {
      // 7-day points counted back from the end date, so the newest point
      // is always a full week. Only the oldest point can be shorter, and
      // its tooltip says how many days it covers.
      return groupIntoWeeks(rangeData).map(week => {
        const totalCompleted = week.reduce((sum, d) => sum + d.completedCount, 0);
        const totalPossible = week.reduce((sum, d) => sum + d.totalHabits, 0);
        const percentage = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;
        const firstDate = new Date(week[0].date + 'T00:00:00');
        const lastDate = new Date(week[week.length - 1].date + 'T00:00:00');
        const shortDate = { month: 'short', day: 'numeric' };
        const dayNote = week.length < 7 ? ` (${week.length} day${week.length === 1 ? '' : 's'})` : '';
        return {
          label: firstDate.toLocaleDateString('en-US', shortDate),
          fullLabel: `${firstDate.toLocaleDateString('en-US', shortDate)} - ${lastDate.toLocaleDateString('en-US', shortDate)}${dayNote}`,
          percentage
        };
      });
    } else {
      const monthGroups = {};
      
      rangeData.forEach(day => {
        const date = new Date(day.date + 'T00:00:00');
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        if (!monthGroups[key]) {
          monthGroups[key] = { 
            label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), 
            totalCompleted: 0, 
            totalPossible: 0 
          };
        }
        monthGroups[key].totalCompleted += day.completedCount;
        monthGroups[key].totalPossible += day.totalHabits;
      });

      return Object.values(monthGroups).map(group => ({
        label: group.label,
        fullLabel: group.label,
        percentage: group.totalPossible > 0 
          ? Math.round((group.totalCompleted / group.totalPossible) * 100) 
          : 0
      }));
    }
  };

  const getHeatmapGrid = (rangeData) => {
    if (rangeData.length === 0) return [];

    const firstDate = new Date(rangeData[0].date + 'T00:00:00');
    const firstDayOfWeek = firstDate.getDay();

    const paddedDays = [];
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const padDate = new Date(firstDate);
      padDate.setDate(padDate.getDate() - (i + 1));
      paddedDays.push({ date: null, isPadding: true });
    }

    const allCells = [...paddedDays, ...rangeData];

    const remainder = allCells.length % 7;
    if (remainder !== 0) {
      const padCount = 7 - remainder;
      for (let i = 0; i < padCount; i++) {
        allCells.push({ date: null, isPadding: true });
      }
    }

    const weeks = [];
    for (let i = 0; i < allCells.length; i += 7) {
      weeks.push(allCells.slice(i, i + 7));
    }

    return weeks;
  };

  const getHeatmapColorClass = (day) => {
    if (day.isPadding) return 'ov-hm-cell-padding';
    if (day.totalHabits === 0) return 'ov-hm-cell-level-0';
    if (day.percentage === 0) return 'ov-hm-cell-level-0';
    if (day.percentage < 25) return 'ov-hm-cell-level-1';
    if (day.percentage < 50) return 'ov-hm-cell-level-2';
    if (day.percentage < 75) return 'ov-hm-cell-level-3';
    if (day.percentage < 100) return 'ov-hm-cell-level-4';
    return 'ov-hm-cell-level-5';
  };

  const getHeatmapTooltip = (day) => {
    if (day.isPadding) return '';
    const date = new Date(day.date + 'T00:00:00');
    const dateText = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${dateText}: ${day.completedCount}/${day.totalHabits} habits (${day.percentage}%)`;
  };

  const getMonthLabelCandidates = (weeks) => {
    const labels = [];
    let lastMonth = -1;

    weeks.forEach((week) => {
      const firstRealDay = week.find(d => !d.isPadding);
      if (!firstRealDay) {
        labels.push(null);
        return;
      }

      const date = new Date(firstRealDay.date + 'T00:00:00');
      const month = date.getMonth();

      if (month !== lastMonth) {
        labels.push(date.toLocaleDateString('en-US', { month: 'short' }));
        lastMonth = month;
      } else {
        labels.push(null);
      }
    });

    return labels;
  };

  const getVisibleMonthLabels = (candidates, cellSizePx) => {
    const minColumnsBetweenLabels = cellSizePx < 22 ? Math.ceil(22 / cellSizePx) : 1;

    const visible = new Array(candidates.length).fill(null);
    let lastShownIndex = -Infinity;

    candidates.forEach((label, idx) => {
      if (label === null) return;
      if (idx - lastShownIndex >= minColumnsBetweenLabels) {
        visible[idx] = label;
        lastShownIndex = idx;
      }
    });

    return visible;
  };

  const handlePresetClick = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    
    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
    setActivePreset(days);
  };

  // An empty value means the user cleared the field (or is mid-typing),
  // so keep the last valid date instead of breaking the range.
  const handleStartDateChange = (e) => {
    if (!e.target.value) return;
    const range = normalizeRange(e.target.value, endDate, 'start');
    setStartDate(range.start);
    setEndDate(range.end);
    setActivePreset(null);
  };

  const handleEndDateChange = (e) => {
    if (!e.target.value) return;
    const range = normalizeRange(startDate, e.target.value, 'end');
    setStartDate(range.start);
    setEndDate(range.end);
    setActivePreset(null);
  };

  const rangeData = getDaysInRange();
  const heatmapWeeks = trendView === 'heatmap' ? getHeatmapGrid(rangeData) : [];
  const monthLabelCandidates = trendView === 'heatmap' ? getMonthLabelCandidates(heatmapWeeks) : [];
  const layoutMode = rangeData.length <= 30 ? 'calendar' : 'github';
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayStr = formatDate(new Date());

  const monthLabels = trendView === 'heatmap'
    ? getVisibleMonthLabels(monthLabelCandidates, cellSize)
    : [];

  useLayoutEffect(() => {
    if (trendView !== 'heatmap' || !hmContainerRef.current) return;

    const calculate = () => {
      const containerWidth = hmContainerRef.current.offsetWidth;
      const gap = 6;

      if (layoutMode === 'calendar') {
        const monthLabelWidth = 32;
        const available = containerWidth - monthLabelWidth - 6;
        const totalGaps = (7 - 1) * gap;
        const size = (available - totalGaps) / 7;
        setCellSize(Math.round(Math.max(18, Math.min(46, size))));
      } else {
        const dayLabelWidth = 28;
        const numWeeks = heatmapWeeks.length || 1;
        const available = containerWidth - dayLabelWidth - 6;
        const totalGaps = (numWeeks - 1) * gap;
        const rawSize = (available - totalGaps) / numWeeks;
        setCellSize(Math.floor(Math.max(10, Math.min(36, rawSize))));
      }
    };

    calculate();
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, [trendView, layoutMode, heatmapWeeks.length]);

  // FIX: tolerance is now roughly one cell-width instead of a couple
  // px, so a trailing sliver (e.g. padding cells finishing out the
  // last week) doesn't keep the fade showing after you've scrolled as
  // far as there is meaningful content to see.
  useEffect(() => {
    if (trendView !== 'heatmap' || layoutMode !== 'github') {
      setIsScrollable(false);
      return;
    }

    const el = scrollRegionRef.current;
    if (!el) return;

    const updateFade = () => {
      const remaining = el.scrollWidth - el.scrollLeft - el.clientWidth;
      const tolerance = Math.max(8, cellSize);
      setIsScrollable(remaining > tolerance);
    };

    updateFade();
    el.addEventListener('scroll', updateFade);
    window.addEventListener('resize', updateFade);
    return () => {
      el.removeEventListener('scroll', updateFade);
      window.removeEventListener('resize', updateFade);
    };
  }, [trendView, layoutMode, cellSize, heatmapWeeks.length]);

  const stats = calculateStats(rangeData);
  const habitStats = getHabitStats(rangeData);
  const trendData = getTrendData(rangeData);

  const chartWidth = 400;
  const chartHeight = 100;
  const chartPadding = 4;
  const points = trendData.map((item, index) => {
    const x = trendData.length > 1
      ? chartPadding + (index / (trendData.length - 1)) * (chartWidth - chartPadding * 2)
      : chartWidth / 2;
    const y = chartPadding + (1 - item.percentage / 100) * (chartHeight - chartPadding * 2);
    return { x, y, ...item };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`
    : '';

  const yAxisTicks = [
    { value: 100, y: chartPadding },
    { value: 50, y: chartPadding + 0.5 * (chartHeight - chartPadding * 2) },
    { value: 0, y: chartHeight - chartPadding }
  ];

  // Position is set immediately from the SVG-space point (unclamped);
  // the actual clamping against real measured tooltip width happens
  // in the useLayoutEffect below, once the tooltip DOM exists.
  const handlePointHover = (e, point) => {
    const svgEl = e.currentTarget.ownerSVGElement;
    const svgRect = svgEl.getBoundingClientRect();
    const scaleX = svgRect.width / chartWidth;
    const scaleY = svgRect.height / chartHeight;

    const rawX = point.x * scaleX;
    const screenY = point.y * scaleY;

    const plotRect = plotAreaRef.current ? plotAreaRef.current.getBoundingClientRect() : null;
    const svgOffsetX = plotRect ? svgRect.left - plotRect.left : 0;
    const absoluteX = svgOffsetX + rawX;

    setHoveredPoint({
      screenX: absoluteX,
      screenY,
      label: point.fullLabel || point.label,
      percentage: point.percentage
    });
  };

  // FIX: clamps the tooltip using its ACTUAL rendered width (measured
  // via ref) against the actual popup edges (via .overall-content),
  // instead of a guessed fixed width against the plot area. This is
  // what makes it reliably stay inside the popup regardless of how
  // wide any given date label happens to be.
  useLayoutEffect(() => {
    if (!hoveredPoint || !tooltipRef.current || !plotAreaRef.current) return;

    const tooltipEl = tooltipRef.current;
    const plotRect = plotAreaRef.current.getBoundingClientRect();
    const popupEl = plotAreaRef.current.closest('.overall-content') || plotAreaRef.current.closest('.overall-view');
    const popupRect = popupEl ? popupEl.getBoundingClientRect() : plotRect;

    const tooltipWidth = tooltipEl.offsetWidth;
    const halfWidth = tooltipWidth / 2;

    // Convert popup bounds into plot-area-relative coordinates, since
    // that's the coordinate space `left` is applied in.
    const minX = (popupRect.left - plotRect.left) + halfWidth + 4;
    const maxX = (popupRect.right - plotRect.left) - halfWidth - 4;

    setHoveredPoint(prev => {
      if (!prev) return prev;
      const clamped = Math.max(minX, Math.min(maxX, prev.screenX));
      if (clamped === prev.screenX) return prev;
      return { ...prev, screenX: clamped };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredPoint && hoveredPoint.label, hoveredPoint && hoveredPoint.percentage]);

  return (
    <div className="overall-view">
      <div className="overall-header">
        <button className="btn-back" onClick={onBack}>
          ←
        </button>
        <h1 className="overall-title">Overall Stats</h1>
      </div>

      <div className="overall-content">
        <div className="controls-stack">
          <div className="controls-row-top">
            <div className="date-inputs">
              <span className="date-label">Range:</span>
              <input
                type="date"
                value={startDate}
                onChange={handleStartDateChange}
                max={endDate}
                className="date-input"
              />
              <span className="date-separator">to</span>
              <input
                type="date"
                value={endDate}
                onChange={handleEndDateChange}
                min={startDate}
                max={formatDate(new Date())}
                className="date-input"
              />
            </div>
          </div>

          <div className="preset-buttons">
            <button
              className={`preset-btn ${activePreset === 7 ? 'active' : ''}`}
              onClick={() => handlePresetClick(7)}
            >
              7 Days
            </button>
            <button
              className={`preset-btn ${activePreset === 30 ? 'active' : ''}`}
              onClick={() => handlePresetClick(30)}
            >
              30 Days
            </button>
            <button
              className={`preset-btn ${activePreset === 60 ? 'active' : ''}`}
              onClick={() => handlePresetClick(60)}
            >
              60 Days
            </button>
            <button
              className={`preset-btn ${activePreset === 90 ? 'active' : ''}`}
              onClick={() => handlePresetClick(90)}
            >
              90 Days
            </button>
          </div>
        </div>

        <div className="section">
          {trendView === 'chart' ? (
            <div className="line-chart-wrapper">
              <div className="line-chart-plot-area" ref={plotAreaRef}>
                <div className="line-chart-y-axis">
                  {yAxisTicks.map((tick) => (
                    <span key={tick.value} className="line-chart-y-label">{tick.value}%</span>
                  ))}
                </div>
                <svg
                  className="line-chart-svg"
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  preserveAspectRatio="none"
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  {yAxisTicks.map((tick) => (
                    <line
                      key={tick.value}
                      x1={0}
                      y1={tick.y}
                      x2={chartWidth}
                      y2={tick.y}
                      stroke="#EEEEEE"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  {areaPath && (
                    <path d={areaPath} fill="url(#lineFade)" stroke="none" />
                  )}
                  <defs>
                    <linearGradient id="lineFade" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="black" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="black" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {linePath && (
                    <path d={linePath} fill="none" stroke="black" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  )}
                  {points.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r="2.5"
                      fill="black"
                      onMouseEnter={(e) => handlePointHover(e, p)}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </svg>
                {hoveredPoint && (
                  <div
                    ref={tooltipRef}
                    className="line-chart-tooltip"
                    style={{
                      left: `${hoveredPoint.screenX}px`,
                      top: `${hoveredPoint.screenY}px`
                    }}
                  >
                    <div className="line-chart-tooltip-date">{hoveredPoint.label}</div>
                    <div className="line-chart-tooltip-value">{hoveredPoint.percentage}%</div>
                  </div>
                )}
              </div>
              <div className="line-chart-labels">
                {trendData.map((item, index) => (
                  <span key={index} className="line-chart-label">{item.label}</span>
                ))}
              </div>
            </div>
          ) : layoutMode === 'calendar' ? (
            <div className="ov-hm-cal-container" ref={hmContainerRef} style={{ '--hm-cell-size': `${cellSize}px` }}>
              <div className="ov-hm-cal-day-header">
                <div className="ov-hm-cal-month-spacer" />
                {dayLabels.map((label) => (
                  <div key={label} className="ov-hm-cal-day-label">{label}</div>
                ))}
              </div>
              <div className="ov-hm-cal-grid">
                {heatmapWeeks.map((week, weekIdx) => (
                  <div key={weekIdx} className="ov-hm-cal-week-row">
                    <div className="ov-hm-cal-month-label">{monthLabels[weekIdx] || ''}</div>
                    {week.map((day, dayIdx) => (
                      <div
                        key={`${weekIdx}-${dayIdx}`}
                        className={`ov-hm-cell ${getHeatmapColorClass(day)} ${day.date === todayStr ? 'ov-hm-cell-today' : ''}`}
                        title={getHeatmapTooltip(day)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={`ov-hm-container ${isScrollable ? 'is-scrollable' : ''}`} ref={hmContainerRef} style={{ '--hm-cell-size': `${cellSize}px` }}>
              <div className="ov-hm-day-labels">
                {dayLabels.map((label) => (
                  <div key={label} className="ov-hm-day-label">{label}</div>
                ))}
              </div>
              <div className="ov-hm-scroll-region" ref={scrollRegionRef}>
                <div className="ov-hm-scroll-content">
                  <div className="ov-hm-grid">
                    {heatmapWeeks.map((week, weekIdx) => (
                      <div key={weekIdx} className="ov-hm-week-column">
                        {week.map((day, dayIdx) => (
                          <div
                            key={`${weekIdx}-${dayIdx}`}
                            className={`ov-hm-cell ${getHeatmapColorClass(day)} ${day.date === todayStr ? 'ov-hm-cell-today' : ''}`}
                            title={getHeatmapTooltip(day)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="ov-hm-month-labels">
                    {monthLabels.map((label, idx) => (
                      <div key={idx} className="ov-hm-month-label-cell">{label || ''}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${trendView === 'chart' ? 'active' : ''}`}
              onClick={() => setTrendView('chart')}
            >
              Chart
            </button>
            <button
              className={`view-toggle-btn ${trendView === 'heatmap' ? 'active' : ''}`}
              onClick={() => setTrendView('heatmap')}
            >
              Heatmap
            </button>
          </div>

          <div className="stats-overview">
            <div className="stat-card-small">
              <div className="stat-value-small">{stats.overallRate}%</div>
              <div className="stat-label-small">Completion Rate</div>
            </div>
            <div className="stat-card-small">
              <div className="stat-value-small">{stats.perfectDays}</div>
              <div className="stat-label-small">Perfect Days</div>
            </div>
            <div className="stat-card-small">
              <div className="stat-value-small">{stats.avgPerDay}</div>
              <div className="stat-label-small">Avg per Day</div>
            </div>
          </div>
        </div>

        <div className="section">
          <h2>Habit Performance</h2>
          <div className="habit-rankings">
            {habitStats.length === 0 ? (
              <p className="no-data-message">No habit data in this range</p>
            ) : (
              habitStats.map((item, index) => (
                <div key={item.habit.id} className="ranking-row">
                  <div className="ranking-position">{index + 1}</div>
                  <div className="ranking-habit">
                    <span className="ranking-icon">{item.habit.icon}</span>
                    <span className="ranking-name">{item.habit.name}</span>
                  </div>
                  <div className="ranking-stats">
                    <span className="ranking-count">{item.completions}/{item.activeDays}</span>
                    <div className="ranking-bar-container">
                      <div 
                        className="ranking-bar" 
                        style={{ width: `${item.rate}%` }}
                      />
                    </div>
                    <span className="ranking-rate">{item.rate}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OverallView;