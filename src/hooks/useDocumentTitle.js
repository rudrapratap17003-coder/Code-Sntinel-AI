import { useEffect } from 'react';

/**
 * Custom hook to manage the document title dynamically.
 * @param {string} title
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    const originalTitle = document.title;
    if (title) {
      document.title = `${title} — CodeSentinel AI`;
    }
    return () => {
      document.title = originalTitle;
    };
  }, [title]);
}

export default useDocumentTitle;
