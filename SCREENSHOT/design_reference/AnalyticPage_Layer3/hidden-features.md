# Hidden Features — Analytics Prototype

Features present in code that are not visually obvious from the UI alone.

1. **Filter placeholder vs. real default** — The filter dropdown shows the word "Filter" until the user makes a selection, but data defaults to "Month" underneath the hood before any interaction. The displayed label and the active data range are decoupled (`filterTouched` state).

2. **Cursor-following tooltip** — Hovering anywhere inside a bar-chart column's hit area tracks the live mouse position (`onMouseMove`) and repositions the tooltip in real time, rather than snapping to a fixed anchor point per bar.

3. **Automatic "needs review" flag** — Any subject whose accuracy (correct / (correct+wrong)) drops below 75% is automatically tagged "NEEDS REVIEW" under its bar. This threshold and the flag itself are computed, not manually set per subject, and can be toggled off via the `highlightWeakest` tweak.

4. **Adaptive Y-axis scale** — The bar chart's max gridline value is computed per time range via a "nice number" rounding function (`niceCeil`), so switching Week/Month/All keeps gridlines at clean round numbers instead of scaling to the raw max.

5. **Per-subject fixed color mapping** — Each subject has a hardcoded, stable color (Math=lacquer red, English=green, Physics=blue-gray, etc.) defined in a lookup table, so a subject keeps the same color across tab switches and filter changes — it isn't reassigned by rank/position.

6. **Donut highlight count tweak** — A hidden prop (`donutHighlightCount`, default 1) controls how many top subjects render at full opacity vs. the rest — currently all render at full opacity (opacity dimming was removed per feedback), but the plumbing to re-enable a "top N highlighted" treatment still exists.

7. **Bar-chart hover dimming** — Hovering one subject's bar group fades all other groups to 35% opacity to focus attention, with a 200ms transition — not obvious until you hover.

8. **Simulated dataset, three time buckets** — Week/Month/All-time each have independent hardcoded correct/wrong/session-count arrays (not derived from one dataset via scaling), so numbers are internally consistent per range rather than extrapolated live.
