/**
 * Hook to detect viewport size and return responsive breakpoint info
 * Useful for conditionally rendering mobile vs desktop UI
 */

import { useState, useEffect } from 'react';

export function useResponsive() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [windowWidth, setWindowWidth] = useState(0);

  useEffect(() => {
    // Set initial values
    const handleResize = () => {
      const width = window.innerWidth;
      setWindowWidth(width);
      
      // Tailwind breakpoints
      setIsMobile(width < 768);      // < md
      setIsTablet(width >= 768 && width < 1024);  // md to < lg
      setIsDesktop(width >= 1024);    // >= lg
    };

    // Initial call
    handleResize();

    // Add listener
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    isMobile,
    isTablet,
    isDesktop,
    windowWidth,
  };
}
