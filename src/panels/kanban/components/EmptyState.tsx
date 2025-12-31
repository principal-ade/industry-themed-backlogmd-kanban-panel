import React, { useState } from 'react';
import { ExternalLink, FileText, FolderPlus, Loader2, CheckCircle2 } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';

interface EmptyStateProps {
  message?: string;
  description?: string;
  showBacklogLink?: boolean;
  onInitialize?: () => Promise<void>;
  canInitialize?: boolean;
}

/**
 * EmptyState component displayed when no tasks are found
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  message = 'No Backlog.md project detected',
  description = 'This repository does not appear to use Backlog.md for task management.',
  showBacklogLink = true,
  onInitialize,
  canInitialize = false,
}) => {
  const { theme } = useTheme();
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [initSuccess, setInitSuccess] = useState(false);

  const handleInitialize = async () => {
    if (!onInitialize) return;
    setIsInitializing(true);
    setInitError(null);
    try {
      await onInitialize();
      setInitSuccess(true);
    } catch (err) {
      setInitError(err instanceof Error ? err.message : 'Failed to initialize');
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <>
      {/* Keyframe animation for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '48px 24px',
          textAlign: 'center',
          color: theme.colors.textMuted,
        }}
      >
      <FileText
        size={64}
        color={theme.colors.textMuted}
        style={{ marginBottom: '24px', opacity: 0.5 }}
      />

      <h3
        style={{
          fontSize: theme.fontSizes[4],
          fontWeight: 600,
          color: theme.colors.text,
          marginBottom: '12px',
        }}
      >
        {message}
      </h3>

      <p
        style={{
          fontSize: theme.fontSizes[2],
          color: theme.colors.textMuted,
          marginBottom: '32px',
          maxWidth: '480px',
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {canInitialize && onInitialize && (
          <button
            onClick={handleInitialize}
            disabled={isInitializing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              backgroundColor: theme.colors.primary,
              color: theme.colors.textOnPrimary,
              borderRadius: theme.radii[2],
              border: 'none',
              fontSize: theme.fontSizes[2],
              fontWeight: 500,
              cursor: isInitializing ? 'wait' : 'pointer',
              opacity: isInitializing ? 0.7 : 1,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isInitializing) e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              if (!isInitializing) e.currentTarget.style.opacity = '1';
            }}
          >
            {isInitializing ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Initializing...</span>
              </>
            ) : (
              <>
                <FolderPlus size={16} />
                <span>Initialize Backlog.md</span>
              </>
            )}
          </button>
        )}

        {showBacklogLink && (
          <a
            href="https://github.com/MrLesk/Backlog.md"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              backgroundColor: canInitialize ? 'transparent' : theme.colors.primary,
              color: canInitialize ? theme.colors.primary : theme.colors.textOnPrimary,
              border: canInitialize ? `1px solid ${theme.colors.primary}` : 'none',
              borderRadius: theme.radii[2],
              textDecoration: 'none',
              fontSize: theme.fontSizes[2],
              fontWeight: 500,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            <span>Learn about Backlog.md</span>
            <ExternalLink size={16} />
          </a>
        )}
      </div>

      {/* Success message */}
      {initSuccess && (
        <div
          style={{
            marginTop: '16px',
            padding: '16px 20px',
            backgroundColor: `${theme.colors.success || '#22c55e'}15`,
            border: `1px solid ${theme.colors.success || '#22c55e'}`,
            borderRadius: theme.radii[2],
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            maxWidth: '480px',
          }}
        >
          <CheckCircle2 size={20} color={theme.colors.success || '#22c55e'} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ textAlign: 'left' }}>
            <p style={{ margin: 0, fontWeight: 600, color: theme.colors.text, fontSize: theme.fontSizes[2] }}>
              Backlog.md initialized!
            </p>
            <p style={{ margin: '8px 0 0', color: theme.colors.textSecondary, fontSize: theme.fontSizes[1], lineHeight: 1.5 }}>
              Created <code style={{ padding: '2px 6px', backgroundColor: theme.colors.surface, borderRadius: '4px', fontFamily: theme.fonts.monospace, fontSize: '0.9em' }}>backlog/config.yml</code>.
              Refresh the panel or reopen the repository to see your kanban board.
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {initError && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            backgroundColor: `${theme.colors.error}15`,
            border: `1px solid ${theme.colors.error}`,
            borderRadius: theme.radii[2],
            color: theme.colors.error,
            fontSize: theme.fontSizes[1],
          }}
        >
          {initError}
        </div>
      )}

      {!initSuccess && <div
        style={{
          marginTop: '48px',
          padding: '16px',
          backgroundColor: `${theme.colors.primary}10`,
          borderRadius: theme.radii[2],
          maxWidth: '560px',
        }}
      >
        <p
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: theme.colors.text }}>
            Want to use this panel?
          </strong>{' '}
          Initialize Backlog.md in your repository by running{' '}
          <code
            style={{
              padding: '2px 6px',
              backgroundColor: theme.colors.surface,
              borderRadius: '4px',
              fontFamily: theme.fonts.monospace,
              fontSize: '0.9em',
            }}
          >
            backlog init
          </code>{' '}
          in your project directory.
        </p>
      </div>}
    </div>
    </>
  );
};
