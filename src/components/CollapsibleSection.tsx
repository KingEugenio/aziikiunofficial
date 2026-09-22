/**
 * Collapsible section that behaves differently on mobile vs desktop:
 * - Desktop: Inline collapsible accordion
 * - Mobile: Opens as full-screen modal on click
 * 
 * Usage:
 * <CollapsibleSection title="Settings" icon={Gear}>
 *   <YourContent />
 * </CollapsibleSection>
 */

import React, { ReactNode, useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import MobileModal from './MobileModal';
import { useResponsive } from '../hooks/useResponsive';

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  onOpenChange,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { isMobile, isTablet } = useResponsive();

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onOpenChange?.(newState);
  };

  // On mobile/tablet: show as modal
  if (isMobile || isTablet) {
    return (
      <>
        {/* Header Button */}
        <button
          onClick={handleToggle}
          aria-expanded={isOpen}
          aria-label={`${isOpen ? 'Close' : 'Open'} ${title}`}
          className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          <div className="flex items-center gap-3">
            {Icon && <Icon className="w-5 h-5 text-slate-600" />}
            <span className="font-semibold text-slate-900">{title}</span>
          </div>
          <CaretDown
            className={`w-5 h-5 text-slate-600 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Modal on Mobile */}
        <MobileModal isOpen={isOpen} onClose={() => setIsOpen(false)} title={title}>
          <div className="space-y-4">
            {children}
          </div>
        </MobileModal>
      </>
    );
  }

  // Desktop: inline collapsible accordion
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-label={`${isOpen ? 'Close' : 'Open'} ${title}`}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-5 h-5 text-slate-600" />}
          <span className="font-semibold text-slate-900">{title}</span>
        </div>
        <CaretDown
          className={`w-5 h-5 text-slate-600 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Content - inline on desktop */}
      {isOpen && (
        <div className="border-t border-slate-200 p-4 bg-white">
          {children}
        </div>
      )}
    </div>
  );
}

export default CollapsibleSection;
