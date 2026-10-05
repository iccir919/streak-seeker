import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { getDayOfWeek, getToday } from '../utils/dateHelpers';
import HabitRow from './HabitRow';
import './HabitList.css';

function HabitList({ 
  habits, 
  onToggle, 
  onHabitClick, 
  onEdit, 
  onArchive, 
  onDelete, 
  dateOffset, 
  onNavigatePrevious, 
  onNavigateNext, 
  onReorder
}) {
  const activeHabits = habits.filter(h => !h.archived);

  if (activeHabits.length === 0) {
    return null;
  }

  const getDatesWithOffset = (offset) => {
    const dates = [];
    for (let i = 9; i >= 0; i--) {
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
  const today = getToday();

  const getDayOfMonth = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.getDate();
  };

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
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
      <div className="habit-grid-header">
        <div className="nav-section">
          <div className="date-range">{getDateRange()}</div>
          <div className="nav-buttons">
            <button className="nav-btn" onClick={onNavigatePrevious} title="Previous period">
              ←
            </button>
            <button 
              className="nav-btn" 
              onClick={onNavigateNext} 
              title="Next period"
              disabled={isToday}
              style={{ opacity: isToday ? 0.3 : 1, cursor: isToday ? 'not-allowed' : 'pointer' }}
            >
              →
            </button>
          </div>
        </div>

        {dates.map((date) => {
          const isTodayDate = date === today;
          return (
            <div key={date} className={`day-header-cell ${isTodayDate ? 'today' : ''}`}>
              <div className="day-header-label">{getDayOfWeek(date)}</div>
              <div className="day-header-date">{getDayOfMonth(date)}</div>
            </div>
          );
        })}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={activeHabits.map(h => h.id)}
          strategy={verticalListSortingStrategy}
        >
          {activeHabits.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              dates={dates}
              today={today}
              onToggle={onToggle}
              onHabitClick={onHabitClick}
              onEdit={onEdit}
              onArchive={onArchive}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

export default HabitList;