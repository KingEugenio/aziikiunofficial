import { useEffect } from "react";

/**
 * Sets document.title while this hook is mounted/updated, restoring the
 * previous title on unmount. Aziiki has no client-side router (see
 * main.tsx), so this is the only mechanism giving each tab/screen its own
 * browser-tab title instead of a single static one from index.html.
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
