import { useState, useEffect } from 'react';
import './HabitModal.css';

const EMOJI_OPTIONS = [
  '💪', '📚', '🧘', '🏃', '🎯', '✍️', 
  '🎨', '💻', '🍎', '💤', '🎵', '🌱',
  '⭐', '🔥', '💡', '🚀', '🧠', '☕'
];

// Helper function to check if string contains emoji
const isEmoji = (str) => {
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  return emojiRegex.test(str);
};

function HabitModal({ isOpen, onClose, onSave, onDelete, habit = null }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('⭐');
  const [customEmoji, setCustomEmoji] = useState('');
  const [customEmojiError, setCustomEmojiError] = useState(false);

  // Update form when habit changes
  useEffect(() => {
    if (habit) {
      setName(habit.name);
      setIcon(habit.icon);
      
      // If the icon is not in the default options, it's a custom emoji
      if (!EMOJI_OPTIONS.includes(habit.icon)) {
        setCustomEmoji(habit.icon);
      } else {
        setCustomEmoji('');
      }
    } else {
      setName('');
      setIcon('⭐');
      setCustomEmoji('');
    }
    setCustomEmojiError(false);
  }, [habit, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('Please enter a habit name');
      return;
    }

    if (!icon) {
      alert('Please select an icon');
      return;
    }

    if (!isEmoji(icon)) {
      alert('Icon must be an emoji');
      return;
    }

    onSave({ name: name.trim(), icon });
    onClose();
    
    // Reset form
    setName('');
    setIcon('⭐');
    setCustomEmoji('');
    setCustomEmojiError(false);
  };

  const handleDelete = () => {
    if (window.confirm(`Delete "${habit.name}"? This cannot be undone.`)) {
      onDelete(habit.id);
      onClose();
    }
  };

  const handleCustomEmojiChange = (e) => {
    const value = e.target.value;
    setCustomEmoji(value);
    
    if (value.trim()) {
      if (isEmoji(value.trim())) {
        setIcon(value.trim());
        setCustomEmojiError(false);
      } else {
        setCustomEmojiError(true);
      }
    } else {
      setCustomEmojiError(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{habit ? 'Edit Habit' : 'New Habit'}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Morning Exercise"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label>Icon</label>
            <div className="emoji-grid">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`emoji-btn ${icon === emoji ? 'selected' : ''}`}
                  onClick={() => {
                    setIcon(emoji);
                    setCustomEmoji('');
                    setCustomEmojiError(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
              
              {/* Custom emoji as last grid item */}
              <input
                type="text"
                className={`emoji-btn custom-emoji-btn ${customEmojiError ? 'error' : ''} ${customEmoji && !EMOJI_OPTIONS.includes(icon) ? 'selected' : ''}`}
                value={customEmoji}
                onChange={handleCustomEmojiChange}
                placeholder="+"
                maxLength="4"
                title="Enter custom emoji"
              />
            </div>
            {customEmojiError && (
              <span className="error-hint">Must be an emoji</span>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {habit ? 'Save' : 'Create'}
            </button>
          </div>

          {/* Delete button at bottom - only shown when editing */}
          {habit && (
            <div className="modal-delete-section">
              <button 
                type="button" 
                className="btn-delete-bottom" 
                onClick={handleDelete}
              >
                Delete Habit
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default HabitModal;