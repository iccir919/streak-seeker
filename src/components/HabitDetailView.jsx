import { useState } from 'react';
import { getHabitLogs } from '../utils/storage';
import { calculateCurrentStreak, calculateLongestStreak, formatDate } from '../utils/dateHelpers';
import './HabitDetailView.css';

function HabitDetailView({ habit, onBack, onEdit }) {
  if (!habit) return null;

  const [heatmapPeriod, setHeatmapPeriod] = useState(30);
  const [customRange, setCustomRange] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const logs = getHabitLogs(habit.id);
  const currentStreak = calculateCurrentStreak(logs);
  const longestStreak = calculateLongestStreak(logs);

  // Calculate total completions
  const totalCompletions = Object.values(logs).filter(completed => completed).length;

  // Calculate completion stats for last N days
  const getLastNDaysStats = (days) => {
    let completed = 0;
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = formatDate(date);
      if (logs[dateStr]) completed++;
    }
    return { 
      completed, 
      total: days, 
      rate: Math.round((completed / days) * 100) 
    };
  };

  // Calculate rate since created
  const getSinceCreatedRate = () => {
    const startDate = new Date(habit.createdAt);
    const today = new Date();
    const daysSince = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    let completed = 0;
    for (let i = 0; i < daysSince; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = formatDate(date);
      if (logs[dateStr]) completed++;
    }
    
    return daysSince > 0 ? Math.round((completed / daysSince) * 100) : 0;
  };

  const stats = {
    last7: getLastNDaysStats(7),
    last30: getLastNDaysStats(30),
    last60: getLastNDaysStats(60),
    last90: getLastNDaysStats(90),
    sinceCreatedRate: getSinceCreatedRate()
  };

  // Get total days in heatmap period
  const getHeatmapTotalDays = () => {
    if (customRange) {
      return Math.floor((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
    }
    return heatmapPeriod;
  };

  // Format creation date
  const formatCreationDate = () => {
    const createdDate = new Date(habit.createdAt);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return createdDate.toLocaleDateString('en-US', options);
  };

  // Format date for tooltip (e.g., "April 22, 2026")
  const formatDateForTooltip = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  // Render progress bar
  const ProgressBar = ({ rate }) => (
    <div className="progress-bar-container">
      <div 
        className="progress-bar-fill" 
        style={{ width: `${rate}%`, minWidth: rate > 0 ? '40px' : '0px' }}
      >
        {rate > 0 && <span className="progress-bar-text">{rate}%</span>}
      </div>
      {rate === 0 && (
        <span className="progress-bar-text-zero">0%</span>
      )}
    </div>
  );

  // Generate heatmap based on selected period
  const generateHeatmap = () => {
    const result = [];
    const totalDays = getHeatmapTotalDays();

    if (customRange) {
      const start = new Date(startDate + 'T00:00:00');
      for (let i = 0; i < totalDays; i++) {
        const date = new Date(start);
        date.setDate(date.getDate() + i);
        const dateStr = formatDate(date);
        const isCompleted = logs[dateStr] || false;
        result.push({ date: dateStr, completed: isCompleted });
      }
    } else {
      for (let i = heatmapPeriod - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = formatDate(date);
        const isCompleted = logs[dateStr] || false;
        result.push({ date: dateStr, completed: isCompleted });
      }
    }
    return result;
  };

  const heatmapDays = generateHeatmap();

  // Calculate grid columns based on period
  const getHeatmapColumns = () => {
    const totalDays = getHeatmapTotalDays();
    if (totalDays <= 7) return 7;
    if (totalDays <= 30) return 10;
    if (totalDays <= 60) return 15;
    if (totalDays <= 90) return 18;
    return 20;
  };

  // Handle period selection
  const handlePeriodSelect = (period) => {
    setHeatmapPeriod(period);
    setCustomRange(false);
  };

  // Display text for the heatmap period
  const heatmapPeriodText = customRange 
    ? `${new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : `Last ${heatmapPeriod} Days`;

  return (
    <div className="habit-detail">
      <div className="detail-header">
        <button className="btn-back" onClick={onBack}>
          ←
        </button>
        <div className="detail-title">
          <span className="detail-icon">{habit.icon}</span>
          <h1>{habit.name}</h1>
        </div>
        <button className="btn-edit-detail" onClick={() => onEdit(habit)}>
          ✏️
        </button>
      </div>

      <div className="detail-content">
        {/* Stats Grid - 4 cards (always all-time) */}
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
            <div className="stat-icon">✓</div>
            <div className="stat-value">{totalCompletions}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-value">{stats.sinceCreatedRate}%</div>
            <div className="stat-label">Since Created</div>
          </div>
        </div>

        {/* Completion Rates - All 4 periods */}
        <div className="section">
          <h2>📈 Completion Rate</h2>
          
          <div className="stat-row">
            <div className="stat-row-label">
              <span>Last 7 days</span>
              <span className="stat-row-count">{stats.last7.completed}/{stats.last7.total}</span>
            </div>
            <ProgressBar rate={stats.last7.rate} />
          </div>

          <div className="stat-row">
            <div className="stat-row-label">
              <span>Last 30 days</span>
              <span className="stat-row-count">{stats.last30.completed}/{stats.last30.total}</span>
            </div>
            <ProgressBar rate={stats.last30.rate} />
          </div>

          <div className="stat-row">
            <div className="stat-row-label">
              <span>Last 60 days</span>
              <span className="stat-row-count">{stats.last60.completed}/{stats.last60.total}</span>
            </div>
            <ProgressBar rate={stats.last60.rate} />
          </div>

          <div className="stat-row">
            <div className="stat-row-label">
              <span>Last 90 days</span>
              <span className="stat-row-count">{stats.last90.completed}/{stats.last90.total}</span>
            </div>
            <ProgressBar rate={stats.last90.rate} />
          </div>
        </div>

        {/* Heatmap with Period Selector */}
        <div className="section">
          <h2>🗓️ {heatmapPeriodText}</h2>
          
          <div className="period-selector">
            <button
              className={`period-btn ${heatmapPeriod === 7 && !customRange ? 'active' : ''}`}
              onClick={() => handlePeriodSelect(7)}
            >
              7 Days
            </button>
            <button
              className={`period-btn ${heatmapPeriod === 30 && !customRange ? 'active' : ''}`}
              onClick={() => handlePeriodSelect(30)}
            >
              30 Days
            </button>
            <button
              className={`period-btn ${heatmapPeriod === 60 && !customRange ? 'active' : ''}`}
              onClick={() => handlePeriodSelect(60)}
            >
              60 Days
            </button>
            <button
              className={`period-btn ${heatmapPeriod === 90 && !customRange ? 'active' : ''}`}
              onClick={() => handlePeriodSelect(90)}
            >
              90 Days
            </button>
            <button
              className={`period-btn ${customRange ? 'active' : ''}`}
              onClick={() => setCustomRange(true)}
            >
              Custom
            </button>
          </div>

          {/* Custom Date Range Picker */}
          {customRange && (
            <div className="date-picker-container">
              <div className="date-picker-wrapper">
                <label>Start Date:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={endDate}
                  className="date-picker-input"
                />
              </div>
              <div className="date-picker-wrapper">
                <label>End Date:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  max={new Date().toISOString().split('T')[0]}
                  className="date-picker-input"
                />
              </div>
            </div>
          )}

          <div 
            className="heatmap"
            style={{ gridTemplateColumns: `repeat(${getHeatmapColumns()}, 1fr)` }}
          >
            {heatmapDays.map((day) => (
              <div
                key={day.date}
                className={`heatmap-cell ${day.completed ? 'completed' : 'empty'}`}
                title={`${formatDateForTooltip(day.date)}${day.completed ? ' ✓' : ''}`}
              />
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="section info-section">
          <div className="info-row">
            <span className="info-label">Created</span>
            <span className="info-value">{formatCreationDate()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HabitDetailView;