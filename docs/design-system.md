# Justifia Design System

The visual base for every screen in this project. It adopts, in full, the
Stitch design system **"Academic Governance"** (template "Justifia: Gestión
Académica Institucional"). Every value below is traceable to that source; where
we deviate, the reason is stated and the measurement is given.

**Rule of thumb:** a new screen should not introduce a colour, a font size, a
radius or a spacing step that is not in this document. If you need one, add it
here first.

---

## 1. Source of truth

| Source                                                                                            | What it gives us                                                                  |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Stitch project `projects/16844897803785859098`, design system "Academic Governance" (`DESIGN.md`) | Colour tokens, type scale, radius, spacing, elevation and component rules         |
| Stitch screen exports (login, registro, dashboards, detalle, nueva solicitud)                     | Layout, hierarchy and component styling. References, never pasted code or content |
| This repository                                                                                   | The dark theme and the FIA brand, which Stitch does not ship (see 2.2 and 8)      |

Personality: professional, institutional, authoritative. The style is
corporate and modern: clarity and functional hierarchy over decoration, white
cards on a cool page, data as the most prominent thing on screen.

### 1.1 What was retired, and why

The previous system was derived from `uam.edu.ni`. The owner replaced it with
the Stitch system; these pieces no longer exist and must not come back:

| Retired                                                                                | Replaced by                                                     | Why                                                                   |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| The dark rail: an ink `#212331` sidebar in both themes                                 | A white sidebar with a border on the trailing edge (4.2)        | Stitch treats the sidebar as a Level 1 surface, like a card           |
| The lime highlight `#d1ff30` / `#e7ff89` and its `--highlight` tokens                  | The primary colour (2.3)                                        | Stitch has one accent family; "you are here" is said with the primary |
| Libre Franklin (display) and Source Sans 3 (body)                                      | Inter for both (3.1)                                            | Stitch sets the whole product in one systematic family                |
| The UAM type scale (`h1` 50/69 … `caption`) and forced `letter-spacing: 0` on headings | The Stitch scale (3.2), with tight tracking on the display step | Same                                                                  |
| Pill buttons, 12px base radius                                                         | 8px base radius; pills for status badges only (4.1)             | Same                                                                  |
| The violet-leaning navy neutrals (`#212331` … `#dfe5e8`)                               | Cool neutral surfaces (`#f6fafb`, `#f0f4f5`, `#e2e8f0`)         | Same                                                                  |
| The two-panel auth split with an ink brand panel                                       | A centred card on the page background (4.3)                     | Follows the Stitch login and registro screens                         |

---

## 2. Colour

### 2.1 Raw palette

The Stitch values the roles in 2.2 draw from. Names are Stitch's own.

| Stitch token                    | Hex       | oklch                    | Used for                                 |
| ------------------------------- | --------- | ------------------------ | ---------------------------------------- |
| `background` / `surface-bright` | `#f6fafb` | `oklch(0.982 0.004 214)` | Page                                     |
| `surface`                       | `#ffffff` | `oklch(1 0 0)`           | Cards, sidebar, top bar                  |
| `surface-container-low`         | `#f0f4f5` | `oklch(0.964 0.004 214)` | Muted fills, table header, sidebar hover |
| `surface-container`             | `#eaeff0` | `oklch(0.949 0.006 211)` | Secondary fills                          |
| `border`                        | `#e2e8f0` | `oklch(0.929 0.013 256)` | Hairlines, card outlines                 |
| `outline-variant`               | `#bcc9ca` | `oklch(0.826 0.014 202)` | Stitch field border, deepened (see 2.2)  |
| `on-surface`                    | `#181c1d` | `oklch(0.223 0.006 214)` | Text on the page                         |
| `text-main`                     | `#1f2937` | `oklch(0.278 0.03 257)`  | Text on cards                            |
| `on-surface-variant`            | `#3d494a` | `oklch(0.395 0.016 203)` | Sidebar items, secondary labels          |
| `text-muted`                    | `#64748b` | `oklch(0.554 0.041 257)` | Not used as is, see 2.2                  |
| `primary`                       | `#006971` | `oklch(0.475 0.081 204)` | Buttons, links, active states            |
| `on-primary-fixed-variant`      | `#004f55` | `oklch(0.39 0.066 204)`  | Primary hover                            |
| `primary-container`             | `#00a6b2` | `oklch(0.661 0.113 204)` | Brand turquoise                          |
| `inverse-surface`               | `#2c3132` | `oklch(0.309 0.007 211)` | Dark theme cards                         |
| `inverse-on-surface`            | `#edf1f2` | `oklch(0.955 0.004 214)` | Dark theme text                          |
| `inverse-primary`               | `#5bd8e4` | `oklch(0.817 0.111 204)` | Dark theme primary                       |
| `error`                         | `#dc2626` | `oklch(0.577 0.215 27)`  | Error state                              |
| `on-error-container`            | `#93000a` | `oklch(0.417 0.17 27)`   | Error text on a tint                     |
| `success`                       | `#16a34a` | `oklch(0.627 0.17 149)`  | Success state                            |
| `warning`                       | `#f59e0b` | `oklch(0.769 0.165 70)`  | Warning state                            |

The neutrals are **cool, close to grey, leaning cyan** (hue ~210, chroma under
0.01). Do not reach for the old violet navy or for a warm grey.

### 2.2 Roles

The token names are the ones the components already use; only their values
changed. Contrast figures are WCAG 2 ratios measured from the values in
`globals.css`.

| Role                                | Light                     | Dark                    | Notes                                                                                          |
| ----------------------------------- | ------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------- |
| `background`                        | `#f6fafb`                 | `#181c1d`               | The page. In dark, one step below the cards                                                    |
| `card` / `popover`                  | `#ffffff`                 | `#2c3132`               | Level 1 surfaces                                                                               |
| `foreground`                        | `#181c1d`                 | `#edf1f2`               | 16.3:1 light, 15.1:1 dark on the page                                                          |
| `card-foreground`                   | `#1f2937`                 | `#edf1f2`               | 14.7:1 light, 11.6:1 dark on a card                                                            |
| `primary`                           | `#006971`                 | `#5bd8e4`               | Buttons, links, active states. White label at 6.44:1 (light); `#002023` label at 10.1:1 (dark) |
| `primary-hover`                     | `#004f55`                 | `#84f3ff`               | Darker in light. Lighter in dark, where the label is dark                                      |
| `brand-ink`                         | `#00a6b2`                 | `#5bd8e4`               | Brand turquoise. See the restriction below                                                     |
| `secondary`                         | `#eaeff0`                 | `#3a4041`               | Quiet fills, with `secondary-foreground`                                                       |
| `muted`                             | `#f0f4f5`                 | `#363c3d`               | Table header, inactive badge                                                                   |
| `muted-foreground`                  | `#5b6b82`                 | `#a9b6b8`               | Deviation, see below                                                                           |
| `accent`                            | `#e5f6f7`                 | `#1f4347`               | Menu focus, tinted buttons. `accent-foreground` at 8.4:1 / 8.5:1                               |
| `border`                            | `#e2e8f0`                 | white at 10%            | Card outlines, dividers                                                                        |
| `input`                             | `#838f90`                 | white at 40%            | Form field borders. Deviation, see below                                                       |
| `ring`                              | `#0099a5`                 | `#5bd8e4`               | Focus ring. Deviation, see below and 7                                                         |
| `destructive`, `success`, `warning` | see 2.5                   | see 2.5                 | State colours                                                                                  |
| `denied`                            | `oklch(0.505 0.196 28.8)` | `oklch(0.6 0.196 28.8)` | Accent on the permission-denied screen, see 2.4                                                |
| `sidebar`                           | `#ffffff`                 | `#2c3132`               | See 4.2                                                                                        |

**Restriction, brand turquoise.** `#00a6b2` measures 2.96:1 against white and
2.81:1 against the page. It is therefore used for tinted
icon chips (`bg-brand-ink/10` with the icon in `primary`) and for decoration
such as the dotted field behind the auth screens. It is **never a background
under white text and never a text colour**. Where Stitch draws a solid
turquoise button or a turquoise wordmark, we use `primary`.

**Deviation, focus ring and field border.** Both are UI graphics and owe 3:1
against every surface they sit on. Stitch draws the ring in `#00a6b2` (2.96:1
on white) and field borders in `#bcc9ca` (1.70:1). Each is deepened on its own
hue until it clears the floor on white, the page and the `muted` surface:

| Token   | Light value                        | White  | Page   | `muted` |
| ------- | ---------------------------------- | ------ | ------ | ------- |
| `ring`  | `oklch(0.62 0.113 204)`, `#0099a5` | 3.44:1 | 3.27:1 | 3.10:1  |
| `input` | `oklch(0.64 0.014 202)`, `#838f90` | 3.34:1 | 3.18:1 | 3.02:1  |

In the dark theme `input` is white at 40%: 3.47:1 on a card and 3.80:1 on the
page. `brand-ink` keeps the Stitch turquoise; only `ring` moved.

**Deviation, muted text.** Stitch's `text-muted` `#64748b` measures 4.53:1 on
the page but 4.30:1 on `muted` (the table header) and 4.42:1 on a hovered row.
`muted-foreground` is darkened to `#5b6b82`: 5.16:1 on the page, 5.43:1 on a
card, 4.90:1 on `muted`, 5.05:1 on a hovered row.

**The dark theme is derived.** Stitch ships light mode only. Dark is built from
its inverse tokens: `inverse-surface` for cards, `inverse-on-surface` for text,
`inverse-primary` as the interactive colour, and `on-surface` (`#181c1d`) as a
page darker than the cards. `muted-foreground` `#a9b6b8` measures 8.24:1 on the
page, 6.32:1 on a card and 5.39:1 on `muted`.

### 2.3 "You are here" is the primary colour

The position signal is said with `primary`, and it is said the same way
everywhere:

- active sidebar item: `#f0f4f5` background, primary text, bold, and a 4px
  primary bar on the leading edge (see 4.2)
- current breadcrumb segment: a 3px primary underline, the `.is-current`
  utility
- the active step in a multi-step flow and the selected tab: the same underline

It is always paired with `aria-current`, so the signal never rests on colour
alone. A collapsed sidebar group that holds the current page takes the tinted
background as a hint, but never the bar: the bar belongs to the page itself.

### 2.4 The denied accent

The permission-denied screen (`/denied`) sits on the ordinary `--background`
with `--foreground` text and the primary button, so it reads as the same
family as every other screen. Warning red appears in exactly one place: a
`bg-denied/10` circle holding a `text-denied` icon. There is no full-bleed
state surface anywhere in the app.

`--denied` is a per-theme token, like `--destructive`, because the icon must
clear the 3:1 non-text floor (§7) against a background that changes with the
theme. It stays separate from `--destructive`, which keeps carrying inline
errors, degraded-state alerts and the destructive button variant, so one token
never has to do both jobs. It has no foreground partner: the accent never
carries text.

| Theme | `--denied`                | Measured contrast on `--background`               |
| ----- | ------------------------- | ------------------------------------------------- |
| Light | `oklch(0.505 0.196 28.8)` | **6.18:1**                                        |
| Dark  | `oklch(0.6 0.196 28.8)`   | **3.96:1** (the light value measures 2.65:1 here) |

### 2.5 State colours

Success, warning and error are reserved for status badges, inline alerts and
validation messages. Each has two tokens:

| Token             | Light     | Dark                      | Job                                   |
| ----------------- | --------- | ------------------------- | ------------------------------------- |
| `destructive`     | `#dc2626` | `oklch(0.704 0.191 22.2)` | Fills, borders, icons, 8 to 20% tints |
| `destructive-ink` | `#93000a` | `#ffb4ab`                 | Text on a destructive tint            |
| `success`         | `#16a34a` | `#4ade80`                 | Fills, borders, icons, 10% tints      |
| `success-ink`     | `#116d34` | `#4ade80`                 | Text on a success tint                |
| `warning`         | `#f59e0b` | `#fbbf24`                 | Fills, borders, 10% tints             |
| `warning-ink`     | `#a14a08` | `#fbbf24`                 | Text on a warning tint                |

**Deviation, the `-ink` tokens.** Stitch writes badge and alert text in the
state colour itself over a 10% tint of it. In light mode that fails AA:
`#dc2626` on its own 8% tint measures 4.27:1, `#16a34a` on white 3.30:1 and
`#f59e0b` 2.14:1. The `-ink` shade carries the text instead: 8.27:1
(destructive), 5.78:1 (success) and 5.57:1 (warning) on their tints. In dark
mode the fills are already bright enough, so each ink equals its fill.

`warning` at 2.14:1 on white does not reach the 3:1 non-text floor either. It
never stands alone as an icon or a thin border on a light surface: pair it with
`warning-ink` text.

---

## 3. Typography

### 3.1 Families

| Role                  | Family               | Weights            | CSS var       |
| --------------------- | -------------------- | ------------------ | ------------- |
| Body, UI and headings | **Inter** (variable) | 400, 500, 600, 700 | `--font-sans` |
| Numeric / code        | Geist Mono           | 400                | `--font-mono` |

One family for everything. Hierarchy comes from size, weight and tracking, not
from a second typeface. `font-heading` exists only as an alias of the same
stack, because the shadcn primitives ask for it.

### 3.2 Scale

| Token            | Utility                         | Size / line height | Weight | Tracking | Use                                          |
| ---------------- | ------------------------------- | ------------------ | ------ | -------- | -------------------------------------------- |
| `display`        | `text-display`                  | 32 / 40            | 700    | -0.02em  | Page titles from `md`, metric figures        |
| `display-mobile` | `text-display-mobile`           | 24 / 32            | 700    | -0.01em  | Page titles below `md`                       |
| `headline`       | `text-headline`                 | 20 / 28            | 600    | 0        | Section and card headings, auth form titles  |
| `title`          | `text-title`                    | 16 / 24            | 600    | 0        | Sub-headings, card titles, emphasised values |
| `body`           | `text-base`                     | 16 / 24            | 400    | 0        | Running text                                 |
| `body-sm`        | `text-sm`                       | 14 / 20            | 400    | 0        | Table cells, controls, helper copy           |
| `label`          | `text-label`                    | 12 / 16            | 500    | 0        | Field labels, metadata                       |
| `label-caps`     | `text-label-caps` + `uppercase` | 12 / 16            | 600    | +0.05em  | Table headers, group labels                  |

A page title is written `text-display-mobile md:text-display`. Headings carry
no forced `letter-spacing`: the tracking comes from the step they use.

### 3.3 Writing rules

- Copy is written in sentence case. The only uppercase on screen is the
  `label-caps` step, applied with CSS (`uppercase`) to table headers and group
  labels; the source string stays in sentence case.
- Buttons name the outcome: "Save changes", not "Submit". The label survives
  into the confirmation: "Publish" becomes "Published".
- Errors say what happened and what to do next. They do not apologise.
- Measure: 65 to 75 characters. Use `max-w-prose` on any paragraph block.

---

## 4. Layout

### 4.1 Space and shape

Base unit **4px**, stacked on an 8px rhythm. Allowed steps:
`4 8 12 16 24 32 40 48 64`.

| Token           | Value                                         | Use                                              |
| --------------- | --------------------------------------------- | ------------------------------------------------ |
| `stack-sm`      | 8px (`gap-2`)                                 | Label to input                                   |
| `stack-md`      | 16px (`gap-4`)                                | Fields in a form                                 |
| `stack-lg`      | 24px (`gap-6`)                                | Blocks in a card, cards in a grid (the gutter)   |
| page margin     | 32px desktop (`md:p-8`), 16px mobile (`px-4`) | Around the content area                          |
| sidebar         | 260px                                         | Fixed width, see 4.2                             |
| container       | 1440px                                        | `--container-content`, the `.shell` utility      |
| `--radius`      | `0.5rem` (8px)                                | Buttons, inputs, selects, popovers: `rounded-lg` |
| next step up    | 12px                                          | Cards and panels: `rounded-xl`                   |
| `--radius-pill` | `9999px`                                      | Status badges and avatars only: `rounded-full`   |

Buttons are **not** pills. The pill shape separates "status" from "action": a
badge is round, a button is an 8px rectangle.

**Elevation** is tonal layers plus low-contrast outlines:

- Level 0, the page: `background`.
- Level 1, cards, sidebar and top bar: `card` with a 1px `border`.
- One shadow, `shadow-soft`
  (`0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)`), for
  cards and for floating surfaces (dropdowns, select popups, sheets). There is
  no second, heavier shadow.

Depth is carried by the contrast between the page and the white surfaces, so
the data stays the most prominent thing on screen.

### 4.2 The sidebar

A Level 1 surface: white with a 1px border on the trailing edge. In the dark
theme it is a dark surface level with the cards (`#2c3132`), with the same
treatment.

| State  | Light                                                                         | Dark                              |
| ------ | ----------------------------------------------------------------------------- | --------------------------------- |
| Item   | `#3d494a` on white, 9.34:1                                                    | `#bcc9ca` on `#2c3132`, 7.74:1    |
| Hover  | primary text on `#f0f4f5`, 5.81:1                                             | primary text on `#3a4041`, 6.23:1 |
| Active | `#f0f4f5` background, primary text, bold, 4px primary bar on the leading edge | Same, with the dark values        |

Rows are full-bleed (no radius) and 44px tall, so the active bar sits flush on
the edge of the sidebar. Sub-items are indented but still full-bleed, for the
same reason. The group label uses `label-caps`. The brand-dependent sidebar
tokens (`--sidebar-primary`, `--sidebar-accent-foreground`, `--sidebar-ring`)
alias the page tokens, so the FIA brand follows without a block of its own.

`aria-current="page"` marks the active link; see 2.3.

**Brand block.** The sidebar header is 64px tall, level with the top bar,
with a hairline under it: the logo at 28px, then the product name on the
`title` step in `primary`, bold. It holds nothing else.

**Identity block.** The sidebar footer, above a hairline, padded 16px: an
initials avatar (32px, a pill), the user's name on `body-sm` in semibold and
the role on the `label` step in muted text, in the user's language. Long
names truncate. It is information, not a control: it has no hover state and
no link. The user menu stays in the top bar.

### 4.3 Screen skeleton

```
+-----------+----------------------------------------------+
|  logo     |  menu · section / page        locale / theme / user  |  64px, white, hairline under
|-----------+----------------------------------------------+
|  white    |                                              |
|  sidebar  |   display title                              |
|           |   one line of muted context                  |  <- page header, 32px gap below
| | active  |                                              |
|           |   +--------+ +--------+ +--------+           |
|  260px    |   |  card  | |  card  | |  card  |           |  white on the page, 24px gutter
|           |   +--------+ +--------+ +--------+           |
|           |                                              |
+-----------+----------------------------------------------+
```

Content is left-aligned inside a 1440px container, with 32px margins on desktop
and 16px on mobile. Grids use the 24px gutter. Below `md` the sidebar becomes a
sheet opened from the top bar.

**Page context.** The leading side of the top bar names where the user is:
the section and the menu entry, taken from the navigation config
("Administration / Subjects"), on `body-sm`. The section is muted text; the
entry is `foreground` in medium weight. On a page below the entry (a create
or edit form) the entry is a link back to it. Below `md` only the entry
shows. It is orientation text, not a third "you are here" marker (2.3): it
takes neither the bar nor the underline, and it carries
`aria-current="page"` only when the entry is the page itself. The page keeps
its single `h1`.

**Page frame.** Inside the container, a screen is one vertical stack with a
32px gap: the page header, then its cards.

Centre alignment is reserved for the auth screens (sign-in, sign-up, change
password), where there is a single focal object. They stack three things on the
page background, over a dotted field of brand turquoise at low alpha
(`.auth-mesh`): the brand block (logo, product name in `primary`, tagline), the
form inside a card (`AuthCard`: 440px for sign-in and change password, wider
for sign-up) and the institution line. The permission-denied screen is centred
too, but sits directly on the page (2.4).

---

## 5. Components

**Sidebar.** See 4.2.

**Button.** 8px radius, 40px tall by default (`lg` is 44px, for touch).
Primary is solid `primary` with a white label; hover goes darker, to
`primary-hover`. Stitch hovers a turquoise button; that would put a white label
at 2.96:1, so the solid is `primary` in both states. Secondary is `outline`: a
`primary` border and label on a clear ground, hover at 5% primary. `ghost` is
transparent with a `muted` hover, for toolbar icons and quiet actions such as
"Cancel". `secondary` is a quiet neutral fill. `destructive` is a 10%
destructive tint with `destructive-ink` text. Focus is a 2px ring with a 2px
offset (see 7).

**Metric card.** A card with 24px padding: a 48px tinted icon chip
(`bg-brand-ink/10`, icon in `primary`), the label on the `label` step in muted
text, then the figure on the `display` step with `tabular-nums`. The icon is
decoration (`aria-hidden`); the label carries the meaning.

**Card.** `card` surface, 12px radius, 1px `border`, `shadow-soft`, 24px
padding. The title uses `title`, or `headline` when the card is the main object
of the screen.

**Table.** Header row on `muted` with `label-caps` uppercase headers in muted
text. Horizontal dividers only, no vertical rules, no zebra striping. Cells are
padded 24px / 16px. Row hover is `primary` at 5%. The table sits in a card
frame (12px radius, 1px border, clipped). The row hover tint is instant; it
does not animate.

**Table card.** A list is one card (12px radius, 1px border, `shadow-soft`,
clipped) with up to three regions divided by hairlines. The toolbar, padded
24px / 16px, holds the search form, the status filter and the result count;
it wraps on narrow screens. The table follows, edge to edge. The footer,
padded 24px / 16px, holds the pagination. Controls inside keep their own 8px
radius: the inset is not even on both axes, so the surfaces are not
concentric. While new rows load, the card is `aria-busy`, the rows dim to
60% opacity and the count reads "Updating…".

**Sortable header.** A sortable column header is a button inside the header
cell, at least 44px tall, with the column label on `label-caps` and a
direction icon: up, down, or a muted double chevron when the column is not
the sorted one. The icon is the only visual indicator: no state text sits
beside it, and the icon itself is decoration. The state is exposed through
`aria-sort` on the header cell (set only on the sorted column) and through the
button's description, so it never relies on colour alone. The button's
accessible name stays exactly the column label. Pressing it sorts ascending,
pressing again reverses. One column is sorted at a time. The change is instant: nothing animates.

**Loading skeleton.** While a screen loads, its shape is drawn in `secondary`
blocks on the page frame: a title bar, one line of context and a table card
with five rows. The home has its own skeleton (`(dashboard)/(home)/loading.tsx`)
that draws the title bar, the subtitle line, two count cards and four shortcut
cards in the same responsive grid. Both are `aria-busy` and names itself for assistive technology.
The pulse is the only movement and stops under reduced motion.

**Route error.** When a screen fails unexpectedly: one heading, one sentence
saying what to do, a primary "Try again" button, a link to the dashboard and
a reference code in muted text. No stack trace, no technical message, no
apology. A list that fails to load is not this state; it keeps the degraded
alert.

**Shortcut card.** A card that is a link: the tinted icon chip of the metric
card, a title on the `title` step and one muted sentence. Hover is `primary`
at 5%, on hover-capable pointers only; focus is the ring of 7.

**Badge.** A pill: `rounded-full`, 12px medium text, a 10% tint of the state
colour with the matching `-ink` text (2.5). A neutral or inactive badge is
`muted` with `muted-foreground`.

**Form.** Label above the input, on the `label` step in `foreground`, 8px
apart. Inputs and selects are 40px tall, 8px radius, with a 1px `input` border
on the `card` surface. On focus the border goes `primary` and the `ring`
glows around it. Errors put the message directly under the field or the form
with `role="alert"`, never as a bare red outline.

**Alert.** A slim banner: an 8% tint of the state colour, a 1px border of it
at 30%, a solid 4px edge on the leading side, text in the `-ink` shade.

**Two-step confirmation (inline).** For a reversible mutation such as
deactivating a catalog record, no dialog is used. The control sits in the page
(a status pill and one button). The first step is the `secondary` button
variant. Pressing it reveals, in place, one sentence that names the record and
states what happens and that it can be undone, then a confirm button and a
cancel. Only the confirm uses `destructive`; cancel is `ghost`. All three are
`lg` (44px). Focus moves to the confirm; cancel (or an answer) returns it to the
first step. The outcome is written as text in an `aria-live="polite"` region
that stays mounted, so it is never conveyed by colour alone. The control is a
form POST, never a link. Reversing it (reactivating) is a single press. No new
token or primitive.

**Breadcrumb.** Muted links that go `primary` on hover, chevron separators,
current segment styled by the rule in 2.3.

**Pagination.** In the footer of the table card. Real links, 44px tall, 8px
radius, `primary` text with a 5% primary hover: first, previous, next, last.
At an edge the control is muted text with `aria-disabled`. Between them, the
page status ("Page 2 of 7"). A rows-per-page select (10, 25, 50), styled as a
form select at 44px, sits on the leading side. Changing the search, the
filter, the sort or the page size returns to page 1. The footer is omitted
when the list fits in the smallest page size.

**Dropdown, select popup, sheet.** `popover` surface, 8px radius, 1px
`border`, `shadow-soft`. Items highlight with the `accent` pair.

**Combobox.** For a choice among tens to thousands of options, where a plain
select list cannot be scanned. A text input that filters the options as the
user types, styled exactly like the form input (40px, 8px radius, 1px `input`
border, the `primary` border and `ring` on focus, a muted chevron as decoration
only). The popup is the dropdown surface above, as wide as the input, with
44px-tall options and the `accent` pair on the highlighted one; the chosen
option carries a check. When nothing matches, one muted sentence replaces the
list. When the option list was cut at its cap, one muted `text-xs` line under
the input says so, and it is part of the input's `aria-describedby`. It is
labelled and described by the Form pattern, and it submits the chosen option's
id through a hidden field, never its text. Keyboard: ArrowDown opens and moves,
Enter chooses, Escape closes. No new token.

**Checkbox group.** For a small fixed set of independent options, such as the
meeting days of a group. A `fieldset` whose `legend` is the field label, on the
`label` step in `foreground`. The options are native checkboxes, 20px, tinted
`primary` (`accent-color`), each inside a label at least 44px tall so the whole
row is the target. The state is the checkbox's own check mark, a shape, never a
colour. The hint and the error sit under the group as in Form: the error has
`role="alert"` and both are tied to the `fieldset` by `aria-describedby`. The
`fieldset` is not marked `aria-invalid` or `aria-required`, so the requirement
goes in the hint. The optional `disabled` prop sets the native attribute on the
`fieldset`, which disables every checkbox (a locked form). Focus is the ring of
7. No new token.

**Empty state.** One sentence naming what would be here, and the button that
creates the first one. No illustration, no apology. **No results** is its
second form, shown when a search or a filter matches nothing: a sentence
naming the term or the filter, a hint, and always a link that clears it.

---

## 6. Motion

One orchestrated moment per screen at most. Everything else answers a user
action: open, expand, confirm.

- `150ms` for state changes, `250ms` for layout changes.
- Easing `cubic-bezier(0.32, 0.72, 0, 1)`.
- No entrance animation on cards, sections or list items.
- `@media (prefers-reduced-motion: reduce)` drops all of it to `0.01ms`.
- Hover styling applies on hover-capable pointers only.
- A transition names the properties it changes; never `all`.
- Row hover, sorting, paging and filtering do not animate. A table that is
  waiting for rows dims by opacity over `150ms`; opacity is the only
  property that moves.
- No press scale on buttons.
- Motion is never the only signal: a changed state also changes text, an
  icon or an ARIA state.

---

## 7. Accessibility floor

Non-negotiable, and far cheaper to keep than to retrofit:

- Body text at 4.5:1 or better; large text and UI graphics at 3:1 or better.
  The figures in section 2 are measured, not estimated; re-measure when a token
  changes.
- Focus is always visible. Never `outline: none` without a ring in its place.
  The ring is `--ring`, a deepened brand turquoise that measures 3.44:1 on
  white and 3.27:1 on the page in the light theme (2.2). Controls that have a
  border also switch it to `primary` on focus (6.44:1 on white). In the dark
  theme the ring is `#5bd8e4`, 7.8:1 or better.
- Colour never carries meaning alone: the "you are here" marker is always
  paired with `aria-current`, a state colour always with text.
- White text never sits on the brand turquoise (2.2).
- Every interactive target is at least 44x44px on touch.
- One `h1` per screen; heading levels never skip.

---

## 8. Second brand (FIA)

`<html data-brand="fia">` swaps the hue channel to engineering azure and leaves
structure, type, spacing and every rule above untouched. The FIA palette keeps
the lightness steps of the default one and moves the hue from 204 to about 255:

| Role            | Light                                          | Dark                                         |
| --------------- | ---------------------------------------------- | -------------------------------------------- |
| `primary`       | `oklch(0.475 0.15 255)`, white label at 6.76:1 | `oklch(0.817 0.1 250)`, dark label at 9.81:1 |
| `primary-hover` | `oklch(0.39 0.13 257)`                         | `oklch(0.902 0.06 250)`                      |
| `brand-ink`     | `oklch(0.661 0.14 250)`                        | `oklch(0.817 0.1 250)`                       |
| `ring`          | `oklch(0.64 0.14 250)`, 3.35:1 on white        | `oklch(0.817 0.1 250)`                       |
| `accent`        | `oklch(0.961 0.02 255)`                        | `oklch(0.358 0.06 258)`                      |

Neutrals, surfaces and the sidebar surface are shared. When you add a
brand-dependent colour, add its FIA counterpart in the same commit or the
second brand silently drifts.

**Exception: state colours are brand-invariant.** `--destructive`, `--success`,
`--warning`, their `-ink` partners and `--denied` (§2.4) have no FIA block on
purpose: a denial or an error is not a brand moment, so these tokens stay
identical across brands. The rule above governs interactive and structural
colour, not state colour.

---

## 9. Where this lives

- Tokens: `src/app/globals.css`, the executable version of sections 2 to 4.
- Fonts: `src/app/layout.tsx`.
- Primitives: `src/components/ui/`.

This document is the intent; `globals.css` is the enforcement. If they disagree,
the CSS is wrong.
