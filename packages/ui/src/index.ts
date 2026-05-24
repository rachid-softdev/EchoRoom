// @echoroom/ui — Shared UI components
// In Phase 1, components are developed and consumed locally in echoroom-web.
// This package exists as a workspace placeholder so that future consumers
// (desktop-electron, mobile) can import from a stable @echoroom/ui interface.
//
// During development, the web app imports directly from "@/components/ui" (local alias).
// When desktop/mobile packages are built, they will import from @echoroom/ui
// which will re-export the canonical components located in echoroom-web/src/components/ui/.
//
// The component implementations live in echoroom-web/src/components/ui/
// and will be extracted here when the package is ready for external consumption.

export const UI_PACKAGE_VERSION = "0.1.0";
