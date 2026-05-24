import { useState, useEffect } from 'react';
import './HabitModal.css';

const EMOJI_OPTIONS = [
  '💪', '📚', '🧘', '🏃', '🎯', '✍️', 
  '🎨', '💻', '🍎', '💤', '🎵', '🌱',
  '⭐', '🔥', '💡', '🚀', '🧠'
];

// Edit mode: just show top 5 presets
const EDIT_EMOJI_PRESETS = ['💪', '📚', '🧘', '🏃', '🎯'];

const isEmoji = (str) => {
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  return emojiRegex.test(str);
};

function HabitModal({ isOpen, onClose, onSave, onDelete, onArchive, onUnarchive, habit = null }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('⭐');
  const [customEmoji, setCustomEmoji] = useState('');
  const [customEmojiError, setCustomEmojiError] = useState(false);

  useEffect(() => {
    if (habit) {
      setName(habit.name);
      setIcon(habit.icon);
      
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

    if (!icon || !isEmoji(icon)) {
      alert('Icon must be an emoji');
      return;
    }

    onSave({ name: name.trim(), icon });
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm(`Delete "${habit.name}"? This will permanently delete the habit and all its history. This cannot be undone.`)) {
      onDelete(habit.id);
      onClose();
    }
  };

  const handleArchive = () => {
    onArchive(habit.id);
    onClose();
  };

  const handleUnarchive = () => {
    onUnarchive(habit.id);
    onClose();
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

  const isArchived = habit?.archived;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {habit ? 'Edit Habit' : 'New Habit'}
            {isArchived && <span className="archived-badge">Archived</span>}
          </h2>
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
            
            {/* Edit mode: current display + 5 presets + custom */}
            {habit ? (
              <>
                <div className="current-icon-row">
                  <span className="current-icon-label">Current:</span>
                  <span className="current-icon-emoji">{icon}</span>
                </div>
                <div className="emoji-grid emoji-grid-edit">
                  {EDIT_EMOJI_PRESETS.map((emoji) => (
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
                  
                  <input
                    type="text"
                    className={`emoji-btn custom-emoji-btn ${customEmojiError ? 'error' : ''} ${customEmoji && !EDIT_EMOJI_PRESETS.includes(icon) ? 'selected' : ''}`}
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
              </>
            ) : (
              /* New habit: full picker */
              <>
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
              </>
            )}
          </div>

          <button type="submit" className="btn-primary-full">
            {habit ? 'Save' : 'Create Habit'}
          </button>

          {habit && (
            <div className="modal-secondary-actions">
              {isArchived ? (
                <button 
                  type="button" 
                  className="btn-archive"
                  onClick={handleUnarchive}
                >
                  Unarchive
                </button>
              ) : (
                <button 
                  type="button" 
                  className="btn-archive"
                  onClick={handleArchive}
                >
                  Archive
                </button>
              )}
              <button 
                type="button" 
                className="btn-delete-bottom" 
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default HabitModal;