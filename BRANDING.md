# Branding & Color Palettes

Two palettes ship with this template. Both are defined as design tokens in
`src/app/globals.css` and consumed through the shadcn/Tailwind color variables
(`bg-primary`, `text-accent-foreground`, `ring-ring`, `bg-chart-1`, …), so no
component needs to know which palette is active.

`oklch(...)` values are the source of truth; hex codes are approximate sRGB
equivalents for reference in design tools.

## Source

The UAM palette is derived from the institutional seal in
`public/uam-seeklogo.png`. The logo is effectively monochrome — a single teal
ink sampled at **`#00A8A0`** (`oklch(0.656 0.119 194)`), a green-leaning
turquoise. That teal anchors the palette; neutrals carry a faint teal tint
(chroma ≤ 0.02) so surfaces feel part of the same family without hurting text
legibility.

The FIA palette is a hue-shifted sibling: the same lightness/chroma structure
rotated from teal (hue ~194°) to an engineering azure (hue ~255°). It keeps UAM
neutrals, backgrounds, and semantic colors and only overrides the brand-bearing
tokens (`primary`, `accent`, `ring`, `sidebar-*`, `chart-*`).

## UAM — default (`:root`, `.dark`)

| Role                   | Light — oklch         | Light — approx | Dark — oklch       | Dark — approx |
| ---------------------- | --------------------- | -------------- | ------------------ | ------------- |
| Brand ink (logo)       | `0.656 0.119 194`     | `#00A8A0`      | `0.656 0.119 194`  | `#00A8A0`     |
| `--primary`            | `0.5 0.105 194`       | `#007E79`      | `0.72 0.12 194`    | `#27C1B8`     |
| `--primary-foreground` | `0.985 0.012 194`     | `#F4FEFC`      | `0.2 0.04 215`     | `#0C2A2E`     |
| `--ring`               | `0.656 0.119 194`     | `#00A8A0`      | `0.7 0.11 194`     | `#2ABEB4`     |
| `--accent`             | `0.93 0.038 194`      | `#DBF1EE`      | `0.32 0.05 200`    | `#1E3B3E`     |
| `--accent-foreground`  | `0.38 0.08 200`       | `#0F5B58`      | `0.95 0.02 194`    | `#E8FBF7`     |
| `--foreground`         | `0.17 0.014 220`      | `#161D1F`      | `0.97 0.005 200`   | `#F2F6F5`     |
| `--background`         | `0.994 0.002 200`     | `#FCFDFD`      | `0.17 0.015 220`   | `#151C1E`     |
| `--muted-foreground`   | `0.52 0.022 215`      | `#5C6B6D`      | `0.71 0.03 200`    | `#9EB4B4`     |
| chart 1 → 5            | teal ramp `194 → 216` | —              | brighter teal ramp | —             |

## FIA — Facultad de Ingeniería (`[data-brand="fia"]`)

Overrides only. Everything else is inherited from the UAM palette above.

| Role                   | Light — oklch          | Light — approx | Dark — oklch        | Dark — approx |
| ---------------------- | ---------------------- | -------------- | ------------------- | ------------- |
| `--primary`            | `0.48 0.15 255`        | `#2A5DC8`      | `0.7 0.15 255`      | `#5E9BF2`     |
| `--primary-foreground` | `0.985 0.012 255`      | `#F4F8FF`      | `0.18 0.04 255`     | `#0E1A33`     |
| `--ring`               | `0.55 0.17 255`        | `#3C6EE0`      | `0.68 0.15 255`     | `#5A97EF`     |
| `--accent`             | `0.93 0.04 255`        | `#DCE7FB`      | `0.32 0.07 255`     | `#1D2B4A`     |
| `--accent-foreground`  | `0.4 0.12 255`         | `#274a9e`      | `0.95 0.02 255`     | `#E9EFFC`     |
| chart 1 → 5            | azure ramp `230 → 270` | —              | brighter azure ramp | —             |

## Switching palette

```env
# .env
NEXT_PUBLIC_BRAND="fia"   # or "uam" (default)
```

`src/lib/brand.ts` reads that value and `src/app/layout.tsx` renders it as
`<html data-brand="...">`. The CSS selectors `[data-brand="fia"]` and
`[data-brand="fia"].dark` do the rest. Any unrecognized value falls back to
`uam`.

To offer a per-user or per-tenant switch instead of a build-time one, set the
`data-brand` attribute dynamically (cookie or DB lookup) the same way the
locale cookie is handled in `src/i18n/`.

## Accessibility

- `primary` / `primary-foreground` pairs clear WCAG AA (≥ 4.5:1) for body text
  in both palettes and both themes.
- `accent-foreground` on `accent` clears AA for UI text.
- `destructive` is unchanged from the shadcn default red and remains reserved
  for errors and irreversible actions — do not use a brand color for those.
