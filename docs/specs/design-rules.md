# Design rules

From #55, with the decisions taken while building it. The practical guide (tokens, components, how to apply these) is [../frontend/design-system.md](../frontend/design-system.md).

Sources: CareerFoundry's *10 Common UI Design Mistakes (and How to Avoid Them)*; Dix, Finlay, Abowd, Beale, *Human-Computer Interaction* (learnability, flexibility, robustness); WCAG 2.2; the Material 3 guidelines (type scale, elevation, breakpoints).

## Palette

The brand orange `#fea034` (hue 32°, saturation 99 %, lightness 60 %) and its exact complement `#3492fe` are the source colours of an Angular Material 3 theme.

| Role | Colour | Contrast | Use |
| --- | --- | --- | --- |
| Brand orange | `#fea034` (`--hoot-brand`) | 2.0:1 on white, 8.4:1 with its dark text | Fills only: filled button, active nav item, avatar, logo tile. Always with dark text (`--hoot-on-brand`), never white text, never as text on white. |
| Orange text and icons | `--mat-sys-primary` (`#8b5000` light) | 6.5:1 on the light surface | Orange text and icons |
| Focus ring and links | tertiary `#005eb1` | 6.5:1 | `#3492fe` itself is only 2.99:1 on the warm surface, below the 3:1 a focus indicator needs; it stays for fills with dark text |
| Neutrals | M3 neutral palette | | Backgrounds, surfaces, borders, body text |
| Error | M3 error palette | ≥ 4.5:1 | Errors only, always with an icon and text |

**Proportions (60-30-10):** about 60 % neutral surfaces, 30 % neutral structure (text, borders, cards), 10 % orange. Blue is the spice (focus, links, information), never a second primary colour: two saturated complementary colours at equal weight vibrate against each other.

**Status colours stay separate from the brand** and keep GitHub's meanings: open and passing green, closed and failing red, draft grey. GitHub's amber for "pending" (`#bf8700`) is too close to the brand orange, so pending is grey with a progress icon.

## Rules

1. **Consistency:** one corner scale, one spacing scale (4 px steps), one font (Roboto), one icon style (Material Symbols Outlined, one weight). Every exception needs a reason.
2. **Clear action hierarchy:** at most **one** filled orange (primary) button per view. Secondary actions are outlined, tertiary ones text buttons. Destructive actions are red and ask for confirmation.
3. **Text hierarchy:** only the Material 3 type scale, no ad-hoc sizes. Each page has one title, and spacing groups related content.
4. **Subtle elevation:** Material elevation levels 0–2 only; no layered custom shadows, no hover lift.
5. **Contrast:** text at least 4.5:1, large text and UI components at least 3:1, in light and dark mode.
6. **Never colour alone:** every state also has an icon or a text label (status chips, form errors, CI results).
7. **Helpful errors** that say what to do, in place ("Can't reach Hoot's server. Check your connection and try again."). A network error is told apart from a server or GitHub error.
8. **Visibility of system status:** every data view has loading (skeleton), empty and error-with-retry states.
9. **Touch targets** of at least 48 × 48 px, and a visible focus ring on everything interactive.
10. **Alignment:** content has a fixed maximum width, and labels and values line up.
11. **Motion:** short transitions (150–200 ms), turned off with `prefers-reduced-motion`.

## Decisions

- **Language:** English only, GitHub's own vocabulary (pull request, review, mention).
- **Dark mode:** follows the system setting; every colour has a light and a dark value.
- **Fonts and icons are self-hosted.** Loading them from Google's CDN sends every visitor's IP address to Google, which LG München (January 2022) ruled a GDPR violation without consent.
- **Angular Material components** instead of custom-styled HTML elements (#99), for focus handling, touch targets, accessibility and dark mode.
- **No emojis** in the UI, code or docs: they look different on every system, ignore the theme colours and get read out by screen readers. Icons instead.
