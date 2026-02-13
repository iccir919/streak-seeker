import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getDayOfWeek, calculateCurrentStreak } from '../utils/dateHelpers';
import { getHabitLogs } from '../utils/storage';
import './HabitRow.css';

function HabitRow({ habit, dates, today, onToggle, onHabitClick, onEdit }) {
  const logs = getHabitLogs(habit.id);
  const currentStreak = calculateCurrentStreak(logs);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: habit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit(habit);
  };

  // Check if a date is part of the current streak
  const isPartOfStreak = (dateStr) => {
    if (currentStreak === 0) return false;
    
    const todayDate = new Date();
    const checkDate = new Date(dateStr + 'T00:00:00');
    const daysDiff = Math.floor((todayDate - checkDate) / (1000 * 60 * 60 * 24));
    
    return logs[dateStr] && daysDiff < currentStreak;
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="habit-grid-row"
    >
      {/* Left column - Drag handle */}
      <div className="habit-actions-col-left">
        <button 
          className="drag-handle" 
          {...attributes} 
          {...listeners}
          title="Drag to reorder"
        >
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
        const isTodayDate = date === today;
        const dayOfWeek = getDayOfWeek(date);
        
        return (
          <div key={date} className={`day-col ${isTodayDate ? 'today-col' : ''}`}>
            <button
              className={`checkbox ${isCompleted ? 'checked' : ''} ${isStreak ? 'streak' : ''} ${isTodayDate ? 'today' : ''}`}
              onClick={() => onToggle(habit.id, date)}
              title={`${dayOfWeek} ${date}${isStreak ? ' - On streak! 🔥' : ''}${isTodayDate ? ' (Today)' : ''}`}
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