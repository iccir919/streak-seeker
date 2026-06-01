import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getDayOfWeek, calculateCurrentStreak } from '../utils/dateHelpers';
import { getHabitLogs } from '../utils/storage';
import ActionMenu from './ActionMenu';
import './HabitRow.css';

function HabitRow({ habit, dates, today, onToggle, onHabitClick, onEdit, onArchive, onUnarchive, onDelete }) {
  if (!habit || !habit.id) return null;
  
  const [menuOpen, setMenuOpen] = useState(false);
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

  const isPartOfStreak = (dateStr) => {
    if (currentStreak === 0) return false;
    
    const todayDate = new Date();
    const checkDate = new Date(dateStr + 'T00:00:00');
    const daysDiff = Math.floor((todayDate - checkDate) / (1000 * 60 * 60 * 24));
    
    return logs[dateStr] && daysDiff < currentStreak;
  };

  const handleDelete = () => {
    if (window.confirm(`Delete "${habit.name}"? This will permanently delete the habit and all its history. This cannot be undone.`)) {
      onDelete(habit.id);
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="habit-grid-row"
    >
      {/* Drag handle - leftmost */}
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

      {/* Menu button */}
      <div className="habit-menu-col">
        <button 
          className="menu-btn"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          title="Actions"
        >
          ≡
        </button>
        <ActionMenu
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          onEdit={() => onEdit(habit)}
          onArchive={() => onArchive(habit.id)}
          onUnarchive={() => onUnarchive(habit.id)}
          onDelete={handleDelete}
          isArchived={habit.archived}
        />
      </div>

      {/* Icon */}
      <div className="habit-info-col">
        <button 
          className="habit-icon-btn"
          onClick={() => onHabitClick(habit.id)}
          title={habit.name}
        >
          {habit.icon || habit.name}
        </button>
      </div>

      {/* Day columns */}
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