"use client";

import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "../utils/cn";

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? `checkbox-${generatedId}`;
    return (
      <label htmlFor={inputId} className="flex items-start gap-3 cursor-pointer group">
        <span className="relative flex items-center justify-center shrink-0 mt-0.5">
          <input ref={ref} id={inputId} type="checkbox" className="peer sr-only" {...props} />
          <span
            className={cn(
              "w-5 h-5 rounded-md border-2 border-border bg-background relative flex items-center justify-center",
              "peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground",
              "peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
              "transition-colors",
              "group-hover:border-primary/50",
              className,
            )}
          >
            <Check className="w-3 h-3 opacity-0 peer-checked:opacity-100 transition-opacity" />
          </span>
        </span>
        {label && (
          <span className="text-sm text-muted-foreground peer-checked:text-foreground transition-colors">
            {label}
          </span>
        )}
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";

export type { CheckboxProps };
export { Checkbox };
