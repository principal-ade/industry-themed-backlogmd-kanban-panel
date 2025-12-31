import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import type { Milestone, MilestoneCreateInput, MilestoneUpdateInput } from '@backlog-md/core';

interface MilestoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (input: MilestoneCreateInput | MilestoneUpdateInput) => Promise<void>;
  milestone?: Milestone; // If provided, we're editing; otherwise, creating
}

/**
 * Modal for creating or editing a milestone
 */
export const MilestoneModal: React.FC<MilestoneModalProps> = ({
  isOpen,
  onClose,
  onSave,
  milestone,
}) => {
  const { theme } = useTheme();
  const isEditing = !!milestone;

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens or milestone changes
  useEffect(() => {
    if (isOpen) {
      if (milestone) {
        setTitle(milestone.title || '');
        setDescription(milestone.description || '');
      } else {
        setTitle('');
        setDescription('');
      }
      setError(null);
    }
  }, [isOpen, milestone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (isEditing) {
        // Update existing milestone
        const input: MilestoneUpdateInput = {
          title: title.trim(),
          description: description.trim() || undefined,
        };
        await onSave(input);
      } else {
        // Create new milestone
        const input: MilestoneCreateInput = {
          title: title.trim(),
          description: description.trim() || undefined,
        };
        await onSave(input);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save milestone');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '500px',
          maxHeight: '90vh',
          overflow: 'auto',
          backgroundColor: theme.colors.background,
          borderRadius: theme.radii[3],
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: theme.fontSizes[4],
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            {isEditing ? 'Edit Milestone' : 'New Milestone'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radii[1],
              color: theme.colors.textMuted,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Title */}
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: theme.fontSizes[1],
                  fontWeight: 500,
                  color: theme.colors.text,
                }}
              >
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter milestone title"
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: theme.fontSizes[2],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radii[2],
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Description */}
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: theme.fontSizes[1],
                  fontWeight: 500,
                  color: theme.colors.text,
                }}
              >
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter milestone description (markdown supported)"
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: theme.fontSizes[2],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radii[2],
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: theme.fonts.body,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Error message */}
            {error && (
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: `${theme.colors.error}15`,
                  border: `1px solid ${theme.colors.error}`,
                  borderRadius: theme.radii[2],
                  color: theme.colors.error,
                  fontSize: theme.fontSizes[1],
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '16px 20px',
              borderTop: `1px solid ${theme.colors.border}`,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              style={{
                padding: '10px 20px',
                fontSize: theme.fontSizes[2],
                fontWeight: 500,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radii[2],
                backgroundColor: 'transparent',
                color: theme.colors.text,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                fontSize: theme.fontSizes[2],
                fontWeight: 500,
                border: 'none',
                borderRadius: theme.radii[2],
                backgroundColor: theme.colors.primary,
                color: theme.colors.textOnPrimary,
                cursor: isSaving ? 'wait' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              {isEditing ? 'Save Changes' : 'Create Milestone'}
            </button>
          </div>
        </form>
      </div>

      {/* Keyframe animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  // Render in portal to avoid layout issues
  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
};
