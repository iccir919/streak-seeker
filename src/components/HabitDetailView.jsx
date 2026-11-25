import { useState, useRef, useLayoutEffect, useMemo } from 'react';
import { getHabitLogs } from '../utils/storage';
import { getStreakRuns, formatDate, getToday, addDays, getDefaultPresetDays, normalizeRange, toDateString, countDaysInclusive, PRESET_DAYS } from '../utils/dateHelpers';
import './HabitDetailView.css';

// Heatmap spacing. Narrow gaps keep the "ghost dots" (Hermann grid
// illusion) from showing between the squares. Keep HEATMAP_GAP in sync
// with the gap values in the .hm-* CSS rules.
const HEATMAP_GAP = 3;
// The heatmap always shows at least this many days (12 weeks) ending on the
// end date, so its shape stays the same at every preset. Days outside the
// selected range are faded.
const HEATMAP_MIN_DAYS = 84;
// Square size is chosen so this many weeks fit the popup width. A longer
// custom range keeps the same size and scrolls sideways.
const HEATMAP_FIT_WEEKS = 13;
const HEATMAP_MAX_CELL = 36;
// Extra gap before each new month, in px. Keep in sync with the CSS.
const HEATMAP_MONTH_GAP = 7;

// Days in a row needed to count as a streak
const MIN_STREAK_DAYS = 2;

const formatRate = (rate) => (rate === null ? 'N/A' : `${rate}%`);

// Wrapper only decides whether there is anything to show. All hooks
// live in HabitDetailContent so they always run in the same order.
function HabitDetailView({ habit, onBack, onEdit }) {
  if (!habit) return null;
  return <HabitDetailContent habit={habit} onBack={onBack} onEdit={onEdit} />;
}

