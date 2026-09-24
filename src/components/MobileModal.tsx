/**
 * Full-screen modal optimized for mobile/tablet
 * Features:
 * - Full-screen overlay on mobile
 * - Swipe-down gesture to close
 * - Scrollable content area
 * - Safe area padding for notched devices
 */

import React, { ReactNode, useState, useRef, useEffect } from 'react';
import { X } from '@phosphor-icons/react';

interface MobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  showCloseButton?: boolean;
}

export function MobileModal({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = true,
}: MobileModalProps) {
  const [touchStart, setTouchStart] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle swipe-down gesture
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEnd = e.changedTouches[0].clientY;
    const diff = touchEnd - touchStart;

    // Swipe down more than 50px to close
    if (diff > 50) {
      onClose();
    }
  };

  // Prevent body scroll and handle Escape key when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = 'auto';
      };
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex flex-col" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      {/* Header */}
      <div
        className="bg-white border-b border-slate-200 flex items-center justify-between p-4 sticky top-0"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <h2 id="modal-title" className="text-lg font-bold text-slate-900">{title}</h2>
        {showCloseButton && (
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto bg-white"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="p-4">
          {children}
        </div>
      </div>

      {/* Swipe indicator (optional) */}
      <div className="bg-white border-t border-slate-200 flex justify-center p-2">
        <div className="w-12 h-1 bg-slate-300 rounded-full" />
      </div>
    </div>
  );
}

export default MobileModal;
