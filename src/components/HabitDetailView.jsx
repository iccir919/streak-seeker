import { useState } from 'react';
import { getHabitLogs } from '../utils/storage';
import { calculateCurrentStreak, calculateLongestStreak, formatDate } from '../utils/dateHelpers';
import './HabitDetailView.css';

function HabitDetailView({ habit, onBack, onEdit }) {
  if (!habit) return null;

  const logs = getHabitLogs(habit.id);
  const currentStreak = calculateCurrentStreak(logs);
  const longestStreak = calculateLongestStreak(logs);

  // Get earliest completion date
  const completedDates = Object.keys(logs).filter(date => logs[date]).sort();
  const earliestCompletionDate = completedDates.length > 0 ? completedDates[0] : null;

  // Calculate completion stats based on earliest completion
  const getCompletionStatsFromEarliest = () => {
    if (!earliestCompletionDate) {
      return {
        last7: { completed: 0, total: 0, rate: 0 },
        last30: { completed: 0, total: 0, rate: 0 },
        last90: { completed: 0, total: 0, rate: 0 },
        allTime: { completed: 0, total: 0, rate: 0 }
      };
    }

    const today = new Date();
    const startDate = new Date(earliestCompletionDate + 'T00:00:00');

    const getLast = (days) => {
      let completed = 0;
      let total = 0;
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = formatDate(date);
        
        // Only count if it's after the earliest completion
        if (date >= startDate) {
          total++;
          if (logs[dateStr]) completed++;
        }
      }
      return { completed, total, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
    };

    const getAllTime = () => {
      const daysSinceEarliest = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
      let completed = 0;
      for (let i = 0; i < daysSinceEarliest; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = formatDate(date);
        if (logs[dateStr]) completed++;
      }
      return { completed, total: daysSinceEarliest, rate: Math.round((completed / daysSinceEarliest) * 100) };
    };

    return {
      last7: getLast(7),
      last30: getLast(30),
      last90: getLast(90),
      allTime: getAllTime()
    };
  };

  const stats = getCompletionStatsFromEarliest();

  // Calculate total completions
  const totalCompletions = Object.values(logs).filter(completed => completed).length;

  // Get days since earliest completion
  const daysSinceEarliest = earliestCompletionDate 
    ? Math.floor((new Date() - new Date(earliestCompletionDate + 'T00:00:00')) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  // Format creation date
  const formatCreationDate = () => {
    const createdDate = new Date(habit.createdAt);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return createdDate.toLocaleDateString('en-US', options);
  };

  // Format earliest completion date
  const formatEarliestDate = () => {
    if (!earliestCompletionDate) return 'N/A';
    const date = new Date(earliestCompletionDate + 'T00:00:00');
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  // Render progress bar
  const ProgressBar = ({ rate }) => (
    <div className="progress-bar-container">
      <div className="progress-bar-fill" style={{ width: `${rate}%` }}>
        <span className="progress-bar-text">{rate}%</span>
      </div>
    </div>
  );

  // Generate mini heatmap (last 90 days)
  const generateHeatmap = () => {
    const days = [];
    for (let i = 89; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = formatDate(date);
      const isCompleted = logs[dateStr] || false;
      days.push({ date: dateStr, completed: isCompleted });
    }
    return days;
  };

  const heatmapDays = generateHeatmap();

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
          ✏️ Edit
        </button>
      </div>

      <div className="detail-content">
        {/* Streak Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🔥</div>
            <div className="stat-value">{currentStreak}</div>
            <div className="stat-label">Current Streak</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🏆</div>
            <div className="stat-value">{longestStreak}</div>
            <div className="stat-label">Longest Streak</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✓</div>
            <div className="stat-value">{totalCompletions}</div>
            <div className="stat-label">Total Completions</div>
          </div>
        </div>

        {/* Completion Rates */}
        <div className="section">
          <h2>Completion Rate</h2>
          
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
              <span>Last 90 days</span>
              <span className="stat-row-count">{stats.last90.completed}/{stats.last90.total}</span>
            </div>
            <ProgressBar rate={stats.last90.rate} />
          </div>

          <div className="stat-row">
            <div className="stat-row-label">
              <span>All time</span>
              <span className="stat-row-count">{stats.allTime.completed}/{stats.allTime.total}</span>
            </div>
            <ProgressBar rate={stats.allTime.rate} />
          </div>
        </div>

        {/* Heatmap */}
        <div className="section">
          <h2>Last 90 Days</h2>
          <div className="heatmap">
            {heatmapDays.map((day, index) => (
              <div
                key={day.date}
                className={`heatmap-cell ${day.completed ? 'completed' : 'empty'}`}
                title={`${day.date}${day.completed ? ' ✓' : ''}`}
              />
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="section info-section">
          <div className="info-row">
            <span className="info-label">Created:</span>
            <span className="info-value">{formatCreationDate()}</span>
          </div>
          <div className="info-row">
            <span className="info-label">First completion:</span>
            <span className="info-value">{formatEarliestDate()}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Days tracked:</span>
            <span className="info-value">{daysSinceEarliest} days</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HabitDetailView;