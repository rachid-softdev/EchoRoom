"use client";

import * as React from "react";
import { cn } from "../utils/cn";

export interface FormFieldProps {
  /** Field label. */
  label?: React.ReactNode;
  /** id of the control this label is associated with. */
  htmlFor?: string;
  /** Helper text shown when there is no error. */
  hint?: React.ReactNode;
  /** Error message. Takes precedence over `hint`. */
  error?: React.ReactNode;
  /** Shows a required marker next to the label. */
  required?: boolean;
  className?: string;
  /** The control(s) for this field. */
  children: React.ReactNode;
}

const FormField = ({ label, htmlFor, hint, error, required, className, children }: FormFieldProps) => (
  <div className={cn("space-y-1.5", className)}>
    {label ? (
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </label>
    ) : null}
    {children}
    {error ? (
      <p className="text-sm text-destructive">{error}</p>
    ) : hint ? (
      <p className="text-sm text-muted-foreground">{hint}</p>
    ) : null}
  </div>
);

export { FormField };
