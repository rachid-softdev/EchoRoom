"use client";

import * as React from "react";
import { cn } from "../utils/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn("flex gap-1 p-1 rounded-xl bg-muted border border-border w-fit", className)}
      role="radiogroup"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5",
            value === opt.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.icon && <span className="shrink-0">{opt.icon}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
