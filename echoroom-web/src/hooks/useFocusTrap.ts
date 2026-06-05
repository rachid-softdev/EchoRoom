import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  isActive: boolean,
) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;
    previousFocusRef.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    // Delay focus to next tick to ensure the dialog is fully rendered
    requestAnimationFrame(() => {
      firstFocusable?.focus();
    });

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab" || !container) return;
      const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length === 0) return;

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleTab);
    return () => {
      document.removeEventListener("keydown", handleTab);
      previousFocusRef.current?.focus();
    };
  }, [isActive, containerRef]);
}
