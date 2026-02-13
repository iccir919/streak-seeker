import { useState, useEffect } from 'react';
import HabitList from './components/HabitList';
import HabitModal from './components/HabitModal';
import HabitDetailView from './components/HabitDetailView';
import OverallView from './components/OverallView';
import { getHabits, toggleCompletion, addHabit, updateHabit, deleteHabit, reorderHabits } from './utils/storage';
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

  const handleHabitClick = (habitId) => {
    setSelectedHabitId(habitId);
    setView('detail');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingHabit(null);
  };

  const handleNavigatePrevious = () => {
    setDateOffset(prev => prev - 12);
  };

  const handleNavigateNext = () => {
    setDateOffset(prev => Math.min(prev + 12, 0));
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
          {habits.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔥</div>
              <h2>No habits yet</h2>
              <p>Add your first habit to start building streaks!</p>
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

        {habits.length > 0 && (
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
          habit={editingHabit}
        />
      </div>
    );
  }
}

export default App;