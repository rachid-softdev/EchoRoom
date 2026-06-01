# EchoRoom Design System — Components

## Import Convention

All UI components are imported from `@/components/ui/<name>`:

```typescript
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
```

Utility function `cn()` from `@/components/ui/lib` is used internally for class merging (via `clsx` + `tailwind-merge`).

---

## Button

**File:** `src/components/ui/button.tsx`

A polymorphic button component with support for 6 visual variants and 4 sizes. Built on `class-variance-authority` (CVA). Supports the `asChild` pattern via `React.cloneElement` for rendering as a child element (e.g., Next.js `Link`).

### Props

| Prop       | Type                                                                  | Default     | Description                                  |
|------------|-----------------------------------------------------------------------|-------------|----------------------------------------------|
| `variant`  | `"default" \| "destructive" \| "outline" \| "secondary" \| "ghost" \| "link"` | `"default"` | Visual style variant                         |
| `size`     | `"default" \| "sm" \| "lg" \| "icon"`                                | `"default"` | Size preset                                  |
| `asChild`  | `boolean`                                                             | `false`     | If true, renders child element instead of `<button>` |
| `className`| `string`                                                              | —           | Additional CSS classes                       |
| ...props   | `React.ButtonHTMLAttributes<HTMLButtonElement>`                       | —           | All native button attributes                 |

### Variants

| Variant       | Visual                                                        |
|---------------|---------------------------------------------------------------|
| `default`     | Solid primary background (`bg-primary`)                       |
| `destructive` | Red background (`bg-destructive`)                             |
| `outline`     | Transparent with border (`border-border`)                     |
| `secondary`   | Secondary background (`bg-secondary`)                         |
| `ghost`       | Transparent, hover shows secondary background                 |
| `link`        | Text-only with underline on hover                             |

### Sizes

| Size      | Classes                      |
|-----------|------------------------------|
| `default` | `h-10 px-4 py-2`             |
| `sm`      | `h-9 rounded-lg px-3`        |
| `lg`      | `h-11 rounded-xl px-8`       |
| `icon`    | `h-10 w-10` (square)         |

### Usage Examples

```tsx
// Default button
<Button>Cliquer</Button>

// Destructive button
<Button variant="destructive">Supprimer</Button>

// Outline button
<Button variant="outline">Annuler</Button>

// Icon button
<Button size="icon" aria-label="Paramètres">
  <SettingsIcon />
</Button>

// As child (renders as Next.js Link)
<Button asChild>
  <Link href="/scenarios">Voir les scénarios</Link>
</Button>
```

### Accessibility

- Uses native `<button>` element (or child element with `asChild`)
- Disabled state: `pointer-events: none` + `opacity-50`
- Focus-visible ring: `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`
- Supports all ARIA attributes via native spread props
- `type="button"` is **not** automatically set — consumers should set it when used inside forms to prevent unintended submit

---

## Card

**File:** `src/components/ui/card.tsx`

A composite card component with 6 sub-components: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter`. All are thin wrappers around `<div>` elements with consistent border, shadow, and spacing styles.

### Props

All sub-components accept standard `React.HTMLAttributes<HTMLDivElement>` (or `HTMLHeadingElement` / `HTMLParagraphElement` for title/description).

| Sub-component    | Renders as | Default classes                                              |
|------------------|------------|--------------------------------------------------------------|
| `Card`           | `<div>`    | `rounded-xl border border-border/40 bg-card shadow-sm`       |
| `CardHeader`     | `<div>`    | `flex flex-col space-y-1.5 p-6`                              |
| `CardTitle`      | `<h3>`     | `text-2xl font-semibold leading-none tracking-tight`         |
| `CardDescription`| `<p>`      | `text-sm text-muted-foreground`                              |
| `CardContent`    | `<div>`    | `p-6 pt-0`                                                   |
| `CardFooter`     | `<div>`    | `flex items-center p-6 pt-0`                                 |

### Usage Example

```tsx
<Card className="max-w-md">
  <CardHeader>
    <CardTitle>Crédits disponibles</CardTitle>
    <CardDescription>Votre solde de crédits d'appel</CardDescription>
  </CardHeader>
  <CardContent>
    <p className="text-3xl font-bold">150</p>
  </CardContent>
  <CardFooter>
    <Button>Acheter des crédits</Button>
  </CardFooter>
