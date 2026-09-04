import * as React from "react";
import { vi } from "vitest";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type MockComponent = React.ForwardRefExoticComponent<any> | React.FC<any>;

/**
 * Creates a lightweight stub component that renders a native HTML element
 * with a `data-testid` attribute for easy querying.
 *
 * Uses `React.forwardRef` so ref forwarding behaves like the real component.
 * Filters out React-specific internal props to avoid console warnings.
 *
 * @param displayName - Component name used for `displayName` and `data-testid`.
 * @param defaultTag  - The HTML tag to render (default: `"div"`).
 */
function createComponentStub(displayName: string, defaultTag = "div"): MockComponent {
  const Stub = React.forwardRef<any, any>(({ children, ...props }, ref) => {
    // Strip out shadcn/cn-specific and React-internal props
    const { className, style, ...rest } = props;
    const htmlProps = Object.fromEntries(
      Object.entries(rest).filter(([key]) => !key.startsWith("__")),
    );
    return React.createElement(
      defaultTag,
      {
        ...htmlProps,
        ref,
        className,
        style,
        "data-testid": displayName,
      },
      children,
    );
  });
  Stub.displayName = displayName;
  return Stub;
}

// ---------------------------------------------------------------------------
// Pre-built stubs matching `@/components/ui` barrel exports
// ---------------------------------------------------------------------------

/**
 * Pre-built stubs for every component exported from `@/components/ui`.
 *
 * Each stub renders a native HTML element (button, input, span, div, etc.)
 * with a `data-testid` matching the component name.  The `toast` export is
 * a plain `vi.fn()` spy.
 *
 * Usage — spread into a `vi.mock()` factory:
 *
 * ```ts
 * vi.mock("@echoroom/ui", () => UIComponentStubs);
 * ```
 *
 * To override a specific component for a single test, use `createUIMock`:
 *
 * ```ts
 * vi.mock("@echoroom/ui", () => createUIMock({
 *   Button: ({ children }) => <button data-testid="custom-btn">{children}</button>,
 * }));
 * ```
 */
export const UIComponentStubs = {
  Button: createComponentStub("Button", "button"),
  Input: createComponentStub("Input", "input"),
  Badge: createComponentStub("Badge", "span"),
  Card: createComponentStub("Card"),
  CardHeader: createComponentStub("CardHeader"),
  CardTitle: createComponentStub("CardTitle", "h3"),
  CardDescription: createComponentStub("CardDescription", "p"),
  CardContent: createComponentStub("CardContent"),
  CardFooter: createComponentStub("CardFooter"),
  Skeleton: createComponentStub("Skeleton"),
  Alert: createComponentStub("Alert", "div"),
  AlertTitle: createComponentStub("AlertTitle", "h5"),
  AlertDescription: createComponentStub("AlertDescription", "p"),
  Avatar: createComponentStub("Avatar"),
  AvatarImage: createComponentStub("AvatarImage", "img"),
  AvatarFallback: createComponentStub("AvatarFallback"),
  Separator: createComponentStub("Separator", "hr"),
  toast: vi.fn(),
} as const;

// ---------------------------------------------------------------------------
// Helper: build a custom UI mock with overrides
// ---------------------------------------------------------------------------

/**
 * Creates a UI mock object that merges `UIComponentStubs` with any
 * component overrides you provide.
 *
 * Useful when a single test file needs to customise a specific stub while
 * keeping the defaults for everything else.
 *
 * @param overrides - A map of component names to their substitute stubs.
 *
 * @example
 *   vi.mock("@echoroom/ui", () => createUIMock({
 *     Button: ({ children }) => <button data-testid="my-btn">{children}</button>,
 *   }));
 */
export function createUIMock(overrides?: Record<string, any>) {
  return { ...UIComponentStubs, ...overrides };
}
