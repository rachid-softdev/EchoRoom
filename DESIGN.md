---
name: EchoRoom AI
description: AI Social Chaos Platform — social entertainment through absurd AI-powered calls
colors:
  primary: "#06b6d4"
  primary-deep: "#0891b2"
  neutral-bg: "#0a0a0b"
  neutral-surface: "#141416"
  neutral-ink: "#fafafa"
  neutral-muted: "#a1a1aa"
  neutral-border: "#27272a"
  neutral-bg-light: "#ffffff"
  neutral-surface-light: "#ffffff"
  neutral-ink-light: "#09090b"
  neutral-muted-light: "#71717a"
  neutral-border-light: "#e4e4e7"
  destructive: "#ef4444"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 5vw, 4.5rem)"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2.25rem)"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(0.875rem, 1.5vw, 1.125rem)"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "0.02em"
rounded:
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  2xl: "3rem"
  3xl: "4rem"
  4xl: "6rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.md}"
    padding: "0.75rem 2rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-border}"
    rounded: "{rounded.md}"
    padding: "0.75rem 2rem"
  card-default:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.neutral-ink}"
    rounded: "{rounded.md}"
    padding: "1.5rem"
---

# Design System: EchoRoom AI

## 1. Overview

**Creative North Star: "The Chaotic Party"**

EchoRoom's visual language feels like walking into a weird party hosted by your funniest friend — neon glow bleeding through a dark room, unpredictable energy, every corner hiding something absurd. It's cyber without being cold, playful without being childish, social without being noisy.

The system rejects sterile SaaS minimalism, corporate gradients, and the "trusted by enterprises" posturing of mainstream AI tools. Instead, it leans into dark-space warmth: deep backgrounds let the cyan accent sing, muted neutrals provide structure, and the typography stays bold and confident. The brand lives in the contrast between darkness and electric cyan — the same way a live call alert pulses red against a dark interface.

**Key Characteristics:**
- Dark-by-default, light-as-alternate — the scene is night-time, social, screen-lit
- One accent voice: cyan. Used sparingly for maximum impact (≤15% of any surface)
- Bold typography as identity — heavy weights, tight tracking, no timid text
- Glass as accent texture, not as default container — purposeful transparency, never decorative blur
- Motion that amplifies energy — quick fades, slides from unexpected directions, nothing languid

## 2. Colors

Cyan is the lone accent — electric, confident, unmistakably digital. Neutrals run cool-to-true (no warm cream tones) to keep the dark backgrounds feeling like night air, not aged paper.

### Primary
- **Electric Cyan** (`#06b6d4` / oklch(0.72 0.13 231)): The brand's one voice. Used for primary CTAs, active states, highlighted text spans, and the signature glow effects. Never used as a body background; always an accent.
- **Deep Cyan** (`#0891b2` / oklch(0.62 0.12 234)): Hover state for primary buttons. Reinforces the interaction without introducing a second accent color.

### Neutral (Dark — default)
- **Night Background** (`#0a0a0b`): The body canvas. Near-black with a micro-cold shift. All surfaces sit on this.
- **Surface** (`#141416`): Card, sheet, and elevated surface backgrounds. One step up from night.
- **Border** (`#27272a`): Subtle structural lines. Present but recessive.
- **Muted Text** (`#a1a1aa`): Secondary and supporting copy. Comfortably readable against night bg.
- **Ink** (`#fafafa`): Primary body text and headings. Near-white with a micro-cold shift.

### Neutral (Light — alternate)
- **Background** (`#ffffff`): True white body canvas.
- **Surface** (`#ffffff`): Cards on light mode.
- **Border** (`#e4e4e7`): Structural lines on light mode.
- **Muted Text** (`#71717a`): Secondary copy on light mode.
- **Ink** (`#09090b`): Primary text on light mode.

### Destructive
- **Red** (`#ef4444`): Destructive actions, error states, live call indicators, abuse flags.

### Named Rules
**The One Voice Rule.** Cyan is the only accent. If you need a second color for meaning (status, category, badge), use transparency of the background's own hue or default to the neutral scale. Two accents dilute the brand.

**The Dark-First Rule.** Every surface is designed in dark mode first. Light mode is a secondary, same-structure adaptation. Never design a surface for light mode that doesn't have a dark-mode equivalent.

## 3. Typography

**Display & Body Font:** Inter (with system-ui, sans-serif fallback)

**Character:** Inter is a workhorse — neutral, legible, confident without personality competition. It doesn't try to be playful itself; the playfulness comes from the content and the cyan accent. The weight range (400-900) carries the hierarchy entirely through mass, not through font switches.

### Hierarchy
- **Display** (900, `clamp(2.5rem, 5vw, 4.5rem)`, 1): Hero headlines only. Max 6rem (96px). Letter-spacing never tighter than -0.03em. `text-wrap: balance` on h1-h3.
- **Headline** (800, `clamp(1.5rem, 3vw, 2.25rem)`, 1.2): Section headings. Bold enough to carry a page section on their own.
- **Title** (600, 1.25rem, 1.3): Card titles, dialog headings, feature names.
- **Body** (400, `clamp(0.875rem, 1.5vw, 1.125rem)`, 1.6): Paragraphs, descriptions, long-form content. Line length capped at 65–75ch.
- **Label** (500, 0.875rem, 1.25): Button text, small captions, navigation links. 0.02em letter-spacing for legibility at small sizes.

