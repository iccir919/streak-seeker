import { useState, useRef, useLayoutEffect, useMemo } from 'react';
import { getHabitLogs } from '../utils/storage';
import { calculateCurrentStreak, calculateLongestStreak, formatDate, normalizeRange, toDateString, groupIntoWeeks } from '../utils/dateHelpers';
import './HabitDetailView.css';

const formatRate = (rate) => (rate === null ? 'N/A' : `${rate}%`);

// Wrapper only decides whether there is anything to show. All hooks
// live in HabitDetailContent so they always run in the same order.
function HabitDetailView({ habit, onBack, onEdit }) {
  if (!habit) return null;
  return <HabitDetailContent habit={habit} onBack={onBack} onEdit={onEdit} />;
}

function HabitDetailContent({ habit, onBack, onEdit }) {
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
  // null = nothing picked yet, so short ranges default to the heatmap.
  // Once the user clicks Chart or Heatmap, their choice sticks.
  const [trendViewChoice, setTrendViewChoice] = useState(null); // null | 'chart' | 'heatmap'
  const [cellSize, setCellSize] = useState(20);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const hmContainerRef = useRef(null);
  const plotAreaRef = useRef(null);
  const tooltipRef = useRef(null);

  // Read from storage once per habit, not on every hover/re-render.
  const logs = useMemo(() => getHabitLogs(habit.id), [habit.id]);
  const currentStreak = calculateCurrentStreak(logs);
  const longestStreak = calculateLongestStreak(logs);

  const todayStr = formatDate(new Date());

  // Earlier of: the day the habit was created, or its first logged
  // completion (covers habits that were back-filled).
  const getHabitStartStr = () => {
    const createdStr = toDateString(habit.createdAt);
    const firstLogStr = Object.keys(logs).filter(d => logs[d]).sort()[0] || null;
    if (createdStr && firstLogStr) return createdStr < firstLogStr ? createdStr : firstLogStr;
    return createdStr || firstLogStr;
  };

  const habitStartStr = getHabitStartStr();
  const archiveStr = toDateString(habit.archivedAt);

  // A day counts only if the habit existed and was not yet archived.
  const isActiveOn = (dateStr) => {
    if (!habitStartStr) return false;
    if (dateStr < habitStartStr) return false;
    if (archiveStr && dateStr > archiveStr) return false;
    return true;
  };

  const getDaysSinceLastCompleted = () => {
    const completedDates = Object.keys(logs).filter(d => logs[d]).sort();
    
    if (completedDates.length === 0) {
      return null;
    }

    const lastDateStr = completedDates[completedDates.length - 1];
    const lastDate = new Date(lastDateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return Math.round((today - lastDate) / (1000 * 60 * 60 * 24));
  };

  // Rate for a list of days, counting only days the habit was active.
  // Returns null when no day in the list was active.
  const getRateForRange = (rangeDays) => {
    const activeDays = rangeDays.filter(d => d.active);
    if (activeDays.length === 0) return null;
    const completed = activeDays.filter(d => d.completed).length;
    return Math.round((completed / activeDays.length) * 100);
  };

  // From the habit's start to today (or to its archive date).
  const getSinceCreatedRate = () => {
    if (!habitStartStr) return null;
    const endStr = archiveStr && archiveStr < todayStr ? archiveStr : todayStr;
    if (endStr < habitStartStr) return null;

    let total = 0;
    let completed = 0;
    const cursor = new Date(habitStartStr + 'T00:00:00');
    while (formatDate(cursor) <= endStr) {
      total++;
      if (logs[formatDate(cursor)]) completed++;
      cursor.setDate(cursor.getDate() + 1);
    }
    return total > 0 ? Math.round((completed / total) * 100) : null;
  };

  const sinceCreatedRate = getSinceCreatedRate();
  const daysSinceLastCompleted = getDaysSinceLastCompleted();

  const formatStartDate = () => {
    if (!habitStartStr) return 'Unknown';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(habitStartStr + 'T00:00:00').toLocaleDateString('en-US', options);
  };

  const formatArchiveDate = () => {
    if (!archiveStr) return null;
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(archiveStr + 'T00:00:00').toLocaleDateString('en-US', options);
  };

  const formatDateForTooltip = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const formatDateShort = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Walks the start/end span one calendar day at a time (avoids the DST
  // off-by-one that dividing milliseconds can cause). Each day records
  // whether the habit was active, and whether it was completed.
  const generateDays = () => {
    const result = [];
    const cursor = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');

    while (cursor <= end) {
      const dateStr = formatDate(cursor);
      const active = isActiveOn(dateStr);
      result.push({ date: dateStr, active, completed: active && !!logs[dateStr] });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  };

  // 7-day points counted back from the end date, so the newest point is
  // always a full week. Only active days count; a point with fewer than
  // 7 active days says so in its tooltip.
  const getWeeklyTrend = (days) => {
    return groupIntoWeeks(days)
      .map(week => week.filter(d => d.active))
      .filter(week => week.length > 0)
      .map(week => {
        const completedCount = week.filter(d => d.completed).length;
        const percentage = Math.round((completedCount / week.length) * 100);
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
  };

  // Adaptive granularity, same thresholds as Overall's getTrendData.
  const getTrendData = (rangeDays) => {
    const totalDays = rangeDays.length;

    if (totalDays <= 14) {
      return rangeDays.filter(day => day.active).map(day => {
        const date = new Date(day.date + 'T00:00:00');
        return {
          label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          percentage: day.completed ? 100 : 0
        };
      });
    } else if (totalDays < 180) {
      return getWeeklyTrend(rangeDays);
    } else {
      const monthGroups = {};
      rangeDays.filter(day => day.active).forEach(day => {
        const date = new Date(day.date + 'T00:00:00');
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        if (!monthGroups[key]) {
          monthGroups[key] = {
            label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            completed: 0,
            total: 0
          };
        }
        monthGroups[key].total += 1;
        if (day.completed) monthGroups[key].completed += 1;
      });
      return Object.values(monthGroups).map(group => ({
        label: group.label,
        fullLabel: group.label,
        percentage: group.total > 0 ? Math.round((group.completed / group.total) * 100) : 0
      }));
    }
  };

  const getHeatmapGrid = (days) => {
    if (days.length === 0) return [];

    const firstDate = new Date(days[0].date + 'T00:00:00');
    const firstDayOfWeek = firstDate.getDay();

    const paddedDays = [];
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const padDate = new Date(firstDate);
      padDate.setDate(padDate.getDate() - (i + 1));
      paddedDays.push({ date: null, isPadding: true });
    }

    const allCells = [...paddedDays, ...days];

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

  const getHeatmapCellClass = (day) => {
    if (day.isPadding || !day.active) return 'hm-cell-padding';
    return day.completed ? 'hm-cell-completed' : 'hm-cell-empty';
  };

  const getHeatmapTooltip = (day) => {
    if (day.isPadding || !day.active) return '';
    return `${formatDateForTooltip(day.date)}${day.completed ? ' ✓' : ''}`;
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

  const rangeDays = generateDays();
  const trendData = getTrendData(rangeDays);
  // Ranges of 14 days or fewer are plotted one day at a time, so every
  // point is 0% or 100% and the line just zigzags. A strip of squares
  // shows that much better, so it is the default there.
  const trendView = trendViewChoice || (rangeDays.length <= 14 ? 'heatmap' : 'chart');
  const heatmapWeeks = trendView === 'heatmap' ? getHeatmapGrid(rangeDays) : [];
  const monthLabelCandidates = trendView === 'heatmap' ? getMonthLabelCandidates(heatmapWeeks) : [];
  const layoutMode = rangeDays.length <= 30 ? 'calendar' : 'github';
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const monthLabels = trendView === 'heatmap'
    ? getVisibleMonthLabels(monthLabelCandidates, cellSize)
    : [];

  const thisRangeRate = getRateForRange(rangeDays);
  const rangeLabel = startDate === endDate
    ? formatDateShort(startDate)
    : `${formatDateShort(startDate)} - ${formatDateShort(endDate)}`;

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

  useLayoutEffect(() => {
    if (!hoveredPoint || !tooltipRef.current || !plotAreaRef.current) return;

    const tooltipEl = tooltipRef.current;
    const plotRect = plotAreaRef.current.getBoundingClientRect();
    const popupEl = plotAreaRef.current.closest('.detail-content') || plotAreaRef.current.closest('.habit-detail');
    const popupRect = popupEl ? popupEl.getBoundingClientRect() : plotRect;

    const tooltipWidth = tooltipEl.offsetWidth;
    const halfWidth = tooltipWidth / 2;

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
    <div className="habit-detail">
      <div className="detail-header">
        <button className="btn-back" onClick={onBack}>
          ←
        </button>
        <div className="detail-title">
          <span className="detail-icon">{habit.icon}</span>
          <h1>{habit.name}</h1>
          {habit.archived && <span className="archived-badge">Archived</span>}
        </div>
        <button className="btn-edit-detail" onClick={() => onEdit(habit)}>
          Edit
        </button>
      </div>

      <div className="detail-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🔥</div>
            <div className="stat-value">{currentStreak}</div>
            <div className="stat-label">Current</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🏆</div>
            <div className="stat-value">{longestStreak}</div>
            <div className="stat-label">Longest</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏱️</div>
            <div className="stat-value">
              {daysSinceLastCompleted === null ? 'Never' : daysSinceLastCompleted}
            </div>
            <div className="stat-label">Days Since</div>
          </div>
        </div>

        {/* Date range + presets, mirroring Overall view */}
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
                    <path d={areaPath} fill="url(#lineFadeDetail)" stroke="none" />
                  )}
                  <defs>
                    <linearGradient id="lineFadeDetail" x1="0" y1="0" x2="0" y2="1">
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
            <div className="hm-cal-container" ref={hmContainerRef} style={{ '--hm-cell-size': `${cellSize}px` }}>
              <div className="hm-cal-day-header">
                <div className="hm-cal-month-spacer" />
                {dayLabels.map((label) => (
                  <div key={label} className="hm-cal-day-label">{label}</div>
                ))}
              </div>
              <div className="hm-cal-grid">
                {heatmapWeeks.map((week, weekIdx) => (
                  <div key={weekIdx} className="hm-cal-week-row">
                    <div className="hm-cal-month-label">{monthLabels[weekIdx] || ''}</div>
                    {week.map((day, dayIdx) => (
                      <div
                        key={`${weekIdx}-${dayIdx}`}
                        className={`hm-cell ${getHeatmapCellClass(day)} ${day.date === todayStr ? 'hm-cell-today' : ''}`}
                        title={getHeatmapTooltip(day)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="hm-container" ref={hmContainerRef} style={{ '--hm-cell-size': `${cellSize}px` }}>
              <div className="hm-day-labels">
                {dayLabels.map((label) => (
                  <div key={label} className="hm-day-label">{label}</div>
                ))}
              </div>
              <div className="hm-scroll-region">
                <div className="hm-scroll-content">
                  <div className="hm-grid">
                    {heatmapWeeks.map((week, weekIdx) => (
                      <div key={weekIdx} className="hm-week-column">
                        {week.map((day, dayIdx) => (
                          <div
                            key={`${weekIdx}-${dayIdx}`}
                            className={`hm-cell ${getHeatmapCellClass(day)} ${day.date === todayStr ? 'hm-cell-today' : ''}`}
                            title={getHeatmapTooltip(day)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="hm-month-labels">
                    {monthLabels.map((label, idx) => (
                      <div key={idx} className="hm-month-label-cell">{label || ''}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

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
          </div>

          <div className="comparison-row">
            <div className="comparison-card">
              <div className="comparison-value">{formatRate(thisRangeRate)}</div>
              <div className="comparison-label">{rangeLabel}</div>
            </div>
            <div className="comparison-card">
              <div className="comparison-value">{formatRate(sinceCreatedRate)}</div>
              <div className="comparison-label">Since Created</div>
            </div>
          </div>
        </div>

        <div className="section info-section">
          <div className="info-row">
            <span className="info-label">Tracking since</span>
            <span className="info-value">{formatStartDate()}</span>
          </div>
          {habit.archived && habit.archivedAt && (
            <div className="info-row">
              <span className="info-label">Archived</span>
              <span className="info-value">{formatArchiveDate()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HabitDetailView;