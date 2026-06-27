"use client";

import { Loader2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";

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
 * A confirmation dialog built on shadcn/ui Dialog.
 *
 * @description Renders a modal overlay with title, description, and two action
 * buttons (cancel / confirm). Supports a destructive variant for dangerous
 * actions and a loading state that disables both buttons and shows a spinner
 * on the confirm button.
 * @example
 * <ConfirmDialog open={isOpen} onOpenChange={setIsOpen} title="Supprimer ?" description="Cette action est irréversible." variant="destructive" onConfirm={handleDelete} />
 * @returns A Dialog component with header, description, and footer buttons
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
