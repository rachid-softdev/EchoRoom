"use client";

import * as React from "react";
import { cn } from "../utils/cn";

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Page title. */
  title: React.ReactNode;
  /** Optional subtitle shown under the title. */
  description?: React.ReactNode;
  /** Action slot (e.g. buttons) aligned to the right on larger screens. */
  actions?: React.ReactNode;
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ className, title, description, actions, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      {...props}
    >
      <div className="space-y-1">
        <h1 className="text-fluid-section font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  ),
);
PageHeader.displayName = "PageHeader";

export { PageHeader };