</Card>
```

### Accessibility

- Uses semantic heading element (`<h3>`) for `CardTitle`
- `Card` is a generic container `<div>` — if it represents an interactive element, use `role="button"` or wrap with `<button>`
- All sub-components spread additional ARIA attributes via `...props`

---

## Badge

**File:** `src/components/ui/badge.tsx`

A small inline label/tag component with 4 visual variants. Built on CVA.

### Props

| Prop       | Type                                                              | Default     | Description            |
|------------|-------------------------------------------------------------------|-------------|------------------------|
| `variant`  | `"default" \| "secondary" \| "destructive" \| "outline"`          | `"default"` | Visual style variant   |
| `className`| `string`                                                          | —           | Additional CSS classes |
| ...props   | `React.HTMLAttributes<HTMLSpanElement>`                           | —           | All native span attributes |

### Variants

| Variant       | Visual                                                |
|---------------|-------------------------------------------------------|
| `default`     | Solid primary background                              |
| `secondary`   | Secondary background                                  |
| `destructive` | Red/destructive background                            |
| `outline`     | Transparent with text color (no background)           |

### Usage Examples

```tsx
<Badge>Nouveau</Badge>
<Badge variant="secondary">Brouillon</Badge>
<Badge variant="destructive">Échoué</Badge>
<Badge variant="outline">Privé</Badge>
```

### Accessibility

- Renders a `<span>` — no semantic meaning on its own
- If the badge conveys status information, add an `aria-label` or `role="status"`
- Focus-visible ring on interaction via `focus:ring-2 focus:ring-primary`

---

## Dialog

**File:** `src/components/ui/dialog.tsx`

A modal dialog component built with React Context for state management. Includes `useFocusTrap` for keyboard accessibility. Provides 7 sub-components: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, and `DialogDescription`.

### Props

#### `Dialog`
| Prop           | Type                          | Default | Description                                     |
|----------------|-------------------------------|---------|-------------------------------------------------|
| `open`         | `boolean` (controlled)        | —       | Controlled open state (optional)                |
| `onOpenChange` | `(open: boolean) => void`     | —       | Callback when open state changes (optional)     |
| `children`     | `React.ReactNode`             | —       | Dialog trigger + content                        |

When `open`/`onOpenChange` are omitted, the dialog manages its own state internally.

#### `DialogTrigger`
| Prop       | Type               | Default | Description                                          |
|------------|--------------------|---------|------------------------------------------------------|
| `asChild`  | `boolean`          | `false` | If true, renders child element instead of `<button>` |
| `children` | `React.ReactNode`  | —       | Trigger element                                      |

#### `DialogContent`
All standard `React.HTMLAttributes<HTMLDivElement>` props.

#### Sub-components
`DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` — all accept `React.HTMLAttributes<HTMLDivElement | HTMLHeadingElement | HTMLParagraphElement>`.

### Behavior

- **Focus trap:** When open, focus is trapped within the dialog using `useFocusTrap` hook.
- **Escape key:** Pressing `Escape` closes the dialog.
- **Backdrop click:** Clicking the semi-transparent overlay closes the dialog.
- **Body scroll lock:** Scroll on `<body>` is disabled while open (restored on close).
- **Animation:** Overlay uses `animate-fade-in`; content uses `animate-zoom-in`.
- **Responsive:** Full-width on mobile (`max-w-[calc(100vw-2rem)]`), `max-w-lg` on `sm+`.

### Usage Example

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Supprimer le compte</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirmer la suppression</DialogTitle>
      <DialogDescription>
        Cette action est irréversible. Votre compte sera définitivement supprimé.
      </DialogDescription>
    </DialogHeader>
    <div className="py-4">
      <p>Êtes-vous sûr de vouloir continuer ?</p>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
      <Button variant="destructive">Supprimer</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Accessibility

- `role="dialog"` and `aria-modal="true"` on the content wrapper
- `aria-labelledby` connected to `DialogTitle` (auto-assigned via `useId()`)
- `aria-describedby` connected to `DialogDescription` (auto-assigned via `useId()`)
- Close button has `aria-label="Fermer"`
- Focus trap: keyboard focus cycles within the dialog (via `useFocusTrap` hook)
- Escape key handler: `onKeyDown` with `Escape` triggers `onOpenChange(false)`
- Overlay has `aria-hidden="true"`

---

## Input

**File:** `src/components/ui/input.tsx`

A styled text input component that wraps the native `<input>` element with consistent theming.

### Props

| Prop       | Type                                               | Default | Description                  |
|------------|----------------------------------------------------|---------|------------------------------|
| `type`     | `string`                                           | —       | HTML input type attribute    |
| `className`| `string`                                           | —       | Additional CSS classes       |
| ...props   | `React.InputHTMLAttributes<HTMLInputElement>`      | —       | All native input attributes  |

### Styling

- Height: `h-10`, full width (`w-full`)
- Border: `rounded-xl border border-border`
- Background: `bg-background`
- Text: `text-sm`, placeholder in `text-muted-foreground`
- Focus: `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`
- Disabled: `cursor-not-allowed opacity-50`
- File input support: file button reset, `file:text-sm file:font-medium`

### Usage Examples

```tsx
// Basic text input
<Input placeholder="Votre email" type="email" />

