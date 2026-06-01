import { useEffect, useRef } from 'react';
import './ActionMenu.css';

function ActionMenu({ isOpen, onClose, onEdit, onArchive, onUnarchive, onDelete, isArchived = false }) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAction = (action) => {
    action();
    onClose();
  };

  return (
    <div className="action-menu" ref={menuRef}>
      <button 
        className="action-menu-item"
        onClick={() => handleAction(onEdit)}
      >
        <span className="action-icon">✏️</span>
        <span>Edit</span>
      </button>
      
      {isArchived ? (
        <button 
          className="action-menu-item"
          onClick={() => handleAction(onUnarchive)}
        >
          <span className="action-icon">📂</span>
          <span>Unarchive</span>
        </button>
      ) : (
        <button 
          className="action-menu-item"
          onClick={() => handleAction(onArchive)}
        >
          <span className="action-icon">📦</span>
          <span>Archive</span>
        </button>
      )}
      
      <button 
        className="action-menu-item action-menu-delete"
        onClick={() => handleAction(onDelete)}
      >
        <span className="action-icon">🗑️</span>
        <span>Delete</span>
      </button>
    </div>
  );
}

export default ActionMenu;