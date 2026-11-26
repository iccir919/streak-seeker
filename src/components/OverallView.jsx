import { useState, useRef, useLayoutEffect, useEffect, useMemo } from 'react';
import { getHabits, getHabitLogs } from '../utils/storage';
import { formatDate, getToday, addDays, getDefaultPresetDays, normalizeRange, toDateString, groupIntoWeeks, PRESET_DAYS } from '../utils/dateHelpers';
import './OverallView.css';

// Heatmap spacing. Narrow gaps keep the "ghost dots" (Hermann grid
// illusion) from showing between the squares. Keep HEATMAP_GAP in sync
// with the gap values in the .ov-hm-* CSS rules.
const HEATMAP_GAP = 3;
// The heatmap always shows at least this many days ending on the end date,
// so its shape stays the same at every preset. Days outside the selected
// range are faded.
const HEATMAP_MIN_DAYS = 84;
// Square size is chosen so this many weeks fit the popup width. A longer
// custom range keeps the same size and scrolls sideways.
const HEATMAP_FIT_WEEKS = 14;
const HEATMAP_MAX_CELL = 36;

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
function OverallView({ onBack, onHabitClick }) {
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

  return <OverallContent habits={habits} onBack={onBack} onHabitClick={onHabitClick} />;
}

function OverallContent({ habits, onBack, onHabitClick }) {
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

  // Opens on the smallest preset (2, 4, 8 or 12 weeks) that covers the
  // whole history.
  const [defaultDays] = useState(() => {
    const starts = Object.values(habitData).map(info => info.startStr).filter(Boolean).sort();
    return getDefaultPresetDays(starts[0] || null);
  });

  const [startDate, setStartDate] = useState(() => addDays(getToday(), -(defaultDays - 1)));
  const [endDate, setEndDate] = useState(getToday());
  const [activePreset, setActivePreset] = useState(defaultDays);
  const [trendViewChoice, setTrendViewChoice] = useState(null); // null | 'chart' | 'heatmap'
  const [cellSize, setCellSize] = useState(20);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const bodyRef = useRef(null);
  const scrollRegionRef = useRef(null);
  const plotAreaRef = useRef(null);
  const tooltipRef = useRef(null);

  const getActiveHabitsOnDate = (dateStr) => {
    return habits.filter(habit => isActiveOnDate(habitData[habit.id], dateStr));
  };

  const getDaysBetween = (startStr, endStr) => {
    const days = [];
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');

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

    // Average over the days that had habits, matching how the rate is counted
    const trackedDays = rangeData.filter(day => day.totalHabits > 0).length;
    const avgPerDay = trackedDays > 0
      ? (totalCompletions / trackedDays).toFixed(1)
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
      // Days before the first habit are left out, not plotted as 0%
      return rangeData.filter(day => day.totalHabits > 0).map(day => {
        const date = new Date(day.date + 'T00:00:00');
        return {
          label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          // Tooltip also names the weekday (the axis label stays short)
          fullLabel: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          percentage: day.percentage
        };
      });
    } else if (totalDays < 180) {
      // 7-day points counted back from the end date, so the newest point
      // is always a full week. Only the oldest point can be shorter, and
      // its tooltip says how many days it covers.
      return groupIntoWeeks(rangeData)
        .map(week => week.filter(d => d.totalHabits > 0))
        .filter(week => week.length > 0)
        .map(week => {
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
      
      rangeData.filter(day => day.totalHabits > 0).forEach(day => {
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
    if (day.totalHabits === 0) return 'ov-hm-cell-padding';
    if (day.percentage === 0) return 'ov-hm-cell-level-0';
    if (day.percentage < 25) return 'ov-hm-cell-level-1';
    if (day.percentage < 50) return 'ov-hm-cell-level-2';
    if (day.percentage < 75) return 'ov-hm-cell-level-3';
    if (day.percentage < 100) return 'ov-hm-cell-level-4';
    return 'ov-hm-cell-level-5';
  };

  const isOutsideRange = (day) => !day.isPadding && (day.date < startDate || day.date > endDate);

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

  // Since created: from the earliest habit's first day through today.
  const earliestStart = Object.values(habitData).map(info => info.startStr).filter(Boolean).sort()[0] || null;

  const handleSinceCreatedClick = () => {
    if (!earliestStart) return;
    const range = normalizeRange(earliestStart, getToday(), 'start');
    setStartDate(range.start);
    setEndDate(range.end);
    setActivePreset('created');
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

  const rangeData = getDaysBetween(startDate, endDate);
  const trendData = getTrendData(rangeData);
  // With fewer than 3 points a line chart is a dot or a single segment,
  // so a heatmap is the default there until the person picks a view.
  const trendView = trendViewChoice || (trendData.length < 3 ? 'heatmap' : 'chart');
  // The heatmap covers at least HEATMAP_MIN_DAYS ending on the end date;
  // days outside the selected range are drawn faded.
  const heatmapDays = trendView === 'heatmap'
    ? getDaysBetween(
        rangeData.length >= HEATMAP_MIN_DAYS ? startDate : addDays(endDate, -(HEATMAP_MIN_DAYS - 1)),
        endDate
      )
    : [];
  const heatmapWeeks = getHeatmapGrid(heatmapDays);
  const monthLabelCandidates = trendView === 'heatmap' ? getMonthLabelCandidates(heatmapWeeks) : [];
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayStr = formatDate(new Date());

  const monthLabels = trendView === 'heatmap'
    ? getVisibleMonthLabels(monthLabelCandidates, cellSize)
    : [];

  useLayoutEffect(() => {
    if (!bodyRef.current) return;

    const calculate = () => {
      const containerWidth = bodyRef.current.offsetWidth;
      const gap = HEATMAP_GAP;
      const dayLabelWidth = 28;
      // Same square size for every range: sized so HEATMAP_FIT_WEEKS columns
      // fit. Longer ranges scroll sideways instead of shrinking the squares.
      const available = containerWidth - dayLabelWidth - gap - 4;
      const rawSize = (available - (HEATMAP_FIT_WEEKS - 1) * gap) / HEATMAP_FIT_WEEKS;
      setCellSize(Math.floor(Math.max(14, Math.min(HEATMAP_MAX_CELL, rawSize))));
    };

    calculate();
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, []);

  // Open scrolled to the newest week, so a long range never hides today.
  useLayoutEffect(() => {
    const region = scrollRegionRef.current;
    if (trendView === 'heatmap' && region) region.scrollLeft = region.scrollWidth;
  }, [trendView, heatmapWeeks.length, cellSize, startDate, endDate]);

  const stats = calculateStats(rangeData);

  // Completion by weekday across all habits in the range (0 = Sunday).
  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekdayTotals = weekdayNames.map(() => ({ done: 0, possible: 0 }));
  rangeData.forEach(day => {
    const total = weekdayTotals[new Date(day.date + 'T00:00:00').getDay()];
    total.done += day.completedCount;
    total.possible += day.totalHabits;
  });
  const weekdayRates = weekdayTotals.map(t => (t.possible > 0 ? Math.round((t.done / t.possible) * 100) : null));
  const knownWeekdayRates = weekdayRates.filter(rate => rate !== null);
  // Only highlight a best day when the days actually differ.
  const weekdaySpread = knownWeekdayRates.length > 0 && Math.max(...knownWeekdayRates) > Math.min(...knownWeekdayRates);
  const bestWeekdayRate = weekdaySpread ? Math.max(...knownWeekdayRates) : null;

  let weekdayInsight = 'Not enough data in this range yet.';
  if (knownWeekdayRates.length > 0) {
    if (!weekdaySpread) {
      weekdayInsight = knownWeekdayRates[0] === 100
        ? 'You did everything on every day in this range.'
        : `Every weekday is about the same: ${knownWeekdayRates[0]}%.`;
    } else {
      const weakest = Math.min(...knownWeekdayRates);
      weekdayInsight = `Your weakest day is ${weekdayNames[weekdayRates.indexOf(weakest)]}: ${weakest}%. Best day: ${weekdayNames[weekdayRates.indexOf(bestWeekdayRate)].slice(0, 3)}.`;
    }
  }
  const trackedDayCount = rangeData.filter(day => day.totalHabits > 0).length;
  let rangeNote = null;
  if (trackedDayCount === 0) {
    rangeNote = 'No habits were tracked in this range.';
  } else if (trackedDayCount < rangeData.length) {
    rangeNote = `Rates count the ${trackedDayCount} of ${rangeData.length} days in this range that had habits.`;
  }
  const habitStats = getHabitStats(rangeData);

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
  // Each label sits directly under its own point. When there are too many
  // points to label without overlap, show every 2nd, 3rd, etc.
  const labelStep = Math.max(1, Math.ceil(points.length / 14));
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

          <div className="preset-buttons" style={{ flexWrap: 'wrap' }}>
            {PRESET_DAYS.map((days) => (
              <button
                key={days}
                className={`preset-btn ${activePreset === days ? 'active' : ''}`}
                onClick={() => handlePresetClick(days)}
              >
                {days / 7} Weeks
              </button>
            ))}
            {earliestStart && (
              <button
                className={`preset-btn ${activePreset === 'created' ? 'active' : ''}`}
                onClick={handleSinceCreatedClick}
              >
                Since created
              </button>
            )}
          </div>
        </div>

        <div className="section">
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

          {rangeNote && <p className="ov-range-note">{rangeNote}</p>}

          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${trendView === 'chart' ? 'active' : ''}`}
              onClick={() => setTrendViewChoice('chart')}
            >
              Chart
            </button>
            <button
              className={`view-toggle-btn ${trendView === 'heatmap' ? 'active' : ''}`}
              onClick={() => setTrendViewChoice('heatmap')}
            >
              Heatmap
            </button>
            <button
              className={`view-toggle-btn ${trendView === 'weekdays' ? 'active' : ''}`}
              onClick={() => setTrendViewChoice('weekdays')}
            >
              Weekdays
            </button>
          </div>

          <div className="ov-tab-body" ref={bodyRef}>
          {trendView === 'weekdays' ? (
            <div className="ov-wd">
              <div className="ov-wd-bars">
                {weekdayNames.map((name, i) => {
                  const rate = weekdayRates[i];
                  const isBest = bestWeekdayRate !== null && rate === bestWeekdayRate;
                  const total = weekdayTotals[i];
                  return (
                    <div
                      key={name}
                      className="ov-wd-col"
                      title={total.possible > 0 ? `${total.done} of ${total.possible} done on ${name}s` : `No ${name}s in this range`}
                    >
                      <div className={`ov-wd-pct ${isBest ? 'ov-wd-best' : ''}`}>{rate === null ? '-' : `${rate}%`}</div>
                      <div className="ov-wd-track">
                        <div
                          className={`ov-wd-bar ${isBest ? 'ov-wd-bar-best' : ''}`}
                          style={{ height: `${rate || 0}%` }}
                        />
                      </div>
                      <div className={`ov-wd-name ${isBest ? 'ov-wd-best' : ''}`}>{name.slice(0, 3)}</div>
                    </div>
                  );
                })}
              </div>
              <p className="ov-wd-insight">{weekdayInsight}</p>
            </div>
          ) : trendView === 'chart' ? (
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
                {points.map((p, index) => (
                  index % labelStep === 0 && (
                    <span
                      key={index}
                      className="line-chart-label"
                      style={{ left: `${(p.x / chartWidth) * 100}%` }}
                    >
                      {p.label}
                    </span>
                  )
                ))}
              </div>
            </div>
          ) : (
            <div className="ov-hm-container" style={{ '--hm-cell-size': `${cellSize}px` }}>
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
                            className={`ov-hm-cell ${getHeatmapColorClass(day)} ${day.date === todayStr ? 'ov-hm-cell-today' : ''} ${isOutsideRange(day) ? 'ov-hm-cell-out' : ''}`}
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
          </div>

        </div>

        <div className="section">
          <h2>Habit Performance</h2>
          <div className="habit-rankings">
            {habitStats.length === 0 ? (
              <p className="no-data-message">No habit data in this range</p>
            ) : (
              habitStats.map((item, index) => (
                <div
                  key={item.habit.id}
                  className={`ranking-row ${onHabitClick ? 'ranking-row-clickable' : ''}`}
                  onClick={onHabitClick ? () => onHabitClick(item.habit.id) : undefined}
                  title={onHabitClick ? `Open ${item.habit.name}` : undefined}
                >
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