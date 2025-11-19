import React from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';

interface EmptyStateProps {
  message?: string;
  description?: string;
  showBacklogLink?: boolean;
}

/**
 * EmptyState component displayed when no tasks are found
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  message = 'No Backlog.md project detected',
  description = 'This repository does not appear to use Backlog.md for task management.',
  showBacklogLink = true,
}) => {
  const { theme } = useTheme();

  return (
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
            backgroundColor: theme.colors.primary,
            color: '#fff',
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

      <div
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
      </div>
    </div>
  );
};
