# Exam Rating Page — Transitions & Animations

## 1. Card → Detail "bubble expand" transition
When a part card is clicked, a dark overlay panel grows from the exact
position/size of the clicked card until it fills the content area of the
bordered main block (never exceeding its border).

- Properties animated: `top`, `left`, `width`, `height`
- Duration: 480ms
- Easing: `cubic-bezier(.22,.61,.36,1)` (fast start, gentle settle)
- Trigger: on click, overlay is mounted at the card's rect (no transition),
  then on the next animation frame its target rect is set to the full
  content area, which animates via the properties above.
- Reverse (closing / "Back to overview"): same properties/duration, animating
  back from full-size to the original card rect.

## 2. Staggered "bubble" content reveal (top → bottom)
Detail-view content does **not** fade in all at once — it is split into four
groups, revealed in sequence from top to bottom, only once the expand
transition above has fully completed:

1. "← Back to overview" link
2. Tag + title + description block
3. Rating selector (label + 10 circles)
4. Submit button + "Selected: x/10" row

Each group animates independently:
- `opacity`: 0 → 1, 240ms ease
- `transform`: `scale(0.8)` → `scale(1)`, 420ms `cubic-bezier(.34,1.56,.64,1)`
  (overshoot curve — gives the "bubble pop" feel)
- Stagger: each group's transition-delay = `index * 100ms` (0, 100, 200, 300ms)

On close, all groups hide instantly (120ms linear fade + scale down, no
stagger) so the content disappears before the panel starts shrinking.

## 3. Rating circle pop-in (nested stagger)
Within group 3, the ten 1–10 rating circles pop in individually rather than
as one block:
- Same scale/opacity bubble curve as above
- Per-circle delay: `200ms + i * 26ms` (i = circle index 0–9), continuing the
  top-to-bottom cascade down into the circle row itself
- Hidden instantly (no stagger) when the detail view closes

## 4. Selection & hover micro-transitions
- Rating circle selection (fill color, border color): `150ms` linear
- Part card hover background: `200ms`
- Submit / "Submit rating" button hover background: `150ms`
- Back-link hover color: `150ms` (implicit color transition)

## 5. Submit button label swap
Clicking the header "Submit" button swaps its label to "Sent" for 1.6s, then
reverts — a simple state-driven text change, no animated transition.
