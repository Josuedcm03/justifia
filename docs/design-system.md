# Justifia Design System

The visual base for every screen in this project. It is derived from the
Universidad Americana site (`uam.edu.ni`) by reading the shipped markup and the
theme stylesheet, not by eyeballing screenshots. Every value below is traceable
to a source rule; where we deviate, the reason is stated.

**Rule of thumb:** a new screen should not introduce a colour, a font size, a
radius or a spacing step that is not in this document. If you need one, add it
here first.

---

## 1. Source of truth

| Extracted from | What it gave us |
| --- | --- |
| `uam.edu.ni` homepage markup | Brand teal `#0099a8`, deep teal `#0b545b`, accent blue `#128be0` |
| `wp-content/uploads/thegem/css/custom-*.css` | Full neutral ramp, interactive teal `#00bcd4`, lime highlight, type scale, button states |
| Google Fonts request in `<head>` | `Libre Franklin`, `Montserrat`, `Source Sans Pro`, `Roboto` |

---

## 2. Colour

### 2.1 Raw palette

These are the literal UAM values. They are the vocabulary; section 2.2 assigns
them roles.

| Token | Hex | oklch | Origin |
| --- | --- | --- | --- |
| `teal-logo` | `#0099a8` | `oklch(0.624 0.107 207)` | Logo ink, homepage markup |
| `teal-brand` | `#00bcd4` | `oklch(0.729 0.127 211)` | Theme interactive accent (55 occurrences) |
| `teal-deep` | `#0b545b` | `oklch(0.409 0.066 205)` | Dark teal, headings on light teal |
| `teal-mist` | `#a3e7f0` | `oklch(0.886 0.069 206)` | Quote marks, soft fills |
| `lime` | `#d1ff30` | `oklch(0.935 0.217 122)` | Signature citrus |
| `lime-soft` | `#e7ff89` | `oklch(0.958 0.146 119)` | Active breadcrumb and its 3px underline |
| `ink-900` | `#212331` | `oklch(0.261 0.026 278)` | Menu overlay, darkest surface |
| `ink-800` | `#3c3950` | `oklch(0.358 0.040 290)` | Body headings, button hover |
| `ink-700` | `#494c64` | `oklch(0.424 0.040 279)` | Default button fill |
| `slate-600` | `#5f727f` | `oklch(0.541 0.030 238)` | Secondary text |
| `slate-400` | `#99a9b5` | `oklch(0.726 0.025 240)` | Tertiary text, tag borders |
| `slate-300` | `#b6c6c9` | `oklch(0.815 0.018 210)` | Muted button fill |
| `line` | `#dfe5e8` | `oklch(0.918 0.008 229)` | Hairlines, dividers |
| `surface` | `#f4f6f7` | `oklch(0.972 0.003 229)` | Section background |
| `danger` | `#f44336` | `oklch(0.643 0.215 29)` | Error state |

Notice what the neutrals actually are: **violet-leaning navy**, not grey.
`#212331` carries a measurable `0.026` chroma at hue `278`. Reaching for a
neutral grey anywhere in this app is a bug; it reads cold and generic next to
the teal.

### 2.2 Roles

| Role | Light | Dark | Notes |
| --- | --- | --- | --- |
| `background` | `surface` | `ink-900` | Page sits on the soft surface, cards float in white |
| `card` / `popover` | white | `ink-800` | |
| `foreground` | `ink-900` | near-white | |
| `primary` | `oklch(0.52 0.095 206)` | `teal-brand` | Deviation, see below |
| `secondary` | `line` | `ink-700` | |
| `muted-foreground` | `slate-600` | `slate-400` | 5.0:1 on white |
| `accent` | soft `teal-mist` | teal at low lightness | Hover and selected rows |
| `border` / `input` | `line` | white at 10% | |
| `ring` | `teal-brand` | `teal-brand` | Focus is always the bright teal |
| `highlight` | `lime` | `lime` | Reserved, see 2.3 |
| `destructive` | `danger` | lifted `danger` | |
| `denied` | `oklch(0.505 0.196 28.8)` | `oklch(0.6 0.196 28.8)` | Accent (icon badge) on the permission-denied screen, see 2.4 |
| `sidebar` | `ink-900` | `ink-900` | Dark in both themes, see 4.2 |

**Deviation, interactive primary.** `#0099a8` carries only about 3.3:1 against
white, which fails WCAG AA for button labels. Interactive primary is therefore
deepened to `oklch(0.52 0.095 206)`, measured at 5.1:1. `#0099a8` stays the brand
ink for logo lockups and large display type, where 3:1 is sufficient.

