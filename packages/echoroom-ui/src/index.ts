/**
 * @echoroom/ui — Public API
 *
 * Import via: `import { Button, tokens, ThemeProviderUI } from "@echoroom/ui"`
 * Tree-shakable: import only what you need.
 */

/* ── Tokens (design foundations) ──────────────────────────────── */
export {
  tokens,
  colors,
  fonts,
  space,
  radius,
  shadows,
  motion,
  breakpoints,
  zIndex,
} from "./tokens";
export type { Tokens, ColorKey, FontSizeKey, SpacingKey, RadiusKey, ShadowKey } from "./tokens";

/* ── Themes ───────────────────────────────────────────────────── */
export { lightTheme, darkTheme, ThemeProviderUI, useThemeUI } from "./themes";
export type { Theme } from "./themes";

/* ── Utils ────────────────────────────────────────────────────── */
export { cn, useFocusTrap } from "./utils";

/* ── Atoms ────────────────────────────────────────────────────── */
export { Alert, AlertDescription, AlertTitle } from "./atoms/alert";
export type { AlertProps } from "./atoms/alert";
export { Avatar, AvatarFallback, AvatarImage } from "./atoms/avatar";
export type { AvatarProps } from "./atoms/avatar";
export { Badge, badgeVariants } from "./atoms/badge";
export type { BadgeProps } from "./atoms/badge";
export { Button, buttonVariants } from "./atoms/button";
export type { ButtonProps } from "./atoms/button";
export { Checkbox } from "./atoms/checkbox";
export type { CheckboxProps } from "./atoms/checkbox";
export { Input } from "./atoms/input";
export type { InputProps } from "./atoms/input";
export { SegmentedControl } from "./atoms/segmented-control";
export type { SegmentedOption } from "./atoms/segmented-control";
export { Skeleton } from "./atoms/skeleton";
export { Textarea } from "./atoms/textarea";
export type { TextareaProps } from "./atoms/textarea";
export { Tooltip } from "./atoms/tooltip";
export type { TooltipProps } from "./atoms/tooltip";

/* ── Molecules ────────────────────────────────────────────────── */
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./molecules/card";
export { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./molecules/dialog";
export { ThemeToggle } from "./molecules/ThemeToggle";
export { Toast, Toaster, ToastProvider, toast, useToast } from "./molecules/toast";
export type { ToastProps } from "./molecules/toast";

/* ── Organisms ────────────────────────────────────────────────── */
export { EmptyState } from "./organisms/EmptyState";
export type { EmptyStateProps } from "./organisms/EmptyState";
export { ConfirmDialog } from "./organisms/ConfirmDialog";
export type { ConfirmDialogProps } from "./organisms/ConfirmDialog";
export { Breadcrumbs } from "./organisms/Breadcrumbs";
export type { BreadcrumbsProps, BreadcrumbItem } from "./organisms/Breadcrumbs";
export { FormField } from "./organisms/FormField";
export type { FormFieldProps } from "./organisms/FormField";
export { PageHeader } from "./organisms/PageHeader";
export type { PageHeaderProps } from "./organisms/PageHeader";
