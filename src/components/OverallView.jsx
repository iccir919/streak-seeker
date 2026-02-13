import { useState } from 'react';
import { getHabits } from '../utils/storage';
import { getHabitLogs } from '../utils/storage';
import { formatDate } from '../utils/dateHelpers';
import './OverallView.css';

function OverallView({ onBack }) {
  const habits = getHabits();
  const [selectedPeriod, setSelectedPeriod] = useState(90); // 7, 30, 90, 180, 365

  // Generate heatmap data for all habits
  const generateHeatmapData = () => {
    const days = [];
    for (let i = selectedPeriod - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = formatDate(date);
      
      // Count how many habits were completed this day
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
    return days;
  };

  const heatmapData = generateHeatmapData();

  // Calculate overall stats
  const calculateOverallStats = () => {
    let totalCompletions = 0;
    let totalPossible = 0;
    let perfectDays = 0;
    let currentStreak = 0;
    let longestStreak = 0;

    // Count perfect days and streaks
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

  const stats = calculateOverallStats();

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
  const getHabitStats = () => {
    return habits.map(habit => {
      const logs = getHabitLogs(habit.id);
      let completions = 0;
      
      heatmapData.forEach(day => {
        if (logs[day.date]) completions++;
      });

      const rate = selectedPeriod > 0 ? Math.round((completions / selectedPeriod) * 100) : 0;

      return {
        habit,
        completions,
        rate
      };
    }).sort((a, b) => b.rate - a.rate); // Sort by completion rate
  };

  const habitStats = getHabitStats();

  // Calculate columns for heatmap grid
  const getGridColumns = () => {
    if (selectedPeriod === 7) return 7;
    if (selectedPeriod === 30) return 10;
    if (selectedPeriod === 90) return 18;
    if (selectedPeriod === 180) return 20;
    return 26;
  };

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
            className={`period-btn ${selectedPeriod === 7 ? 'active' : ''}`}
            onClick={() => setSelectedPeriod(7)}
          >
            7 Days
          </button>
          <button
            className={`period-btn ${selectedPeriod === 30 ? 'active' : ''}`}
            onClick={() => setSelectedPeriod(30)}
          >
            30 Days
          </button>
          <button
            className={`period-btn ${selectedPeriod === 90 ? 'active' : ''}`}
            onClick={() => setSelectedPeriod(90)}
          >
            90 Days
          </button>
          <button
            className={`period-btn ${selectedPeriod === 180 ? 'active' : ''}`}
            onClick={() => setSelectedPeriod(180)}
          >
            6 Months
          </button>
          <button
            className={`period-btn ${selectedPeriod === 365 ? 'active' : ''}`}
            onClick={() => setSelectedPeriod(365)}
          >
            1 Year
          </button>
        </div>

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
          <h2>Activity Heatmap</h2>
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
                  <span className="ranking-count">{item.completions}/{selectedPeriod}</span>
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
                {habits.length > 0 ? (stats.totalCompletions / selectedPeriod).toFixed(1) : 0}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OverallView;