### 2.3 The lime is a rule, not a colour

On the UAM site `#e7ff89` appears in exactly one place: the *current*
breadcrumb, with a 3px underline of the same colour. It is a positional signal.

So in this app the lime means **"you are here"** and nothing else:

- active sidebar item (3px inset bar on the leading edge)
- current breadcrumb segment (3px underline, the `.is-current` utility)
- the active step in a multi-step flow
- the selected tab underline

It is never a button fill, never a background wash, never decoration. At
`oklch(0.935 0.217 122)` it is the loudest thing on screen: one accent, spent
deliberately. Text on lime is always `ink-900`.

### 2.4 The denied accent

The permission-denied screen (`/denied`) sits on the ordinary `--background`
with `--foreground` text and the primary button, so it reads as the same
family as every other screen. Warning red appears in exactly one place: a
`bg-denied/10` circle holding a `text-denied` icon. There is no full-bleed
state surface anywhere in the app.

`--denied` is a per-theme token, like `--destructive`, because the icon must
clear the 3:1 non-text floor (§7) against a background that changes with the
theme. It stays separate from `--destructive`, which keeps carrying inline
errors, degraded-state pills and the destructive button variant, so one token
never has to do both jobs. It has no foreground partner: the accent never
carries text.

| Theme | `--denied` | Measured contrast on `--background` |
| --- | --- | --- |
| Light | `oklch(0.505 0.196 28.8)` | **6.00:1** |
| Dark | `oklch(0.6 0.196 28.8)` | **4.01:1** (the light value measures 2.68:1 here) |

---

## 3. Typography

### 3.1 Families

| Role | Family | Weights | CSS var |
| --- | --- | --- | --- |
| Display and headings | **Libre Franklin** | 600, 700 | `--font-display` |
| Body and UI | **Source Sans 3** | 300, 400, 600 | `--font-sans` |
| Numeric / code | Geist Mono | 400 | `--font-mono` |

UAM ships three text families (Libre Franklin, Montserrat, Source Sans Pro). We
carry two. Montserrat did one job there, uppercase 14px nav labels, and Libre
Franklin covers that without a third webfont payload. Source Sans 3 is the
maintained successor to Source Sans Pro.

The pairing is deliberate: Libre Franklin is a grotesque with tight, flat
terminals; Source Sans is humanist with open apertures. They are distinct enough
to read as two voices at a glance, which is the whole point of pairing.

### 3.2 Scale

Line heights are UAM's own (`h1` 50/69, `h2` 36/53, body-tiny 14/21.875; that
odd `21.875px` is a 1.5625 ratio, so we express it as a ratio).

| Token | Size | Line height | Weight | Family |
| --- | --- | --- | --- | --- |
| `display` | `clamp(2.5rem, 5vw, 3.125rem)` | 1.38 | 700 | display |
| `h1` | `clamp(1.875rem, 4vw, 2.25rem)` | 1.47 | 700 | display |
| `h2` | `1.75rem` | 1.3 | 700 | display |
| `h3` | `1.375rem` | 1.36 | 600 | display |
| `h4` | `1.125rem` | 1.44 | 600 | display |
| `body` | `1rem` | 1.6 | 400 | sans |
| `body-lead` | `1.125rem` | 1.6 | 300 | sans |
| `small` | `0.875rem` | 1.5625 | 400 | sans |
| `caption` | `0.75rem` | 1.5 | 500 | sans |

Headings use `letter-spacing: 0`. UAM sets this explicitly for `h1` and `h2`,
and it holds for the rest. Do not track out headings.

### 3.3 Writing rules

- Sentence case everywhere. No ALL-CAPS labels.
- Buttons name the outcome: "Save changes", not "Submit". The label survives
  into the confirmation: "Publish" becomes "Published".
- Errors say what happened and what to do next. They do not apologise.
- Measure: 65 to 75 characters. Use `max-w-prose` on any paragraph block.

---

## 4. Layout

### 4.1 Space and shape

Base unit **4px**. Allowed steps: `4 8 12 16 24 32 40 56 80`.

| Token | Value | Use |
| --- | --- | --- |
| `--radius` | `0.75rem` (12px) | Cards, inputs, popovers |
| `--radius-pill` | `9999px` | Buttons, tags, avatars |
| container | `1200px` | Matches UAM's grid |
| section gap | `80px` desktop, `56px` tablet, `40px` mobile | |

