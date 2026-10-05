import { useState } from 'react';
import ActionMenu from './ActionMenu';
import './ArchivedHabitList.css';

function ArchivedHabitList({ habits, onHabitClick, onEdit, onUnarchive, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);

  const archivedHabits = habits
    .filter(h => h.archived)
    .sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));

  if (archivedHabits.length === 0) {
    return null;
  }

  const handleDelete = (habit) => {
    if (window.confirm(`Delete "${habit.name}"? This will permanently delete the habit and all its history. This cannot be undone.`)) {
      onDelete(habit.id);
    }
  };

  return (
    <div className="archived-list">
      <button 
        className="archived-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="archived-arrow">{expanded ? '▼' : '▶'}</span>
        <span>Archived ({archivedHabits.length})</span>
      </button>

      {expanded && (
        <div className="archived-items">
          {archivedHabits.map((habit) => (
            <div key={habit.id} className="archived-habit-row">
              <div className="archived-menu-wrapper">
                <button 
                  className="menu-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(menuOpenId === habit.id ? null : habit.id);
                  }}
                  title="Actions"
                >
                  ≡
                </button>
                <ActionMenu
                  isOpen={menuOpenId === habit.id}
                  onClose={() => setMenuOpenId(null)}
                  onEdit={() => onEdit(habit)}
                  onUnarchive={() => onUnarchive(habit.id)}
                  onDelete={() => handleDelete(habit)}
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
  );
}

export default ArchivedHabitList;