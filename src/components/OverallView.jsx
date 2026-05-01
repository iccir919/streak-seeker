import { useState } from 'react';
import { getHabits, getHabitLogs } from '../utils/storage';
import { formatDate } from '../utils/dateHelpers';
import './OverallView.css';

function OverallView({ onBack }) {
  const habits = getHabits();
  const [selectedPeriod, setSelectedPeriod] = useState(90);
  const [customRange, setCustomRange] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Get total days in current range
  const getTotalDays = () => {
    if (customRange) {
      return Math.floor((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
    }
    return selectedPeriod;
  };

  // Generate heatmap data for all habits
  const generateHeatmapData = () => {
    const days = [];
    
    if (customRange) {
      const start = new Date(startDate + 'T00:00:00');
      const totalDays = getTotalDays();
      
      for (let i = 0; i < totalDays; i++) {
        const date = new Date(start);
        date.setDate(date.getDate() + i);
        const dateStr = formatDate(date);
        
        let completedCount = 0;
        habits.forEach(habit => {
          const logs = getHabitLogs(habit.id);
          if (logs[dateStr]) completedCount++;
        });

        days.push({
          date: dateStr,
          completedCount,
          totalHabits: habits.length,
          percentage: habits.length > 0 ? Math.round((completedCount / habits.length) * 100) : 0
        });
      }
    } else {
      for (let i = selectedPeriod - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = formatDate(date);
        
        let completedCount = 0;
        habits.forEach(habit => {
          const logs = getHabitLogs(habit.id);
          if (logs[dateStr]) completedCount++;
        });

        days.push({
          date: dateStr,
          completedCount,
          totalHabits: habits.length,
          percentage: habits.length > 0 ? Math.round((completedCount / habits.length) * 100) : 0
        });
      }
    }
    
    return days;
  };

  // Calculate overall stats
  const calculateOverallStats = (heatmapData) => {
    let totalCompletions = 0;
    let totalPossible = 0;
    let perfectDays = 0;
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    for (let i = heatmapData.length - 1; i >= 0; i--) {
      const day = heatmapData[i];
      totalCompletions += day.completedCount;
      totalPossible += day.totalHabits;

      if (day.percentage === 100) {
        perfectDays++;
        tempStreak++;
        if (i === heatmapData.length - 1) {
          currentStreak = tempStreak;
        }
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    const overallRate = totalPossible > 0 ? Math.round((totalCompletions / totalPossible) * 100) : 0;

    return {
      totalCompletions,
      totalPossible,
      overallRate,
      perfectDays,
      currentStreak,
      longestStreak
    };
  };

  // Get color intensity for heatmap cell
  const getHeatmapColor = (percentage) => {
    if (percentage === 0) return 'level-0';
    if (percentage < 25) return 'level-1';
    if (percentage < 50) return 'level-2';
    if (percentage < 75) return 'level-3';
    if (percentage < 100) return 'level-4';
    return 'level-5';
  };

  // Format date for tooltip
  const formatDateForTooltip = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  // Calculate habit-specific stats
  const getHabitStats = (heatmapData) => {
    const totalDays = getTotalDays();
    
    return habits.map(habit => {
      const logs = getHabitLogs(habit.id);
      let completions = 0;
      
      heatmapData.forEach(day => {
        if (logs[day.date]) completions++;
      });

      const rate = totalDays > 0 ? Math.round((completions / totalDays) * 100) : 0;

      return {
        habit,
        completions,
        rate
      };
    }).sort((a, b) => b.rate - a.rate);
  };

  // Calculate columns for heatmap grid
  const getGridColumns = () => {
    const totalDays = getTotalDays();
    if (totalDays <= 7) return 7;
    if (totalDays <= 30) return 10;
    if (totalDays <= 60) return 15;
    if (totalDays <= 90) return 18;
    return 26;
  };

  // Handle preset period selection
  const handlePeriodSelect = (period) => {
    setSelectedPeriod(period);
    setCustomRange(false);
  };

  // Render progress bar
  const ProgressBar = ({ rate }) => (
    <div className="progress-bar-container">
      <div className="progress-bar-fill" style={{ width: `${rate}%` }}>
        <span className="progress-bar-text">{rate}%</span>
      </div>
    </div>
  );

  const heatmapData = generateHeatmapData();
  const stats = calculateOverallStats(heatmapData);
  const habitStats = getHabitStats(heatmapData);
  const totalDays = getTotalDays();

  const displayPeriodText = customRange 
    ? `${new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : `Last ${selectedPeriod} Days`;

  return (
    <div className="overall-view">
      <div className="overall-header">
        <button className="btn-back" onClick={onBack}>
          ←
        </button>
        <h1 className="overall-title">Overall Stats</h1>
      </div>

      <div className="overall-content">
        {/* Period Selector */}
        <div className="period-selector">
          <button
            className={`period-btn ${selectedPeriod === 7 && !customRange ? 'active' : ''}`}
            onClick={() => handlePeriodSelect(7)}
          >
            7 Days
          </button>
          <button
            className={`period-btn ${selectedPeriod === 30 && !customRange ? 'active' : ''}`}
            onClick={() => handlePeriodSelect(30)}
          >
            30 Days
          </button>
          <button
            className={`period-btn ${selectedPeriod === 60 && !customRange ? 'active' : ''}`}
            onClick={() => handlePeriodSelect(60)}
          >
            60 Days
          </button>
          <button
            className={`period-btn ${selectedPeriod === 90 && !customRange ? 'active' : ''}`}
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

        {/* Stats Cards */}
        <div className="stats-overview">
          <div className="stat-card-small">
            <div className="stat-icon-small">✓</div>
            <div className="stat-value-small">{stats.overallRate}%</div>
            <div className="stat-label-small">Completion Rate</div>
          </div>
          <div className="stat-card-small">
            <div className="stat-icon-small">🎯</div>
            <div className="stat-value-small">{stats.perfectDays}</div>
            <div className="stat-label-small">Perfect Days</div>
          </div>
          <div className="stat-card-small">
            <div className="stat-icon-small">🔥</div>
            <div className="stat-value-small">{stats.currentStreak}</div>
            <div className="stat-label-small">Current Streak</div>
          </div>
          <div className="stat-card-small">
            <div className="stat-icon-small">🏆</div>
            <div className="stat-value-small">{stats.longestStreak}</div>
            <div className="stat-label-small">Longest Streak</div>
          </div>
        </div>

        {/* Heatmap */}
        <div className="section">
          <h2>Activity Heatmap - {displayPeriodText}</h2>
          <div 
            className="heatmap-large" 
            style={{ gridTemplateColumns: `repeat(${getGridColumns()}, 1fr)` }}
          >
            {heatmapData.map((day) => (
              <div
                key={day.date}
                className={`heatmap-cell-large ${getHeatmapColor(day.percentage)}`}
                title={`${formatDateForTooltip(day.date)}: ${day.completedCount}/${day.totalHabits} habits (${day.percentage}%)`}
              />
            ))}
          </div>
          <div className="heatmap-legend">
            <span>Less</span>
            <div className="legend-boxes">
              <div className="legend-box level-0"></div>
              <div className="legend-box level-1"></div>
              <div className="legend-box level-2"></div>
              <div className="legend-box level-3"></div>
              <div className="legend-box level-4"></div>
              <div className="legend-box level-5"></div>
            </div>
            <span>More</span>
          </div>
        </div>

        {/* Habit Rankings */}
        <div className="section">
          <h2>Habit Performance</h2>
          <div className="habit-rankings">
            {habitStats.map((item, index) => (
              <div key={item.habit.id} className="ranking-row">
                <div className="ranking-position">{index + 1}</div>
                <div className="ranking-habit">
                  <span className="ranking-icon">{item.habit.icon}</span>
                  <span className="ranking-name">{item.habit.name}</span>
                </div>
                <div className="ranking-stats">
                  <span className="ranking-count">{item.completions}/{totalDays}</span>
                  <div className="ranking-bar-container">
                    <div 
                      className="ranking-bar" 
                      style={{ width: `${item.rate}%` }}
                    />
                  </div>
                  <span className="ranking-rate">{item.rate}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Additional Insights */}
        <div className="section">
          <h2>Insights</h2>
          <div className="insights">
            <div className="insight-card">
              <div className="insight-label">Total Completions</div>
              <div className="insight-value">{stats.totalCompletions} / {stats.totalPossible}</div>
            </div>
            <div className="insight-card">
              <div className="insight-label">Active Habits</div>
              <div className="insight-value">{habits.length}</div>
            </div>
            <div className="insight-card">
              <div className="insight-label">Average per Day</div>
              <div className="insight-value">
                {habits.length > 0 ? (stats.totalCompletions / totalDays).toFixed(1) : 0}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OverallView;