UAM buttons are pills (`border-radius: 30px`); panels sit at `10` to `16px`.
That split is intentional and we keep it: **round the things you press, soften
the things you read.** One radius on everything is exactly the templated look
we are avoiding.

Elevation is carried by the surface split (white card on `#f4f6f7`) plus a
hairline. Shadows are for things that genuinely float, meaning popovers,
dropdowns and sheets, and never for static cards.

### 4.2 The dark rail

UAM's navigation overlay is `#212331` regardless of page. We make that
permanent: **the sidebar is dark ink in both light and dark themes.** It gives
the app a fixed anchor, lets the lime active marker read at full strength, and
it is the structural detail that makes a screenshot identifiable as this product
rather than a default shadcn install.

Everything else stays quiet. That is the trade.

### 4.3 Screen skeleton

```
+----------+----------------------------------------------+
|          |  header  .  breadcrumb / user / theme        |  56px, white, hairline under
|  ink-900 +----------------------------------------------+
|   rail   |                                              |
|          |   h1 title                                   |
| | active |   one line of muted context                  |  <- page header, 24px gap below
|          |                                              |
|  256px   |   +--------+ +--------+ +--------+           |
|          |   |  card  | |  card  | |  card  |           |  white on surface, 16px gutter
|          |   +--------+ +--------+ +--------+           |
|          |                                              |
+----------+----------------------------------------------+
```

Content is left-aligned. Centre alignment is reserved for the auth screens,
where there is a single focal object and nothing to scan.

Auth screens get a two-panel split above `lg`: an ink-900 brand panel on the
left carrying the institutional mark, the form on white at the right. Below
`lg` the panel collapses and the form centres.

---

## 5. Components

**Button.** Pill. Primary is the deepened teal. UAM hovers *up* into
`#00bcd4` (`.gem-button:hover { background-color: #00bcd4 }`), which would drop
a white label to about 2.3:1, so we hover *down* toward `teal-deep` instead:
same teal relationship, legible label. Secondary is a `line` fill with `ink-800`
text. Ghost is transparent with an `accent` hover. Destructive is `danger`.
Focus is a 2px `teal-brand` ring with a 2px offset.

**Card.** White, `--radius`, 1px `line` border, no shadow. The header holds a
`caption` label and an `h3`; figures use the display face at `h1` size.

**Input.** `--radius`, 1px `line`, white. On focus the border goes `teal-brand`
and the ring appears. Errors put the message directly under the field with
`role="alert"`, never as a bare red outline.

**Table.** Header row in `surface` with `caption` type. Rows separated by
hairlines, hovered with `accent`. No zebra striping.

**Breadcrumb.** `slate-600` links, `/` separators, current segment styled by the
lime rule from 2.3.

**Empty state.** One sentence naming what would be here, and the button that
creates the first one. No illustration, no apology.

---

## 6. Motion

One orchestrated moment per screen at most. Everything else answers a user
action: open, expand, confirm.

- `150ms` for state changes, `250ms` for layout changes.
- Easing `cubic-bezier(0.32, 0.72, 0, 1)`.
- No entrance animation on cards, sections or list items.
- `@media (prefers-reduced-motion: reduce)` drops all of it to `0.01ms`.

---

## 7. Accessibility floor

Non-negotiable, and far cheaper to keep than to retrofit:

- Body text at 4.5:1 or better; large text and UI borders at 3:1 or better.
- Focus is always visible and always the teal ring. Never `outline: none`.
- Colour never carries meaning alone: the lime marker is always paired with
  `aria-current`, the error colour always with text.
- Every interactive target is at least 44x44px on touch.
- One `h1` per screen; heading levels never skip.

---

## 8. Second brand (FIA)

`<html data-brand="fia">` swaps the hue channel to engineering azure and leaves
structure, type, spacing and the lime rule untouched. When you add a colour, add
its FIA counterpart in the same commit or the second brand silently drifts.

**Exception: state colours are brand-invariant.** `--destructive` has no FIA
block today, and `--denied` (§2.4) follows the same rule on purpose: a denial
or an error is not a brand moment, so these tokens stay identical across
brands. The rule above governs interactive and structural colour, not state
colour.

---

## 9. Where this lives

- Tokens: `src/app/globals.css`, the executable version of sections 2 to 4.
- Fonts: `src/app/layout.tsx`.
- Primitives: `src/components/ui/`.

This document is the intent; `globals.css` is the enforcement. If they disagree,
the CSS is wrong.
