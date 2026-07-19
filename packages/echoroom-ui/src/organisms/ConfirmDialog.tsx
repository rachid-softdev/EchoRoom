"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "../atoms/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../molecules/dialog";

export interface ConfirmDialogProps {
  /** Controlled open state (optional — falls back to internal state). */
  open?: boolean;
  /** Controlled open-state setter. */
  onOpenChange?: (open: boolean) => void;
  /** Dialog heading. */
  title: React.ReactNode;
  /** Supporting copy under the heading. */
  description?: React.ReactNode;
  /** Label for the confirm button. */
  confirmLabel?: React.ReactNode;
  /** Label for the cancel button. */
  cancelLabel?: React.ReactNode;
  /** Called when the user confirms. */
  onConfirm?: () => void;
  /** Destructive renders the confirm button in the destructive variant. */
  variant?: "default" | "destructive";
  /** Trigger element (e.g. a Button) for uncontrolled usage. */
  trigger?: React.ReactNode;
  /** Shows a spinner on the confirm button and disables both buttons. */
  loading?: boolean;
  /** Disables the confirm button (cancel stays enabled unless loading). */
  confirmDisabled?: boolean;
  /** Close the dialog after confirming. Defaults to true. */
  closeOnConfirm?: boolean;
}

const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  onConfirm,
  variant = "default",
  trigger,
  loading = false,
  confirmDisabled = false,
  closeOnConfirm = true,
}: ConfirmDialogProps) => {
  const isDestructive = variant === "destructive";

  const handleConfirm = () => {
    onConfirm?.();
    if (closeOnConfirm) onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={loading || confirmDisabled}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { ConfirmDialog };
