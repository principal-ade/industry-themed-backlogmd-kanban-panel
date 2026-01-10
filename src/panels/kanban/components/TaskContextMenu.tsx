import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Task } from '@backlog-md/core';

export interface TaskContextMenuProps {
  task: Task;
  position: { x: number; y: number };
  onClose: () => void;
  onCopyPath: (task: Task) => void;
}

export const TaskContextMenu: React.FC<TaskContextMenuProps> = ({
  task,
  position,
  onClose,
  onCopyPath,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleCopyPath = () => {
    onCopyPath(task);
    onClose();
  };

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: position.y,
    left: position.x,
    backgroundColor: '#ffffff',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    padding: '4px 0',
    minWidth: '180px',
    zIndex: 10000,
  };

  const menuItemStyle: React.CSSProperties = {
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#333',
    transition: 'background-color 0.15s ease',
  };

  const menuItemHoverStyle: React.CSSProperties = {
    ...menuItemStyle,
    backgroundColor: '#f5f5f5',
  };

  const [isHovering, setIsHovering] = React.useState(false);

  return createPortal(
    <div ref={menuRef} style={menuStyle}>
      <div
        style={isHovering ? menuItemHoverStyle : menuItemStyle}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={handleCopyPath}
      >
        Copy Task Path
      </div>
    </div>,
    document.body
  );
};
