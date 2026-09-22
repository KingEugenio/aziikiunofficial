/**
 * Hook to detect viewport size and return responsive breakpoint info
 * Useful for conditionally rendering mobile vs desktop UI
 */

import { useState, useEffect } from 'react';

export function useResponsive() {
  // Initialize with correct values immediately
  const getBreakpoints = () => {
    if (typeof window === 'undefined') {
      return { isMobile: false, isTablet: false, isDesktop: true, windowWidth: 0 };
    }
    
    const width = window.innerWidth;
    return {
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024,
      windowWidth: width,
    };
  };

  const [state, setState] = useState(getBreakpoints());

  useEffect(() => {
    // Update on resize
    const handleResize = () => {
      setState(getBreakpoints());
    };

    // Set initial state (in case it changed before effect ran)
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return state;
}
