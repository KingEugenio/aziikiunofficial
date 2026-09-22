/**
 * Mobile-optimized Workspace Designer
 * - Shows as button on mobile/tablet
 * - Opens as full-screen modal
 * - All designer controls accessible without scrolling the page
 */

import React, { useState } from 'react';
import { Palette } from '@phosphor-icons/react';
import MobileModal from './MobileModal';
import { useResponsive } from '../hooks/useResponsive';
import PersonalWorkspace from './PersonalWorkspace';

interface WorkspaceDesignerModalProps {
  businessId: string;
  userId: string;
}

export function WorkspaceDesignerModal({
  businessId,
  userId,
}: WorkspaceDesignerModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { isMobile, isTablet } = useResponsive();

  // On mobile/tablet: show as modal
  if (isMobile || isTablet) {
    return (
      <>
        {/* Button to open modal */}
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all"
        >
          <Palette className="w-5 h-5" />
          Design Workspace
        </button>

        {/* Modal with full workspace designer */}
        <MobileModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Workspace Designer"
        >
          <PersonalWorkspace businessId={businessId} userId={userId} />
        </MobileModal>
      </>
    );
  }

  // Desktop: render inline (existing behavior)
  return <PersonalWorkspace businessId={businessId} userId={userId} />;
}

export default WorkspaceDesignerModal;
