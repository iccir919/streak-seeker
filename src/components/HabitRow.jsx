import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getDayOfWeek, calculateCurrentStreak } from '../utils/dateHelpers';
import { getHabitLogs } from '../utils/storage';
import ActionMenu from './ActionMenu';
import './HabitRow.css';

function HabitRow({ habit, dates, today, onToggle, onHabitClick, onEdit, onArchive, onUnarchive, onDelete }) {
  // All hooks run first; the missing-habit guard comes after them so the
  // hook order never changes between renders.
  const [menuOpen, setMenuOpen] = useState(false);
  const habitId = habit?.id;
  const logs = habitId ? getHabitLogs(habitId) : {};
  const currentStreak = calculateCurrentStreak(logs);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: habitId });

  if (!habit || !habitId) return null;

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
          <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
            <circle cx="3" cy="3" r="1.4" /><circle cx="7" cy="3" r="1.4" />
            <circle cx="3" cy="8" r="1.4" /><circle cx="7" cy="8" r="1.4" />
            <circle cx="3" cy="13" r="1.4" /><circle cx="7" cy="13" r="1.4" />
          </svg>
        </button>
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
      {/* Menu button - rightmost */}
      <div className="habit-menu-col">
        <button 
          className="menu-btn"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          title="Actions"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <rect x="1" y="2.5" width="12" height="1.6" rx="0.8" />
            <rect x="1" y="6.2" width="12" height="1.6" rx="0.8" />
            <rect x="1" y="9.9" width="12" height="1.6" rx="0.8" />
          </svg>
        </button>
        <ActionMenu
          align="right"
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          onEdit={() => onEdit(habit)}
          onArchive={() => onArchive(habit.id)}
          onUnarchive={() => onUnarchive(habit.id)}
          onDelete={handleDelete}
          isArchived={habit.archived}
        />
      </div>
    </div>
  );
}

export default HabitRow;