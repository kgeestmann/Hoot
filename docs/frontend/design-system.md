# Design system

How Hoot looks and why. The binding rules (and their sources) are in [../specs/design-rules.md](../specs/design-rules.md); this page is the practical guide for building UI.

## Principles

- **Angular Material first.** Build from Material components (lists, menus, chips, checkboxes, tabs, cards, buttons, icons) rather than plain HTML elements with custom CSS. They bring keyboard handling, focus, touch targets, accessibility and dark mode.
- **Tokens, never raw values.** Colours, font sizes, corners, elevation and spacing come from the Material 3 tokens (`--mat-sys-*`) and Hoot's tokens (`--hoot-*` in `src/styles.css`).
- **Never colour alone.** Every state also has an icon or a word.
- **No emojis** anywhere (UI, code, docs): they look different on every system, ignore the theme colours and get read out by screen readers. Use an icon.
- **One language:** English, GitHub's own vocabulary.

## Theme

An Angular Material 3 theme built from the brand orange `#fea034` (primary) and its complementary blue `#3492fe` (tertiary).

| File | Holds |
| --- | --- |
| `src/_theme-colors.scss` | Tonal palettes from Angular Material's theme-color schematic. Don't edit by hand; rerun it (command below). |
| `src/material-theme.scss` | Applies the palettes and emits the `--mat-sys-*` tokens; colours the filled button brand orange with dark text. |
| `src/styles.css` | Hoot's own tokens and global styles. |

```
cd frontend
npx ng generate @angular/material:theme-color --primary-color="#fea034" --tertiary-color="#3492fe" --directory=src/ --is-scss=true --include-high-contrast=false
```

## Colour

| Use | Token |
| --- | --- |
| Surfaces, text, borders | `--mat-sys-surface*`, `--mat-sys-on-surface*`, `--mat-sys-outline*` |
| Bright orange **fill** (filled button, active nav item, avatar, logo tile) | `--hoot-brand` with `--hoot-on-brand` text. Never white text on it, never orange text on white. |
| Orange **text and icons** | `--mat-sys-primary` |
| Focus ring | `--hoot-focus-ring` (tertiary blue) |
| GitHub states | `--hoot-status-success`, `--hoot-status-danger`, `--hoot-status-neutral` |
| Errors | `--mat-sys-error`, `--mat-sys-error-container` |
| GitHub labels | GitHub's own colour, with dark or white text by contrast (`item/label-colors.ts`) |

Proportions: about 60 % neutral surfaces, 30 % neutral structure, 10 % orange. Blue is only for focus, links and information.

Status colours stay GitHub's meanings: success green, failure red, pending and draft grey (GitHub's amber is too close to the brand orange). Each status chip has an icon (`check`, `close`, `schedule`) and text.

### Dark mode

Hoot follows the system setting (`color-scheme: light dark`). Every `--mat-sys-*` colour has a light and a dark value. A new Hoot colour token needs both, written as `light-dark(light, dark)`, with contrast checked in both modes, e.g. `--hoot-status-success: light-dark(#1a7f37, #3fb950)`.

Contrast: text at least 4.5:1, large text and UI components at least 3:1.

## Type

Roboto, self-hosted via `@fontsource/roboto` (no Google Fonts or other CDN). Only the Material 3 type scale: `font: var(--mat-sys-title-large)`, `--mat-sys-body-medium`, `--mat-sys-label-large`, … No ad-hoc font sizes.

Each page has exactly one `h1`: the route's title in the top bar. Sections and cards use `h2`.

## Spacing and shape

