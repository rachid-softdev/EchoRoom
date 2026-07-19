"use client";

import * as React from "react";
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
  /** Called when the user confirms. The dialog then closes. */
  onConfirm?: () => void;
  /** Destructive renders the confirm button in the destructive variant. */
  variant?: "default" | "destructive";
  /** Trigger element (e.g. a Button) for uncontrolled usage. */
  trigger?: React.ReactNode;
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
}: ConfirmDialogProps) => {
  const isDestructive = variant === "destructive";

  const handleConfirm = () => {
    onConfirm?.();
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange?.(false)}>
            {cancelLabel}
          </Button>
          <Button variant={isDestructive ? "destructive" : "default"} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { ConfirmDialog };
