# Aesthetic checklist (apply to each screenshot, per item — not a vibe check)

Do not answer "looks fine" globally. Go item by item; report pass/fail + evidence (coordinates/description) for each.

## Alignment
- All elements in a section sit on a shared vertical or horizontal grid line — no stray 1–5px offsets between sibling elements.
- Text baselines within a row align.
- Icon + label pairs are vertically centered relative to each other, not just to their container.

## Spacing
- Padding/margin values repeat a small consistent scale (e.g. 4/8/16/24/32px) — flag arbitrary values like 13px or 27px between similar elements.
- Spacing between repeated items (cards, list rows, nav items) is identical across all instances.
- Spacing above/below a heading is asymmetric in a consistent, intentional way (more space above than below) — flag if inconsistent across sections.

## Contrast & hierarchy
- Text/background contrast ratio ≥ 4.5:1 for body text, ≥ 3:1 for large text (18px+/bold 14px+) and UI components (WCAG AA). Estimate from screenshot; flag anything visually low-contrast for exact color check.
- Primary CTA is visually heavier (color/size/weight) than secondary actions on the same screen.
- Heading levels are visually distinct from each other (size/weight step, not just one).

## Consistency
- Same component type (button, input, card) has identical corner-radius, height, and shadow across the page.
- Same semantic color used consistently (e.g. one red for all error states, not two different reds).

## Overflow / breakage (hard fails, always flag)
- Text clipped/truncated without ellipsis where full content doesn't fit.
- Element overlapping another unintentionally (text over image edge, button overlapping card border).
- Horizontal scroll appearing on a page not designed for it.
- Image broken/missing (alt text box, broken icon).
- Content extending past visible viewport at the tested breakpoint.

## Responsive-specific (compare mobile vs tablet vs desktop screenshots)
- Touch targets (mobile) ≥ 24x24px.
- No element that fit at desktop width is now clipped/wrapped awkwardly at mobile width.
- Reading order (top-to-bottom) still makes logical sense at narrow width, not just visually non-broken.
