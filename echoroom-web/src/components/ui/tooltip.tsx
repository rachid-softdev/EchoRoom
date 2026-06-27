"use client";

import { useId, useState } from "react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}

/**
 * Lightweight CSS tooltip. Hover to reveal.
 * Accessible via aria-describedby on the trigger.
 */
export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const id = useId();
  const tooltipId = `tooltip-${id}`;

  const sideClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      className="relative inline-flex"
      role="button"
      tabIndex={0}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setIsVisible(false);
      }}
    >
      <div aria-describedby={tooltipId}>{children}</div>
      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`absolute z-50 ${sideClasses[side]} pointer-events-none`}
        >
          <div className="rounded-lg bg-foreground px-2.5 py-1.5 text-xs text-background shadow-lg whitespace-nowrap max-w-[220px] text-center leading-relaxed">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}
