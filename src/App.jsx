import { useState, useEffect } from 'react';
import HabitList from './components/HabitList';
import HabitModal from './components/HabitModal';
import HabitDetailView from './components/HabitDetailView';
import OverallView from './components/OverallView';
import { 
  getHabits, 
  toggleCompletion, 
  addHabit, 
  updateHabit, 
  deleteHabit, 
  reorderHabits,
  archiveHabit,
  unarchiveHabit
} from './utils/storage';
import './App.css';

function App() {
  const [view, setView] = useState('main');
  const [habits, setHabits] = useState([]);
  const [selectedHabitId, setSelectedHabitId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [dateOffset, setDateOffset] = useState(0);

  useEffect(() => {
    loadHabits();
  }, []);

  const loadHabits = () => {
    const loadedHabits = getHabits();
    setHabits(loadedHabits);
  };

  const handleToggle = (habitId, date) => {
    toggleCompletion(habitId, date);
    loadHabits();
  };

  const handleAddHabit = () => {
    setEditingHabit(null);
    setShowModal(true);
  };

  const handleEditHabit = (habit) => {
    setEditingHabit(habit);
    setShowModal(true);
  };

  const handleSaveHabit = (habitData) => {
    if (editingHabit) {
      updateHabit(editingHabit.id, habitData);
    } else {
      addHabit(habitData);
    }
    loadHabits();
    setEditingHabit(null);
  };

  const handleDeleteHabit = (habitId) => {
    deleteHabit(habitId);
    loadHabits();
    setView('main');
  };

  const handleArchiveHabit = (habitId) => {
    archiveHabit(habitId);
    loadHabits();
    setView('main');
  };

  const handleUnarchiveHabit = (habitId) => {
    unarchiveHabit(habitId);
    loadHabits();
    setView('main');
  };

  const handleHabitClick = (habitId) => {
    setSelectedHabitId(habitId);
    setView('detail');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingHabit(null);
  };

  const handleNavigatePrevious = () => {
    setDateOffset(prev => prev - 10);
  };

  const handleNavigateNext = () => {
    setDateOffset(prev => Math.min(prev + 10, 0));
  };

  const handleBackToMain = () => {
    setView('main');
    setSelectedHabitId(null);
  };

  const handleReorder = (oldIndex, newIndex) => {
    const newHabits = [...habits];
    const [movedHabit] = newHabits.splice(oldIndex, 1);
    newHabits.splice(newIndex, 0, movedHabit);

    setHabits(newHabits);

    const habitIds = newHabits.map(h => h.id);
    reorderHabits(habitIds);
  };

  const selectedHabit = habits.find(h => h.id === selectedHabitId);
  const activeHabits = habits.filter(h => !h.archived);

  // Main view
  if (view === 'main') {
    return (
      <div className="app">
        <div className="header">
          <div className="logo">
            <span>🔥</span>
            <span>Streak Seeker</span>
          </div>
          <button className="btn-add" onClick={handleAddHabit}>
            + Add Habit
          </button>
        </div>

        <div className="main">
          {activeHabits.length === 0 && habits.filter(h => h.archived).length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔥</div>
              <h2>Ready to build a streak?</h2>
              
              <div className="empty-state-examples">
                <div className="example-label">Popular starts:</div>
                <div className="example-habits">
                  <div className="example-habit">
                    <span className="example-icon">💪</span>
                    <span className="example-name">Exercise</span>
                  </div>
                  <div className="example-habit">
                    <span className="example-icon">📚</span>
                    <span className="example-name">Read</span>
                  </div>
                  <div className="example-habit">
                    <span className="example-icon">🧘</span>
                    <span className="example-name">Meditate</span>
                  </div>
                </div>
              </div>

              <button className="btn-add-first" onClick={handleAddHabit}>
                + Add Your First Habit
              </button>

              <div className="empty-state-tip">
                💡 Start with 2-3 habits
              </div>
            </div>
          ) : (
            <HabitList
              habits={habits}
              onToggle={handleToggle}
              onHabitClick={handleHabitClick}
              onEdit={handleEditHabit}
              dateOffset={dateOffset}
              onNavigatePrevious={handleNavigatePrevious}
              onNavigateNext={handleNavigateNext}
              onReorder={handleReorder}
            />
          )}
        </div>

        {activeHabits.length > 0 && (
          <div className="footer">
            <button 
              className="btn-heatmap"
              onClick={() => setView('overall')}
            >
              📊 Overall Stats
            </button>
          </div>
        )}

        <HabitModal
          isOpen={showModal}
          onClose={handleCloseModal}
          onSave={handleSaveHabit}
          onDelete={handleDeleteHabit}
          onArchive={handleArchiveHabit}
          onUnarchive={handleUnarchiveHabit}
          habit={editingHabit}
        />
      </div>
    );
  }

  // Overall view
  if (view === 'overall') {
    return (
      <div className="app">
        <OverallView onBack={handleBackToMain} />
      </div>
    );
  }

  // Detail view
  if (view === 'detail') {
    return (
      <div className="app">
        <HabitDetailView
          habit={selectedHabit}
          onBack={handleBackToMain}
          onEdit={handleEditHabit}
        />
        
        <HabitModal
          isOpen={showModal}
          onClose={handleCloseModal}
          onSave={handleSaveHabit}
          onDelete={handleDeleteHabit}
          onArchive={handleArchiveHabit}
          onUnarchive={handleUnarchiveHabit}
          habit={editingHabit}
        />
      </div>
    );
  }
}

export default App;