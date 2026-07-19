"use client";

import * as React from "react";
import { cn } from "../utils/cn";

export interface BreadcrumbItem {
  /** Visible label. */
  label: React.ReactNode;
  /** Optional href — when omitted the item is rendered as plain text. */
  href?: string;
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  /** Ordered trail of crumbs. The last item is marked as the current page. */
  items: BreadcrumbItem[];
  /** Separator between items. Defaults to "/". */
  separator?: React.ReactNode;
}

const Breadcrumbs = React.forwardRef<HTMLElement, BreadcrumbsProps>(
  ({ className, items, separator = "/", ...props }, ref) => (
    <nav
      ref={ref}
      aria-label="Fil d'ariane"
      className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", className)}
      {...props}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {item.href && !isLast ? (
              <a href={item.href} className="transition-colors hover:text-foreground">
                {item.label}
              </a>
            ) : (
              <span
                className={cn(isLast && "font-medium text-foreground")}
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
            {!isLast ? (
              <span aria-hidden className="opacity-50">
                {separator}
              </span>
            ) : null}
          </React.Fragment>
        );
      })}
    </nav>
  ),
);
Breadcrumbs.displayName = "Breadcrumbs";

export { Breadcrumbs };
