import { getDayOfWeek, calculateCurrentStreak } from '../utils/dateHelpers';
import { getHabitLogs } from '../utils/storage';
import './HabitRow.css';

function HabitRow({ habit, dates, onToggle, onHabitClick, onEdit }) {
  const logs = getHabitLogs(habit.id);
  const currentStreak = calculateCurrentStreak(logs);

  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit(habit);
  };

  // Check if a date is part of the current streak
  const isPartOfStreak = (dateStr) => {
    if (currentStreak === 0) return false;
    
    const today = new Date();
    const checkDate = new Date(dateStr + 'T00:00:00');
    const daysDiff = Math.floor((today - checkDate) / (1000 * 60 * 60 * 24));
    
    // Date is part of streak if it's completed and within the streak range
    return logs[dateStr] && daysDiff < currentStreak;
  };

  return (
    <div className="habit-grid-row">
      {/* Left column - Drag handle */}
      <div className="habit-actions-col-left">
        <button className="drag-handle" title="Drag to reorder">
          ⋮
        </button>
      </div>

      {/* Edit button - between drag and emoji */}
      <div className="habit-edit-col">
        <button 
          className="action-btn edit-btn" 
          onClick={handleEdit}
          title="Edit habit"
        >
          ✏️
        </button>
      </div>

      {/* Info column - Icon only */}
      <div className="habit-info-col">
        <button 
          className="habit-icon-btn"
          onClick={() => onHabitClick(habit.id)}
          title={habit.name}
        >
          {habit.icon || habit.name}
        </button>
      </div>

      {/* Day columns - Checkboxes with fire emoji for streaks */}
      {dates.map((date) => {
        const isCompleted = logs[date] || false;
        const isStreak = isPartOfStreak(date);
        const dayOfWeek = getDayOfWeek(date);
        
        return (
          <div key={date} className="day-col">
            <button
              className={`checkbox ${isCompleted ? 'checked' : ''} ${isStreak ? 'streak' : ''}`}
              onClick={() => onToggle(habit.id, date)}
              title={`${dayOfWeek} ${date}${isStreak ? ' - On streak! 🔥' : ''}`}
            >
              {isCompleted && (isStreak ? '🔥' : '✓')}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default HabitRow;