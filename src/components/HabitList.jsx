import { useState } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { getDayOfWeek, getToday } from '../utils/dateHelpers';
import HabitRow from './HabitRow';
import ActionMenu from './ActionMenu';
import './HabitList.css';

function HabitList({ habits, onToggle, onHabitClick, onEdit, onArchive, onUnarchive, onDelete, dateOffset, onNavigatePrevious, onNavigateNext, onReorder }) {
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const [archivedMenuOpen, setArchivedMenuOpen] = useState(null); // stores habit id

  const activeHabits = habits.filter(h => !h.archived);
  const archivedHabits = habits
    .filter(h => h.archived)
    .sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));

  if (activeHabits.length === 0 && archivedHabits.length === 0) {
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

  const handleArchivedDelete = (habit) => {
    if (window.confirm(`Delete "${habit.name}"? This will permanently delete the habit and all its history. This cannot be undone.`)) {
      onDelete(habit.id);
    }
  };

  return (
    <div className="habit-list">
      {activeHabits.length > 0 && (
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
      )}

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
              onUnarchive={onUnarchive}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>
      </DndContext>

      {archivedHabits.length > 0 && (
        <div className="archived-section">
          <button 
            className="archived-toggle"
            onClick={() => setArchivedExpanded(!archivedExpanded)}
          >
            <span className="archived-arrow">{archivedExpanded ? '▼' : '▶'}</span>
            <span>Archived ({archivedHabits.length})</span>
          </button>

          {archivedExpanded && (
            <div className="archived-list">
              {archivedHabits.map((habit) => (
                <div key={habit.id} className="archived-habit-row">
                  <div className="archived-menu-wrapper">
                    <button 
                      className="menu-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setArchivedMenuOpen(archivedMenuOpen === habit.id ? null : habit.id);
                      }}
                      title="Actions"
                    >
                      ⋮
                    </button>
                    <ActionMenu
                      isOpen={archivedMenuOpen === habit.id}
                      onClose={() => setArchivedMenuOpen(null)}
                      onEdit={() => onEdit(habit)}
                      onArchive={() => onArchive(habit.id)}
                      onUnarchive={() => onUnarchive(habit.id)}
                      onDelete={() => handleArchivedDelete(habit)}
                      isArchived={true}
                    />
                  </div>
                  <button 
                    className="archived-habit-content"
                    onClick={() => onHabitClick(habit.id)}
                    title={`View ${habit.name}`}
                  >
                    <span className="archived-habit-icon">{habit.icon}</span>
                    <span className="archived-habit-name">{habit.name}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default HabitList;