import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { getDayOfWeek } from '../utils/dateHelpers';
import HabitRow from './HabitRow';
import './HabitList.css';

function HabitList({ habits, onToggle, onHabitClick, onEdit, dateOffset, onNavigatePrevious, onNavigateNext, onReorder }) {
  if (habits.length === 0) {
    return null;
  }

  // Get dates based on offset
  const getDatesWithOffset = (offset) => {
    const dates = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() + offset - i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }
    return dates;
  };

  const dates = getDatesWithOffset(dateOffset);

  // Get day of month from date string
  const getDayOfMonth = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.getDate();
  };

  // Format date range for display
  const getDateRange = () => {
    const firstDate = new Date(dates[0] + 'T00:00:00');
    const lastDate = new Date(dates[dates.length - 1] + 'T00:00:00');
    
    const formatDate = (date) => {
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const day = date.getDate();
      return `${month} ${day}`;
    };
    
    return `${formatDate(firstDate)} - ${formatDate(lastDate)}`;
  };

  const isToday = dateOffset === 0;

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = habits.findIndex((habit) => habit.id === active.id);
      const newIndex = habits.findIndex((habit) => habit.id === over.id);

      onReorder(oldIndex, newIndex);
    }
  };

  return (
    <div className="habit-list">
      {/* Header Row */}
      <div className="habit-grid-header">
        <button className="nav-btn" onClick={onNavigatePrevious} title="Previous period">
          ←
        </button>
        
        <span className="date-range">{getDateRange()}</span>
        
        <button 
          className="nav-btn" 
          onClick={onNavigateNext} 
          title="Next period"
          disabled={isToday}
          style={{ opacity: isToday ? 0.3 : 1, cursor: isToday ? 'not-allowed' : 'pointer' }}
        >
          →
        </button>

        {dates.map((date) => (
          <div key={date} className="day-header-cell">
            <div className="day-header-label">{getDayOfWeek(date)}</div>
            <div className="day-header-date">{getDayOfMonth(date)}</div>
          </div>
        ))}
      </div>

      {/* Habit Rows - Sortable */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={habits.map(h => h.id)}
          strategy={verticalListSortingStrategy}
        >
          {habits.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              dates={dates}
              onToggle={onToggle}
              onHabitClick={onHabitClick}
              onEdit={onEdit}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

export default HabitList;