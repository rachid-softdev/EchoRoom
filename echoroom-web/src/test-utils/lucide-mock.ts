/**
 * Creates a single SVG stub component for any lucide icon.
 *
 * The stub renders a `<svg>` element with a `data-testid` attribute like
 * `icon-{name-lowercased}` so tests can query by test ID.
 *
 * @param name - The original icon component name (e.g. `"Menu"`, `"X"`)
 */
function createIconStub(name: string) {
  const Stub = () => null; // will be <svg data-testid={`icon-${name.toLowerCase()}`} />;
  Stub.displayName = `Mock${name}`;
  return Stub;
}

/**
 * Common lucide icon names used across many tests.
 *
 * Useful when a test file needs to explicitly mock only the icons it
 * consumes — import this array and slice/pick what you need.
 */
export const COMMON_ICONS = [
  "Menu",
  "X",
  "Home",
  "ChevronRight",
  "ChevronLeft",
  "ChevronDown",
  "ArrowDown",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  "Search",
  "Plus",
  "Minus",
  "Trash2",
  "Edit3",
  "Loader2",
  "Check",
  "AlertTriangle",
  "AlertCircle",
  "Info",
  "Sun",
  "Moon",
  "Medal",
  "Scissors",
  "Volume2",
  "User",
  "Users",
  "Settings",
  "Bell",
  "Heart",
  "Share2",
  "Flag",
  "MessageCircle",
  "Eye",
  "EyeOff",
  "Play",
  "Pause",
  "SkipForward",
  "SkipBack",
] as const;

/**
 * A Proxy-based mock that lazily creates a stub for **any** lucide icon
 * accessed via property lookup.
 *
 * Usage — place at the top of your test file:
 *
 * ```ts
 * vi.mock("lucide-react", () => createLucideMock());
 * ```
 *
 * Any icon imported in the component-under-test will be silently stubbed
 * without needing to enumerate it in the factory. If you need `data-testid`
 * attributes for specific icons, import and use individual stubs from
 * `COMMON_ICONS` in an explicit factory instead.
 */
export function createLucideMock() {
  const iconMap = new Map<string, any>();

  return new Proxy(
    {},
    {
      get: (_target, prop: string) => {
        // Avoid vi / Promise resolution traps
        if (prop === "then" || prop === "default") return undefined;
        if (!iconMap.has(prop)) {
          iconMap.set(prop, createIconStub(prop));
        }
        return iconMap.get(prop);
      },
    },
  );
}