// With label
<label htmlFor="username">Nom d'utilisateur</label>
<Input id="username" placeholder="Entrez votre nom" />

// With error state
<Input className="border-destructive" aria-invalid={hasError} />
```

### Accessibility

- Uses native `<input>` element — all native accessibility features apply
- When used with `aria-invalid` attribute, error styles are applied via the `border-border` classes (consumers should apply `border-destructive` for error state)
- Spreads all native ARIA attributes via `...props`
- Placeholder text uses muted foreground color for sufficient contrast

---

## Avatar

**File:** `src/components/ui/avatar.tsx`

A composite avatar component with 3 sub-components: `Avatar`, `AvatarImage`, and `AvatarFallback`. Uses React Context to propagate `fallbackDelay` to `AvatarFallback`.

### Props

#### `Avatar`
| Prop            | Type                              | Default | Description                                  |
|-----------------|-----------------------------------|---------|----------------------------------------------|
| `fallbackDelay` | `number` (ms)                     | `100`   | Delay before showing fallback (avoids flash) |
| `className`     | `string`                          | —       | Additional CSS classes                       |
| ...props        | `React.HTMLAttributes<HTMLDivElement>` | —   | All native div attributes                    |

#### `AvatarImage`
| Prop                    | Type                                      | Default | Description                                    |
|-------------------------|-------------------------------------------|---------|------------------------------------------------|
| `onLoadingStatusChange` | `(status: "loading" \| "loaded" \| "error") => void` | — | Callback for image loading state           |
| `alt`                   | `string`                                  | `""`    | Alt text for the image                        |
| ...props                | `React.ImgHTMLAttributes<HTMLImageElement>` | —       | All native img attributes                     |

The image is rendered with `<img>` (not `next/image`) using `loading="lazy"`. It is hidden (`hidden` class) until loaded, then shown (`block` class). On error, it stays hidden and the fallback renders.

#### `AvatarFallback`
| Prop        | Type                              | Default | Description                            |
|-------------|-----------------------------------|---------|----------------------------------------|
| `delay`     | `number` (ms)                     | context | Delay override for this specific instance |
| `className` | `string`                          | —       | Additional CSS classes                 |
| ...props    | `React.HTMLAttributes<HTMLDivElement>` | —   | All native div attributes              |

Renders as a centered, rounded container with muted background. Shows after the configured delay (defaults to the `Avatar`'s `fallbackDelay`, which defaults to 100ms).

### Usage Example

```tsx
<Avatar fallbackDelay={200}>
  <AvatarImage
    src="/avatars/user-123.jpg"
    alt="Photo de profil"
    onLoadingStatusChange={(status) => console.log(status)}
  />
  <AvatarFallback>JD</AvatarFallback>
</Avatar>

// Fallback only (no image)
<Avatar>
  <AvatarFallback>AB</AvatarFallback>
</Avatar>
```

### Accessibility

- Container has `overflow-hidden rounded-full` for visual containment
- `AvatarImage` requires `alt` text for screen readers (defaults to `""` — set a meaningful value)
- `AvatarFallback` renders initials as text content — no ARIA role needed
- Uses `loading="lazy"` for native lazy loading
- When image fails to load, the `onError` handler sets status to `"error"`, hiding the image and allowing the fallback to show

---

## Skeleton

**File:** `src/components/ui/skeleton.tsx`

A loading placeholder component with a subtle pulse animation. Used to indicate content is being loaded.

### Props

| Prop       | Type                                      | Default | Description            |
|------------|-------------------------------------------|---------|------------------------|
| `className`| `string`                                  | —       | Additional CSS classes |
| ...props   | `React.HTMLAttributes<HTMLDivElement>`    | —       | All native div attributes |

### Visual

- `animate-pulse` — subtle opacity pulse animation
- `rounded-md` — medium border radius
- `bg-muted` — muted background color

### Usage Examples

```tsx
// Text line skeleton
<Skeleton className="h-4 w-[250px]" />

// Avatar skeleton
<Skeleton className="h-10 w-10 rounded-full" />

// Card skeleton
<div className="space-y-3">
  <Skeleton className="h-[200px] w-full rounded-xl" />
  <div className="space-y-2">
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
  </div>
</div>

// Button skeleton
<Skeleton className="h-10 w-[120px] rounded-xl" />
```

### Accessibility

- Renders a `<div>` with no semantic meaning — use `aria-hidden="true"` if the skeleton is decorative
- For screen readers, pair with `role="status"` and an `aria-label` describing what is loading
- Animation is purely CSS `animate-pulse` — respects `prefers-reduced-motion` via Tailwind's built-in support
