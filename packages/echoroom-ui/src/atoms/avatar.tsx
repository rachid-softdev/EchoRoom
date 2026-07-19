"use client";

import * as React from "react";
import { cn } from "../utils/cn";

interface AvatarContextValue {
  fallbackDelay: number;
}

const AvatarContext = React.createContext<AvatarContextValue>({
  fallbackDelay: 100,
});

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  fallbackDelay?: number;
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, fallbackDelay = 100, ...props }, ref) => {
    return (
      <AvatarContext.Provider value={{ fallbackDelay }}>
        <div
          ref={ref}
          className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
          {...props}
        />
      </AvatarContext.Provider>
    );
  },
);
Avatar.displayName = "Avatar";

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  onLoadingStatusChange?: (status: "loading" | "loaded" | "error") => void;
}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, onLoadingStatusChange, alt = "", ...props }, ref) => {
    const [status, setStatus] = React.useState<"loading" | "loaded" | "error">("loading");

    React.useEffect(() => {
      onLoadingStatusChange?.(status);
    }, [status, onLoadingStatusChange]);

    return (
      // biome-ignore lint/performance/noImgElement: Dynamic avatar images cannot use next/image
      <img
        ref={ref}
        alt={alt}
        className={cn(
          "aspect-square h-full w-full object-cover",
          status !== "loaded" && "hidden",
          status === "loaded" && "block",
          className,
        )}
        loading="lazy"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        {...props}
      />
    );
  },
);
AvatarImage.displayName = "AvatarImage";

interface AvatarFallbackProps extends React.HTMLAttributes<HTMLDivElement> {
  delay?: number;
}

const AvatarFallback = React.forwardRef<HTMLDivElement, AvatarFallbackProps>(
  ({ className, delay, ...props }, ref) => {
    const [show, setShow] = React.useState(false);
    const { fallbackDelay } = React.useContext(AvatarContext);
    const delayMs = delay ?? fallbackDelay;

    React.useEffect(() => {
      const timer = setTimeout(() => setShow(true), delayMs);
      return () => clearTimeout(timer);
    }, [delayMs]);

    if (!show) return null;

    return (
      <div
        ref={ref}
        className={cn(
          "flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground",
          className,
        )}
        {...props}
      />
    );
  },
);
AvatarFallback.displayName = "AvatarFallback";

export type { AvatarFallbackProps, AvatarImageProps, AvatarProps };
export { Avatar, AvatarFallback, AvatarImage };
