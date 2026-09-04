"use client";

import { ConfirmDialog as ConfirmDialogUI } from "@echoroom/ui";

interface ConfirmDialogProps {
  /** Whether the dialog is visible */
  open: boolean;
  /** Callback to toggle dialog visibility */
  onOpenChange: (open: boolean) => void;
  /** Dialog title text */
  title: string;
  /** Dialog description body (string or rich content) */
  description: string | React.ReactNode;
  /** Label for the confirm button (default "Confirmer") */
  confirmLabel?: string;
  /** Label for the cancel button (default "Annuler") */
  cancelLabel?: string;
  /** Visual variant: "default" or "destructive" (default "default") */
  variant?: "default" | "destructive";
  /** Handler invoked when the user confirms */
  onConfirm: () => void;
  /** Whether the confirm action is in progress (shows spinner) */
  loading?: boolean;
  /** Whether the confirm button is disabled */
  confirmDisabled?: boolean;
}

/**
 * Confirmation dialog built on the shared @echoroom/ui ConfirmDialog organism.
 *
 * Unlike the generic organism, this web variant does NOT auto-close on confirm
 * (`closeOnConfirm={false}`) — the consumer controls visibility via `onOpenChange`,
 * which is required for the loading/`confirmDisabled` flows.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "default",
  onConfirm,
  loading = false,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  return (
    <ConfirmDialogUI
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      variant={variant}
      onConfirm={onConfirm}
      loading={loading}
      confirmDisabled={confirmDisabled}
      closeOnConfirm={false}
    />
  );
}