- Spacing: `--hoot-space-N` is N × 4 px (`-1` 4 px, `-2` 8 px, `-3` 12 px, `-4` 16 px, `-6` 24 px, `-8` 32 px, `-10` 40 px). Also used for icon sizes.
- Corners: `--mat-sys-corner-*` (`small` for every box: controls, cards, panels, skeletons and error messages; `full` for pills such as counts).
- Elevation: Material levels 0–2 only.
- Separation: boxes stand out by a background step, not by a border. Cards are `appearance="filled"` on `--mat-sys-surface-container-low` (set in `material-theme.scss`), and lists of items (`item-panels`, the team view's lists) use the same layer with no lines or shadows between items: their spacing separates them. CI and review status show as an icon and a word in their colour, without a pill; only GitHub's labels are filled pills. The top bar has no line under it either. The sidebar is set apart by its own background, and its sections by space instead of lines. Stroked buttons keep their outline; the toolbar controls have none (see Buttons).
- Pages have a maximum content width: 960 px for the overview, list pages and team view, narrower (420–720 px) for single-card pages.
- Motion: `--hoot-transition` (150 ms), turned off with `prefers-reduced-motion`. Everything clickable answers the pointer without lifting (design rule 4): a fill on hover, Material's ripple on buttons and list rows, and a step darker fill on press. The overview tiles also give way a little when pressed (`scale(0.98)`), and a tile's chevron moves 4 px towards where it leads on hover.

## Buttons

| Kind | Material | Use |
| --- | --- | --- |
| Primary | `mat-flat-button` | At most **one** per view; brand orange with dark text |
| Secondary | `mat-stroked-button` | Other actions, menu triggers |
| Tertiary | `mat-button` | Low-emphasis links such as *Show all* |
| Icon only | `mat-icon-button` with an `aria-label` | Refresh, menu |
| Toolbar control | `mat-button` with the global class `hoot-chip` | Controls in the top bar that filter or change the view: the filter menus, *Sort*, *Group* |

Toolbar controls are quiet text buttons, like GitHub's filter row: 32 px high (the touch target stays 48 px), small corners, a grey label and no outline at rest, a fill on hover and a ripple on click, no orange. While a control narrows the list, changes the view from its default or is switched on, add `hoot-chip-selected`: it fills with `--mat-sys-secondary-container`, and its label or accessible name says the state ("Owner: 2 of 3", "Sort: Oldest first"), or a toggle swaps its leading icon for `check` and sets `aria-pressed`. A toggle keeps a leading icon in both states, so it doesn't change width when clicked.

## Icons

Material Symbols Outlined (weight 400, 24 px) as SVG paths in `icons.ts`, used as `<mat-icon svgIcon="inbox" />`. No icon font. To add one, copy its path from [google/material-design-icons](https://github.com/google/material-design-icons) into `ICON_PATHS`; `src/test-providers.ts` registers them for every spec.

`styles.css` renders the SVG inside every `mat-icon` as a block. Inline, an SVG sits on the text baseline and shows above the centre of buttons and chips.

Decorative icons next to text need no label; an icon that is the only content of a button needs an `aria-label` on the button.

## Logo

An outline owl (V-shaped brow, two eyes, beak) on the 24 px grid with a 2 px stroke, like the Material Symbols. The same drawing exists in four places; change them together:

| Where | Form |
| --- | --- |
| `icons.ts` (`LOGO_SHAPES`) | The icon `hoot` in `currentColor`, shown in `--mat-sys-primary` in the sidebar header and on the sign-in card |
| `frontend/public/favicon.svg` | The favicon, with primary tone 40 on light and tone 80 on dark tab bars (`prefers-color-scheme`) |
| `frontend/public/favicon.ico` | 16, 32 and 48 px fallback for browsers without SVG favicons |
| `docs/logo.svg` | The app tile (dark owl on the brand orange) at the top of the README |

`docs/social-preview.png` (1280 × 640) is built from the tile and uploaded by hand under the repo's *Settings → General → Social preview*; GitHub has no API for it.

## States

Every view that loads data has:

- **Loading:** a skeleton in the shape of the content (`layout/list-skeleton`)
- **Empty:** a sentence that says what's missing, per list
- **Error:** `layout/load-error` with what failed and *Try again*
- **Refreshing:** current content stays, with a thin progress bar (`refresh-status`)

## Layout

- From 840 px wide the sidebar stays open beside the content; below, it's a drawer behind a menu button in the top bar.
- Material list rows only project their direct children: put `item-meta` and `item-chips` inside the row's `matListItemLine`s.
- Touch targets at least 48 × 48 px; a visible focus ring on everything interactive.
