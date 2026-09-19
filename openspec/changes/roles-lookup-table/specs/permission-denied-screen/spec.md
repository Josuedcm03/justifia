# Permission Denied Screen Specification

## Purpose

One generic screen that tells an authenticated user they lack permission for the
page or action they tried. Any role guard MAY send a caller to it; it is not tied
to the users module or to any role. It replaces the current behaviour of bouncing
a refused caller to the dashboard root, and it offers one way back: a control that
leads to `/` (the dashboard root).

## Requirements

### Requirement: Generic screen content

The screen MUST show a clear title, a plain-language explanation that the user
lacks permission, and a way back to the dashboard. The way-back control MUST lead
to `/`. The screen MUST NOT name any specific module, page, action or role, so
that any guard can use it unchanged.

#### Scenario: Content is present

- GIVEN an authenticated user on the screen
- WHEN it renders
- THEN a title, an explanation of missing permission and a control leading to `/`
  are visible

#### Scenario: No module or role is named

- GIVEN the screen reached from the users list, from `/users/new`, and from a
  refused creation action
- WHEN the copy is compared
- THEN it is identical and contains no module name and no role name

#### Scenario: Way back leads to the dashboard root

- GIVEN a user on the screen, however they reached it
- WHEN they activate the way-back control
- THEN they land on `/`
- AND the control's destination is `/`, not the page that refused them

#### Scenario: Way back never returns to the refused page

- GIVEN a `docente` redirected from the users list
- WHEN they activate the way-back control
- THEN they are on `/` and not on the users list, so no redirect loop occurs

### Requirement: Warning-red treatment across the whole screen

The entire screen MUST be red, using the design system's destructive tokens and
not ad hoc colours. Text and the way-back control MUST meet the accessibility
floor in `docs/design-system.md` section 7 (4.5:1 for text, 3:1 for large text
and UI borders) in BOTH the light and the dark theme. Colour MUST NOT be the only
signal: the message text carries the meaning. If the existing tokens cannot meet
the floor, a token MUST be added to `docs/design-system.md` first (see open
questions).

#### Scenario: Only design-system colours are used

- GIVEN the screen's styling
- WHEN its colours are inspected
- THEN every red comes from a destructive token defined in the design system

#### Scenario: Contrast in both themes (table-driven)

- GIVEN the light theme, and separately the dark theme
- WHEN contrast is computed for body text, the title and the way-back control
  label against their backgrounds, and for the control border against its
  surroundings
- THEN text is at least 4.5:1 (large text 3:1) and UI borders at least 3:1

#### Scenario: Meaning survives without colour

- GIVEN the screen rendered without any colour
- WHEN a user reads it
- THEN the title and explanation alone state that permission is missing

### Requirement: Reached by redirect from role guards and refused actions

An authenticated caller refused by a role guard or by a refusing server check MUST
be redirected to this screen instead of the dashboard root. An unauthenticated
caller MUST be sent to login instead. This MUST hold for the users list,
`/users/new`, the staff-creation action check (a), the staff-creation action
check (b), and any future role guard.
(Previously: check (b) was not listed and was a form error.)

#### Scenario: Authenticated non-creator opens a guarded page (table-driven)

- GIVEN an authenticated `docente` or `estudiante`
- WHEN they request the users list, and separately `/users/new`
- THEN they are redirected to the permission-denied screen

#### Scenario: Refused creation action, check (a)

- GIVEN an authenticated `docente` invoking the staff-creation action
- WHEN check (a) refuses them
- THEN they are redirected to the permission-denied screen and nothing is created

#### Scenario: Refused creation action, check (b) redirects to the screen

- GIVEN a creator whose requested role is not assignable (check (b)), for
  example a `secretaria` requesting `administrador`
- WHEN the action refuses it
- THEN they are redirected to the permission-denied screen and nothing is created
- AND no form error is shown
- (Replaces "Form-level rejection is not a redirect")

#### Scenario: Ordinary validation errors do not use the screen

- GIVEN a creator submitting invalid data, role `estudiante`, or a
  `coordinacion` without a valid career
- WHEN the action rejects it
- THEN a form error is shown on the form and the screen is NOT used

#### Scenario: Unauthenticated caller

- GIVEN no session
- WHEN the caller requests a guarded page or invokes a guarded action
- THEN they are sent to login and never see the permission-denied screen

### Requirement: Reachable with a session, never a role

The screen MUST require only an authenticated session and MUST NOT itself be
guarded by any role, so a redirect to it can never loop.

#### Scenario: Any authenticated role can open it (table-driven)

- GIVEN an authenticated user of each of the five roles
- WHEN they open the screen
- THEN it renders for all of them and no further redirect occurs

#### Scenario: Unauthenticated direct visit

- GIVEN no session
- WHEN the caller opens the screen's URL
- THEN they are sent to login

### Requirement: Localised copy

All user-facing text on the screen MUST come from the i18n catalogs and exist in
both `es` and `en`.

#### Scenario: Copy in both locales (table-driven)

- GIVEN the `es` locale, and separately the `en` locale
- WHEN the screen renders
- THEN title, explanation and control label appear in that language

#### Scenario: Catalogs stay in sync

- GIVEN the `es` and `en` catalogs
- WHEN the denied-screen keys are compared
- THEN both define the same keys with non-empty values

### Requirement: Accessible structure and interaction

The screen MUST have exactly one `h1`, a meaningful document title, and a
visible keyboard focus indicator (the design system's focus ring). The way-back
control MUST be operable by keyboard and MUST be at least 44x44px on touch.

#### Scenario: Heading and title

- GIVEN the rendered screen
- WHEN its structure is inspected
- THEN there is exactly one `h1` and the document title describes the denial

#### Scenario: Keyboard operation

- GIVEN a keyboard-only user on the screen
- WHEN they tab to the way-back control and press Enter
- THEN focus is visibly indicated and they land on `/`

#### Scenario: Touch target

- GIVEN a touch viewport
- WHEN the way-back control is measured
- THEN its target is at least 44x44px

## Assumptions and open questions

- Decision (user): the way-back control leads to `/`. It does not go back in
  history and does not point at the page that refused the user.
- Decision (user): a check (b) refusal reaches this screen by redirect. Because
  the copy is generic, the user is not told that a specific role was not
  assignable; only a hand-crafted request can trigger it.
- Open (design): the route name of the screen; this spec fixes none (the proposal
  names a top-level route outside both route groups).
- Open (design): whether it renders inside the dashboard layout (with sidebar and
  header) or full-screen. "Entirely red" is read as the whole content area at
  minimum; full-screen is not assumed.
- Open (design): the screen MUST NOT appear as a sidebar item; confirm the chosen
  placement satisfies this.
- Open (design): whether the existing destructive tokens reach 4.5:1 for text on
  a red surface in both themes. The value is NOT decided here; if they cannot,
  a new token must be added to `docs/design-system.md` (and its FIA counterpart,
  per section 8) before use.
- Assumption: refused callers are not told which permission was missing.
- Assumption: an unauthenticated visitor is returned to the requested page after
  login by the existing login flow; unchanged by this change.