function HabitDetailContent({ habit, onBack, onEdit }) {
  // Read from storage once per habit, not on every hover/re-render.
  const logs = useMemo(() => getHabitLogs(habit.id), [habit.id]);
  const todayStr = formatDate(new Date());

  // Streaks: a streak is 2 or more days in a row. The current streak ends
  // today, the longest is the most recent one if tied, and the previous is
  // the streak before the current one (or the one that just ended when
  // there is no current streak).
  const completionRuns = useMemo(() => getStreakRuns(logs), [logs]);
  const streakRuns = completionRuns.filter(run => run.length >= MIN_STREAK_DAYS);
  const lastStreak = streakRuns[streakRuns.length - 1] || null;
  const currentRun = lastStreak && lastStreak.end === todayStr ? lastStreak : null;
  const lastCompletionRun = completionRuns[completionRuns.length - 1] || null;

  // 'Sep 3', with the year added when it is not this year.
  const formatShortDate = (dateStr, withYear = false) => {
    const date = new Date(dateStr + 'T00:00:00');
    const showYear = withYear || date.getFullYear() !== new Date().getFullYear();
    return date.toLocaleDateString('en-US', showYear
      ? { month: 'short', day: 'numeric', year: 'numeric' }
      : { month: 'short', day: 'numeric' });
  };
  // 'Sep 3 to Oct 3'. For a run in another year the year is shown once, at
  // the end ('Dec 3 to Dec 19, 2025'), so it stays on one line. A run that
  // crosses a year boundary shows the year on both dates.
  const formatRun = (run) => {
    if (run.start === run.end) return formatShortDate(run.start);
    const startYear = run.start.slice(0, 4);
    const endYear = run.end.slice(0, 4);
    const thisYear = String(new Date().getFullYear());
    if (startYear !== endYear) return `${formatShortDate(run.start, true)} to ${formatShortDate(run.end, true)}`;
    if (endYear !== thisYear) {
      const startNoYear = new Date(run.start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${startNoYear} to ${formatShortDate(run.end)}`;
    }
    return `${formatShortDate(run.start)} to ${formatShortDate(run.end)}`;
  };

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

  // Opens on the smallest preset (2, 4, 8 or 12 weeks) that covers the
  // habit's whole history.
  const [defaultDays] = useState(() => getDefaultPresetDays(habitStartStr));
  const [startDate, setStartDate] = useState(() => addDays(getToday(), -(defaultDays - 1)));
  const [endDate, setEndDate] = useState(getToday());
  const [activePreset, setActivePreset] = useState(defaultDays);
  const [tab, setTab] = useState('chart'); // 'chart' | 'heatmap' | 'weekdays' | 'streaks'
  const [hoverIdx, setHoverIdx] = useState(null);
  const [cellSize, setCellSize] = useState(20);
  const bodyRef = useRef(null);
  const scrollRegionRef = useRef(null);

  // A day counts only if the habit existed and was not yet archived.
  const isActiveOn = (dateStr) => {
    if (!habitStartStr) return false;
    if (dateStr < habitStartStr) return false;
    if (archiveStr && dateStr > archiveStr) return false;
    return true;
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

  // Walks the start/end span one calendar day at a time (avoids the DST
  // off-by-one that dividing milliseconds can cause). Each day records
  // whether the habit was active, and whether it was completed.
  const generateDays = (startStr = startDate, endStr = endDate) => {
    const result = [];
    const cursor = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');

    while (cursor <= end) {
      const dateStr = formatDate(cursor);
      const active = isActiveOn(dateStr);
      result.push({ date: dateStr, active, completed: active && !!logs[dateStr] });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
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
    if (!day.completed) return 'hm-cell-empty';
    return 'hm-cell-streak';
  };

  const isOutsideRange = (day) => !day.isPadding && (day.date < startDate || day.date > endDate);

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

  // Since created: from the habit's first day through today (or through
  // the archive day for an archived habit).
  const handleSinceCreatedClick = () => {
    if (!habitStartStr) return;
    const endStr = archiveStr && archiveStr < todayStr ? archiveStr : todayStr;
    const range = normalizeRange(habitStartStr, endStr, 'start');
    setStartDate(range.start);
    setEndDate(range.end);
    setActivePreset('created');
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
  // The heatmap and the streak timeline cover at least HEATMAP_MIN_DAYS
  // ending on the end date; days outside the selected range are faded.
  const windowStart = rangeDays.length >= HEATMAP_MIN_DAYS ? startDate : addDays(endDate, -(HEATMAP_MIN_DAYS - 1));
  const heatmapDays = tab === 'heatmap' ? generateDays(windowStart, endDate) : [];
  const heatmapWeeks = getHeatmapGrid(heatmapDays);
  const monthLabelCandidates = tab === 'heatmap' ? getMonthLabelCandidates(heatmapWeeks) : [];
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const monthLabels = tab === 'heatmap'
    ? getVisibleMonthLabels(monthLabelCandidates, cellSize)
    : [];

  // Rolling completion rate: for each day in the range, the share of the
  // last 7 days (that the habit existed) that were done. Days before the
  // range start count too, so the line starts full instead of ramping up.
  const ROLLING_DAYS = 7;
  const rollingPoints = tab === 'chart'
    ? rangeDays.map((day) => {
        let active = 0;
        let done = 0;
        for (let i = 0; i < ROLLING_DAYS; i++) {
          const d = addDays(day.date, -i);
          if (!isActiveOn(d)) continue;
          active += 1;
          if (logs[d]) done += 1;
        }
        return { date: day.date, rate: active > 0 ? Math.round((done / active) * 100) : null };
      })
    : [];
  const rollingCount = rollingPoints.length;
  const rollingX = (i) => (rollingCount > 1 ? (i / (rollingCount - 1)) * 100 : 50);
  const rollingY = (rate) => 100 - rate;
  // One path, restarted after any gap (days before the habit existed).
  let rollingLine = '';
  let rollingArea = '';
  let segmentStart = null;
  rollingPoints.forEach((point, i) => {
    if (point.rate === null) { segmentStart = null; return; }
    const cmd = segmentStart === null ? 'M' : 'L';
    rollingLine += `${cmd}${rollingX(i)},${rollingY(point.rate)} `;
    segmentStart = i;
  });
  const rollingValid = rollingPoints.filter(point => point.rate !== null);
  if (rollingValid.length > 1 && rollingPoints.findIndex(p => p.rate === null) === -1) {
    rollingArea = `${rollingLine}L100,100 L0,100 Z`;
  }
  const shownIdx = hoverIdx !== null && rollingPoints[hoverIdx] && rollingPoints[hoverIdx].rate !== null
    ? hoverIdx
    : rollingPoints.length - 1 - [...rollingPoints].reverse().findIndex(p => p.rate !== null);
  const shownPoint = rollingValid.length > 0 ? rollingPoints[shownIdx] : null;
  const rollingTicks = [];
  if (tab === 'chart') {
    const weekly = rollingCount <= 31;
    rollingPoints.forEach((point, i) => {
      if (weekly ? i % 7 === 0 : (i === 0 || point.date.slice(8) === '01')) {
        const d = new Date(point.date + 'T00:00:00');
        rollingTicks.push({
          left: rollingX(i),
          label: d.toLocaleDateString('en-US', weekly ? { month: 'short', day: 'numeric' } : { month: 'short' })
        });
      }
    });
  }
  const handleChartMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverIdx(Math.round(frac * (rollingCount - 1)));
  };

  // Completion by weekday in the selected range (index 0 = Sunday).
  const weekdayStats = dayLabels.map(() => ({ done: 0, active: 0 }));
  rangeDays.forEach(day => {
    if (!day.active) return;
    const stat = weekdayStats[new Date(day.date + 'T00:00:00').getDay()];
    stat.active += 1;
    if (day.completed) stat.done += 1;
  });
  const weekdayRates = weekdayStats.map(stat => (stat.active > 0 ? stat.done / stat.active : null));
  const knownRates = weekdayRates.filter(rate => rate !== null);
  // Only highlight a best day when the days actually differ.
  const rateSpread = knownRates.length > 0 && Math.max(...knownRates) > Math.min(...knownRates);
  const bestRate = rateSpread ? Math.max(...knownRates) : null;
  const formatWeekdayRate = (rate) => (rate === null ? '-' : `${Math.round(rate * 100)}%`);

  // One plain sentence about the weekday pattern.
  let weekdayInsight = 'Not enough data in this range yet.';
  if (knownRates.length > 0) {
    const missed = weekdayStats.map(stat => stat.active - stat.done);
    const mostMissed = Math.max(...missed);
    if (mostMissed === 0) {
      weekdayInsight = 'You did every day in this range.';
    } else {
      const worstIdx = missed.indexOf(mostMissed);
      weekdayInsight = `You miss ${dayLabels[worstIdx]}s most: ${mostMissed} of the last ${weekdayStats[worstIdx].active}.`;
      if (rateSpread) {
        weekdayInsight += ` Best day: ${dayLabels[weekdayRates.indexOf(bestRate)]}.`;
      }
    }
  }

  // Streak timeline: spans exactly the selected range, so it changes with
  // the date inputs and presets. Each bar is a streak (2+ days) clipped to
  // the range, positioned in percent of the range.
  const tlDayCount = rangeDays.length;
  const tlOffset = (dateStr) => countDaysInclusive(startDate, dateStr) - 1;
  const timelineBars = tab === 'streaks'
    ? streakRuns
        .filter(run => run.end >= startDate && run.start <= endDate)
        .map(run => {
          const from = run.start < startDate ? startDate : run.start;
          const to = run.end > endDate ? endDate : run.end;
          const shown = tlOffset(to) - tlOffset(from) + 1;
          return {
            run,
            from,
            to,
            shown,
            left: (tlOffset(from) / tlDayCount) * 100,
            width: (shown / tlDayCount) * 100,
            isCurrent: run === currentRun
          };
        })
    : [];
  // Streak cards follow the selected range too: they use the same
  // clipped streaks as the timeline.
  const rangeStreaks = timelineBars.map(bar => ({ start: bar.from, end: bar.to, length: bar.shown }));
  const rangeCurrent = rangeStreaks.length > 0 && rangeStreaks[rangeStreaks.length - 1].end === endDate
    ? rangeStreaks[rangeStreaks.length - 1]
    : null;
  const rangePrevious = (rangeCurrent ? rangeStreaks[rangeStreaks.length - 2] : rangeStreaks[rangeStreaks.length - 1]) || null;
  const rangeLongest = rangeStreaks.reduce((best, run) => (!best || run.length >= best.length ? run : best), null);

  // Short ranges are labelled weekly ("Nov 3"); longer ones by month.
  const timelineTicks = [];
  if (tab === 'streaks') {
    let day = startDate;
    for (let i = 0; i < tlDayCount; i++, day = addDays(day, 1)) {
      const d = new Date(day + 'T00:00:00');
      const weekly = tlDayCount <= 31;
      if (weekly ? i % 7 === 0 : (i === 0 || day.slice(8) === '01')) {
        timelineTicks.push({
          left: (i / tlDayCount) * 100,
          label: d.toLocaleDateString('en-US', weekly ? { month: 'short', day: 'numeric' } : { month: 'short' })
        });
      }
    }
  }

  const thisRangeRate = getRateForRange(rangeDays);

  // Tells the reader when the rate covers fewer days than the range.
  const activeDayCount = rangeDays.filter(d => d.active).length;
  const daysDone = rangeDays.filter(d => d.completed).length;
  const skippedBefore = rangeDays.filter(d => habitStartStr && d.date < habitStartStr).length;
  const skippedAfter = rangeDays.filter(d => archiveStr && d.date > archiveStr).length;
  let rangeNote = null;
  if (activeDayCount === 0) {
    rangeNote = 'This habit was not active in this range.';
  } else if (activeDayCount < rangeDays.length) {
    let reason = 'fall outside the time this habit was tracked';
    if (skippedBefore > 0 && skippedAfter === 0) reason = 'were before this habit was created';
    if (skippedAfter > 0 && skippedBefore === 0) reason = 'were after it was archived';
    rangeNote = `Rate counts ${activeDayCount} of ${rangeDays.length} days; the rest ${reason}.`;
  }

  useLayoutEffect(() => {
    if (!bodyRef.current) return;

    const calculate = () => {
      const containerWidth = bodyRef.current.offsetWidth;
      const gap = HEATMAP_GAP;
      const dayLabelWidth = 28;
      // Same square size for every range: sized so HEATMAP_FIT_WEEKS columns
      // fit, with room for four month gaps. Longer
      // ranges scroll sideways instead of shrinking the squares.
      const available = containerWidth - dayLabelWidth - 2 * gap - 4 - 4 * HEATMAP_MONTH_GAP;
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
    if (tab === 'heatmap' && region) region.scrollLeft = region.scrollWidth;
  }, [tab, heatmapWeeks.length, cellSize, startDate, endDate]);

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
        {/* Range cards first, then the pickers that change them */}
        <div className="hd-summary">
          <div className="comparison-row">
            <div className="comparison-card">
              <div className="comparison-value">{formatRate(thisRangeRate)}</div>
              <div className="comparison-label">Completion Rate</div>
            </div>
            <div className="comparison-card">
              <div className="comparison-value">
                {activeDayCount > 0 ? `${daysDone}/${activeDayCount}` : 'N/A'}
              </div>
              <div className="comparison-label">Days Done</div>
            </div>
            <div className="comparison-card">
              <div className="comparison-value">{formatRate(sinceCreatedRate)}</div>
              <div className="comparison-label">Since Created</div>
            </div>
          </div>

          {rangeNote && <p className="hd-range-note">{rangeNote}</p>}
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
            {PRESET_DAYS.map((days) => (
              <button
                key={days}
                className={`preset-btn ${activePreset === days ? 'active' : ''}`}
                onClick={() => handlePresetClick(days)}
              >
                {days / 7} Weeks
              </button>
            ))}
            {habitStartStr && (
              <button
                className={`preset-btn ${activePreset === 'created' ? 'active' : ''}`}
                onClick={handleSinceCreatedClick}
              >
                Since created
              </button>
            )}
          </div>
        </div>

        <div className="section hd-view">
          {/* Every tab body is at least as tall as the heatmap, so the tab
              buttons below stay put when you switch tabs. */}
          <div className="hd-tab-body" ref={bodyRef} style={{ minHeight: `${7 * cellSize + 6 * HEATMAP_GAP + 35}px` }}>
          {tab === 'chart' && (
            <div className="hd-rc">
              {shownPoint ? (
                <>
                  <div className="hd-rc-readout">
                    <span className="hd-rc-title">Rolling 7-day rate</span>
                    <span className="hd-rc-value">
                      {formatShortDate(shownPoint.date)}: <strong>{shownPoint.rate}%</strong>
                    </span>
                  </div>
                  <div className="hd-rc-chart">
                    <div className="hd-rc-yaxis">
                      <span>100%</span>
                      <span>50%</span>
                      <span>0%</span>
                    </div>
                    <div
                      className="hd-rc-plot"
                      onMouseMove={handleChartMove}
                      onMouseLeave={() => setHoverIdx(null)}
                    >
                      <svg className="hd-rc-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {[0, 50, 100].map(y => (
                          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#EEEEEE" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        ))}
                        {rollingArea && <path d={rollingArea} fill="black" fillOpacity="0.06" stroke="none" />}
                        <path d={rollingLine} fill="none" stroke="black" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                      </svg>
                      {hoverIdx !== null && shownPoint && (
                        <div
                          className="hd-rc-marker"
                          style={{ left: `${rollingX(shownIdx)}%`, top: `${rollingY(shownPoint.rate)}%` }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="hd-rc-xaxis">
                    {rollingTicks.map((t, i) => (
                      <span key={i} className="hd-rc-tick" style={{ left: `${t.left}%` }}>{t.label}</span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="hd-insight">Not enough data in this range yet.</p>
              )}
            </div>
          )}

          {tab === 'heatmap' && (
            <>
              <div className="hm-container" style={{ '--hm-cell-size': `${cellSize}px` }}>
                <div className="hm-day-labels">
                  {dayLabels.map((label) => (
                    <div key={label} className="hm-day-label">{label}</div>
                  ))}
                </div>
                <div className="hm-scroll-region" ref={scrollRegionRef}>
                  <div className="hm-scroll-content">
                    <div className="hm-grid">
                      {heatmapWeeks.map((week, weekIdx) => {
                        const firstReal = week.find(d => !d.isPadding);
                        const startsMonth = weekIdx > 0 && monthLabels[weekIdx] !== null;
                        return (
                          <div key={weekIdx} className={`hm-week ${startsMonth ? 'hm-week-month-start' : ''}`}>
                            <div className="hm-week-column">
                              {week.map((day, dayIdx) => (
                                <div
                                  key={`${weekIdx}-${dayIdx}`}
                                  className={`hm-cell ${getHeatmapCellClass(day)} ${day.date === todayStr ? 'hm-cell-today' : ''} ${isOutsideRange(day) ? 'hm-cell-out' : ''}`}
                                  title={getHeatmapTooltip(day)}
                                />
                              ))}
                            </div>
                            <div className="hm-month-label-cell">{firstReal ? monthLabels[weekIdx] || '' : ''}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === 'weekdays' && (
            <div className="hd-weekdays">
              <div className="hd-wd-bars">
                {dayLabels.map((label, i) => {
                  const rate = weekdayRates[i];
                  const isBest = bestRate !== null && rate === bestRate;
                  return (
                    <div
                      key={label}
                      className="hd-wd-col"
                      title={weekdayStats[i].active > 0 ? `${weekdayStats[i].done} of ${weekdayStats[i].active} ${label}s done` : `No ${label}s in this range`}
                    >
                      <div className={`hd-wd-pct ${isBest ? 'hd-wd-pct-best' : ''}`}>{formatWeekdayRate(rate)}</div>
                      <div className="hd-wd-track">
                        <div
                          className={`hd-wd-bar ${isBest ? 'hd-wd-bar-best' : ''}`}
                          style={{ height: `${Math.round((rate || 0) * 100)}%` }}
                        />
                      </div>
                      <div className={`hd-wd-name ${isBest ? 'hd-wd-name-best' : ''}`}>{label}</div>
                    </div>
                  );
                })}
              </div>
              <p className="hd-insight hd-insight-below">{weekdayInsight}</p>
            </div>
          )}

          {tab === 'streaks' && (
            <div className="hd-timeline-wrap">
              {timelineBars.length === 0 ? (
                <p className="hd-insight">No streaks of 2 or more days in this range.</p>
              ) : (
                <>
                  <div className="hd-timeline">
                    {timelineBars.map(({ run, shown, left, width, isCurrent }) => (
                      <div
                        key={run.start}
                        className={`hd-tl-bar ${isCurrent ? 'hd-tl-bar-current' : ''}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${formatRun(run)} (${run.length} days)`}
                      >
                        {/* Too narrow to hold the number: hover shows it instead */}
                        {width >= 5 ? shown : ''}
                      </div>
                    ))}
                  </div>
                  <div className="hd-tl-months">
                    {timelineTicks.map((m, i) => (
                      <span key={i} className="hd-tl-month" style={{ left: `${m.left}%` }}>{m.label}</span>
                    ))}
                  </div>
                  <p className="hd-tl-hint">Each bar is a streak of 2 or more days. Black is the current one.</p>
                </>
              )}

              <div className="stats-grid hd-streak-cards">
                <div className="stat-card">
                  <div className="stat-icon">🔥</div>
                  <div className="stat-value">{rangeCurrent ? rangeCurrent.length : 0}</div>
                  <div className="stat-label">Current</div>
                  <div className="stat-dates">
                    {rangeCurrent
                      ? `Since ${formatShortDate(rangeCurrent.start)}`
                      : lastCompletionRun && lastCompletionRun.end === endDate
                        ? 'Day 1, keep going'
                        : rangePrevious
                          ? `Ended ${formatShortDate(rangePrevious.end)}`
                          : 'None in range'}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">⬅️</div>
                  <div className="stat-value">{rangePrevious ? rangePrevious.length : 0}</div>
                  <div className="stat-label">Previous</div>
                  <div className="stat-dates">{rangePrevious ? formatRun(rangePrevious) : 'None in range'}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">🏆</div>
                  <div className="stat-value">{rangeLongest ? rangeLongest.length : 0}</div>
                  <div className="stat-label">Longest</div>
                  <div className="stat-dates">{rangeLongest ? formatRun(rangeLongest) : 'None in range'}</div>
                </div>
              </div>
            </div>
          )}

          </div>

          <div className="view-toggle">
            {[['chart', 'Chart'], ['heatmap', 'Heatmap'], ['weekdays', 'Weekdays'], ['streaks', 'Streaks']].map(([key, label]) => (
              <button
                key={key}
                className={`view-toggle-btn ${tab === key ? 'active' : ''}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
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