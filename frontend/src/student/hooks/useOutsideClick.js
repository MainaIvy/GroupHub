import { useEffect, useRef } from 'react';

// Closes popovers when the user clicks outside any [data-popover-root] or presses Escape.
export default function useOutsideClick(active, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active) return undefined;
    const onPointerDown = (event) => {
      if (!event.target.closest?.('[data-popover-root]')) closeRef.current();
    };
    const onKeyDown = (event) => { if (event.key === 'Escape') closeRef.current(); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [active]);
}