### Named Rules
**The Mass Rule.** Hierarchy is carried by weight and size, not by color or case. No uppercase tracking for headings, no all-caps sublabels, no light weights pretending to be elegant. 800/900 weights are the default for anything that needs emphasis.

## 4. Elevation

The system is **flat by default, layered on interaction**. Shadcn-style tonal layering conveys depth: surfaces at `#141416` sit above the `#0a0a0b` background, not via drop shadows but via luminance contrast. Shadows appear only as a responsive signal:

- `shadow-sm` on cards provides micro-depth without competing with the tonal structure
- Hover lift (translateY negative, subtle shadow amplification) on interactive cards
- Modals and dialogs use a backdrop overlay (`bg-black/50`) instead of shadow depth

### Shadow Vocabulary
- **Card Rest** (`0 1px 2px rgba(0,0,0,0.3)`): Default card elevation.
- **Card Hover** (`0 4px 12px rgba(0,0,0,0.4)`): Interactive card on hover.
- **Modal** (no shadow, backdrop overlay): Dialogs and sheets sit above a `bg-black/50` backdrop.

### Named Rules
**The Flat-At-Rest Rule.** Surfaces don't compete for Z — the dark background and the layered card colors do the work. Shadows are interaction signals, not ambient atmosphere.

## 5. Components

### Buttons
- **Shape:** Rounded rectangles with 0.75rem (rounded-md) radius.
- **Primary:** Electric Cyan (`#06b6d4`) background, near-black text. Padding: 0.75rem 2rem. Hover deepens to `#0891b2`.
- **Outline:** Transparent background, `#27272a` border. Hover fills muted surface.
- **Ghost:** No border, no background. Hover fills muted surface.
- **States:** `transition-colors 0.2s` for background shifts. `focus-visible:ring-2 ring-primary ring-offset-2`. Disabled at 50% opacity.
- **Sizes:** default (h-10), sm (h-9), lg (h-11 px-8), icon (h-10 w-10).

### Cards / Containers
- **Corner Style:** 0.75rem (rounded-md). Interactive cards get 1rem (rounded-lg).
- **Background:** `#141416` surface in dark mode, `#ffffff` in light mode.
- **Border:** `1px solid #27272a` (dark) / `#e4e4e7` (light), at 40% opacity via border-border/40.
- **Shadow:** `shadow-sm` at rest.
- **Internal Padding:** 1.5rem (p-6).
- **Interactive variant:** Hover lifts `-translateY(1px)` with amplified shadow.

### Inputs / Fields
- **Shape:** Rounded-md (0.75rem), consistent with buttons.
- **Rest:** Transparent background, 1px `#27272a` border.
- **Focus:** Cyan ring (ring-2 ring-primary) replaces the border.
- **Disabled:** 50% opacity, no pointer events.

### Navigation
- **Public Header:** Sticky top, `bg-background/80` with `backdrop-blur-sm`, bottom border. Links in muted-foreground, hover shifts to foreground.
- **Mobile:** Slide-in drawer with backdrop overlay.

### Badges
- **Shape:** Rounded-full pill.
- **Variants:** secondary (muted bg, muted-fg text) for defaults; primary (cyan bg, dark text) for featured/active states; destructive (red) for live/warning states.

### Toasts
- **Position:** Bottom-right. Duration-based auto-dismiss.
- **Style:** Colored left-edge accent (default: foreground, success: primary, error: destructive). No icon prefix by default.

## 6. Do's and Don'ts

### Do:
- **Do** use cyan as the single accent voice. It's the brand's signature — rarity is its power.
- **Do** design dark-mode first. Light mode inherits the same structure, not the same atmosphere.
- **Do** let bold typography carry the energy. Display weights at 900, tight tracking, confident scale.
- **Do** use glass (`backdrop-blur`) sparingly — for overlays and headers, not as a default container treatment.
- **Do** keep the social layer visible: reactions, live counts, and community activity should surface on every page.

### Don't:
- **Don't** use gradient text (`background-clip: text`). Emphasis comes from weight and size, not gradients.
- **Don't** use side-stripe colored borders on cards, list items, or callouts. Use background tints or nothing.
- **Don't** use glassmorphism as a default container style. It belongs on overlays and floating elements only.
- **Don't** use the hero-metric template (big number + small label + gradient accent). That's SaaS cliché.
- **Don't** put an uppercase eyebrow kicker above every section. One per page as a deliberate brand system is voice; seven identical ones is AI grammar.
- **Don't** use numbered section markers (01 / 02 / 03) as default scaffolding. Numbers only when the order carries real information.
- **Don't** go sterile or corporate — no "trusted by enterprises", no muted grays that wash out the energy, no symmetrical identical grid patterns.
- **Don't** cloak the platform as an anonymous prank tool. The brand is social, communal, gamified — not anonymous, not weaponized.
