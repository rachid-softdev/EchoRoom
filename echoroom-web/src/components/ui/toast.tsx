"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "./lib";

type ToastVariant = "default" | "destructive" | "success";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within <Toaster>");
  }
  return context;
}

let toastCounter = 0;

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const timeoutRefs = React.useRef<Map<string, NodeJS.Timeout>>(new Map());

  const addToast = React.useCallback((toast: Omit<ToastItem, "id">) => {
    const id = `toast-${++toastCounter}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    const timeout = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timeoutRefs.current.delete(id);
    }, toast.duration);
    timeoutRefs.current.set(id, timeout);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((t) => clearTimeout(t));
      timeoutRefs.current.clear();
    };
  }, []);

  // Listen for global toast events dispatched by the standalone toast() function
  React.useEffect(() => {
    function handleToastEvent(
      e: CustomEvent<{ message: string; variant: ToastVariant; duration: number }>,
    ) {
      addToast({
        message: e.detail.message,
        variant: e.detail.variant,
        duration: e.detail.duration,
      });
    }

    window.addEventListener("echoroom-toast", handleToastEvent as EventListener);
    return () => window.removeEventListener("echoroom-toast", handleToastEvent as EventListener);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-xl border p-4 shadow-lg transition-all",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-card-foreground",
        destructive: "border-destructive bg-destructive text-destructive-foreground",
        success: "border-primary/30 bg-primary/10 text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface ToastOptions {
  title?: string;
  message?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  message: string;
  onClose?: () => void;
}

function Toast({ className, variant, message, onClose, ...props }: ToastProps) {
  return (
    <div className={cn(toastVariants({ variant }), className)} {...props}>
      <p className="text-sm font-medium">{message}</p>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="ml-4 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Fermer</span>
        </button>
      )}
    </div>
  );
}

function Toaster() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-[calc(100vw-2rem)] sm:max-w-sm">
      {toasts.map((toast) => (
        <div key={toast.id} className="animate-slide-in-right">
          <Toast
            message={toast.message}
            variant={toast.variant}
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}

function toast(message: string, variant?: ToastVariant, duration?: number): void;
function toast(options: ToastOptions): void;
function toast(
  messageOrOptions: string | ToastOptions,
  variant: ToastVariant = "default",
  duration: number = 4000,
) {
  let msg: string;
  let v: ToastVariant;
  let d: number;

  if (typeof messageOrOptions === "string") {
    msg = messageOrOptions;
    v = variant;
    d = duration;
  } else {
    msg = messageOrOptions.title ?? messageOrOptions.message ?? "";
    v = messageOrOptions.variant ?? "default";
    d = messageOrOptions.duration ?? 4000;
  }

  const event = new CustomEvent("echoroom-toast", {
    detail: { message: msg, variant: v, duration: d },
  });
  window.dispatchEvent(event);
}

export type { ToastItem, ToastVariant };
export { Toast, Toaster, ToastProvider, toast, useToast };
