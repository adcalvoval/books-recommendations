import React, { useState, useRef, useEffect } from 'react';

interface EditableTextProps {
  value: string;
  onSave: (newValue: string) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  placeholder?: string;
  label: string;
  multiline?: boolean;
  maxLength?: number;
  className?: string;
}

const EditableText: React.FC<EditableTextProps> = ({
  value,
  onSave,
  onDelete,
  placeholder = 'Click to add...',
  label,
  multiline = true,
  maxLength = 1000,
  className = ''
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      if (multiline && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(editValue.length, editValue.length);
      } else if (!multiline && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(editValue.length, editValue.length);
      }
    }
  }, [isEditing, multiline, editValue.length]);

  const handleSave = async () => {
    if (editValue.trim() === value.trim()) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue.trim());
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving text:', error);
      // Reset to original value on error
      setEditValue(value);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!onDelete || !value.trim()) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete this ${label.toLowerCase()}? This action cannot be undone.`);
    if (!confirmed) return;
    
    setIsSaving(true);
    try {
      await onDelete();
      setIsEditing(false);
    } catch (error) {
      console.error('Error deleting text:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave();
    }
  };

  if (isEditing) {
    return (
      <div className={`editable-text editing ${className}`}>
        <div className="editable-text-header">
          <h5>{label}:</h5>
          <div className="editable-text-actions">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn-save"
              title="Save (Ctrl+Enter)"
              aria-label={isSaving ? 'Saving' : 'Save'}
            >
              {isSaving ? '⏳' : '✓'}
            </button>
            {onDelete && value.trim() && (
              <button
                onClick={handleDelete}
                disabled={isSaving}
                className="btn-delete"
                title="Delete completely"
                aria-label={`Delete ${label.toLowerCase()}`}
              >
                🗑️
              </button>
            )}
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="btn-cancel"
              title="Cancel (Esc)"
              aria-label="Cancel"
            >
              ✕
            </button>
          </div>
        </div>
        {multiline ? (
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            maxLength={maxLength}
            className="editable-textarea"
            rows={4}
            disabled={isSaving}
          />
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            maxLength={maxLength}
            className="editable-input"
            disabled={isSaving}
          />
        )}
        <div className="editable-text-footer">
          <span className="char-count">{editValue.length}/{maxLength}</span>
          <span className="help-text">
            Ctrl+Enter to save, Esc to cancel
            {onDelete && value.trim() && ', 🗑️ to delete'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`editable-text ${className}`}>
      <div className="editable-text-header">
        <h5>{label}:</h5>
        <div className="editable-text-actions">
          <button
            onClick={() => setIsEditing(true)}
            className="btn-edit"
            title={`Edit ${label.toLowerCase()}`}
            aria-label={`Edit ${label.toLowerCase()}`}
          >
            ✏️
          </button>
          {onDelete && value.trim() && (
            <button
              onClick={handleDelete}
              disabled={isSaving}
              className="btn-delete-view"
              title={`Delete ${label.toLowerCase()}`}
              aria-label={`Delete ${label.toLowerCase()}`}
            >
              🗑️
            </button>
          )}
        </div>
      </div>
      <div
        className="editable-text-content"
        onClick={() => setIsEditing(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsEditing(true);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`${value ? 'Edit' : 'Add'} ${label.toLowerCase()}`}
      >
        {value ? (
          <p>{value}</p>
        ) : (
          <p className="editable-text-placeholder">{placeholder}</p>
        )}
      </div>
    </div>
  );
};

export default EditableText;