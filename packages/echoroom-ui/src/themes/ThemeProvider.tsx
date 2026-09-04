"use client";

/**
 * @echoroom/ui — ThemeProvider
 *
 * Runtime-switchable theme (light / dark) without page reload.
 * Wraps next-themes and injects the `.dark` class on <html>.
 *
 * Defaults match EchoRoom's web app: dark by default, system disabled,
 * storage key "echoroom-theme".
 */

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export type Theme = "light" | "dark" | "system";

export function ThemeProviderUI(props: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="echoroom-theme"
      disableTransitionOnChange
      {...props}
    />
  );
}

export { useTheme as useThemeUI } from "next-themes";
