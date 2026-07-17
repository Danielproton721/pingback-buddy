---
name: apple-design
description: Apple's approach to interface design and fluid, physical motion, translated for the web. Use when building or reviewing gesture-driven UI, spring animations, drag/swipe/sheet interactions, momentum and interruptible transitions, translucent materials and depth, typography (optical sizing, tracking, leading), reduced-motion, or the design foundations (feedback, spatial consistency, restraint) behind Apple-style interfaces.
---

# Apple Design

How Apple builds interfaces that stop feeling like a computer and start feeling like an extension of you. From Apple's WWDC design talks — chiefly *Designing Fluid Interfaces* (WWDC 2018) — translated into the web platform (CSS, Pointer Events, `requestAnimationFrame`, spring libraries like Motion/Framer Motion).

The through-line: **an interface feels alive when motion starts from the current on-screen value, inherits the user's velocity, projects momentum forward, and can be grabbed and reversed at any instant.** Springs make this natural, because they are interruptible and velocity-aware.

Apple frames design as serving four human needs: **safety/predictability, understanding, achievement, and joy.**

## 1. Response — kill latency
- Respond on pointer-**down**, not on release. Highlight a button the instant it's pressed.
- Audit every latency: debounces, timers, transition waits, the ~300ms tap delay.
- Feedback must be continuous **during** the interaction (drag/slider/drawer update 1:1), not only at the end.

## 2. Direct manipulation — 1:1 tracking
- Dragged content stays glued to the finger and respects the grab offset (never snap to center on grab).
- Use Pointer Events + `setPointerCapture` so tracking continues outside bounds.
- Track a short velocity/position history for release velocity.

## 3. Interruptibility — the most important principle
- Every animation must be interruptible/redirectable at any moment; never lock out input during a transition.
- Always animate from the **presentation (current) value**, never the target — read the live transform on interrupt to avoid jumps.
- Avoid CSS transitions/`@keyframes` for gesture-driven motion; springs animate from current value by default.
- On reversal, blend velocity (don't hard-cut). Decompose 2D motion into independent X and Y springs.

## 4. Behavior over animation — use springs
Two designer params: **damping ratio** (overshoot; 1.0 = no bounce) and **response** (speed to target, seconds — not "duration").
- Default most UI to **damping 1.0** (critically damped).
- Add bounce (**damping ~0.8**) ONLY when the gesture carried momentum (flick/throw/drag release).

| Interaction | Damping | Response |
| --- | --- | --- |
| Move / reposition | 1.0 | 0.4 |
| Rotation | 0.8 | 0.4 |
| Drawer / sheet | 0.8 | 0.3 |

Motion/Framer: `bounce` + `duration` maps to damping + response. House style: `bounce: 0` by default; reserve bounce for momentum interactions.

## 5. Velocity handoff
On gesture end, continue the animation at the finger's exact velocity (no seam). Pass release velocity as the spring's initial velocity; normalize if the API wants relative: `gestureVelocity / (target − current)`.

## 6. Momentum projection
Don't snap to nearest boundary from the release point — project the resting position from velocity, then snap to the nearest target:
`project(v) = (v/1000) * d / (1 − d)`, `d ≈ 0.998`. `target = nearestSnapPoint(current + project(v))`.

## 7. Spatial consistency
- Enter and exit along the **same path** (in-from-right → out-to-right).
- Anchor interactions to their source: `transform-origin` at the trigger (menus/popovers/sheets grow from the button).
- Mirror easing on reversible transitions.

## 8. Hint in the direction of the gesture
Intermediate motion telegraphs the outcome — grow toward the finger.

## 9. Rubber-banding
At edges, resist progressively instead of hard-stopping.
`rubberband(x, dim, c=0.55) = (x*dim*c)/(dim + c*|x|)`.

## 10. Gesture details
- Tap: highlight on down, commit on up; ~10px hit padding; cancel-by-drag-away.
- Drag/swipe: ~10px movement threshold before committing a direction, then 1:1.
- Detect plausible gestures in parallel from the first move; avoid final-only recognizers.

## 11. Frame-level smoothness
Keep per-frame change below perception threshold; motion-blur very fast motion; animate only `transform`/`opacity`; hint with `will-change`.

## 12. Materials & depth
- Nav/toolbars/sheets = translucent layers (`backdrop-filter: blur()` + semi-transparent bg) with content scrolling under.
- Material weight encodes hierarchy; never stack a light translucent surface on another.
- Bigger surfaces read thicker (stronger blur + deeper shadow).
- Dim to focus (modal + scrim), separate to keep flow (panel + translucency, no scrim).
- Vibrancy: over translucent surfaces use higher-contrast, slightly heavier text + small letter-spacing bump.
- Scroll edge effects (fade mask) instead of hard 1px dividers.
- Materialize: animate blur radius + scale together on enter/exit.

## 13. Multimodal feedback
Causality (obvious cause), Harmony (visual + sound + haptic on the same frame), Utility (only meaningful moments).

## 14. Reduced motion & accessibility
- `prefers-reduced-motion: reduce` → cross-fades/static instead of slides/springs; drop overshoot.
- `prefers-reduced-transparency: reduce` → frostier/solid surfaces (raise bg opacity, drop blur).
- `prefers-contrast: more` → near-solid backgrounds + defined contrasting border.
- Avoid full-viewport moving backgrounds and slow ~0.2Hz loops; ease brightness/theme changes.

## 15. Typography
- Tracking (letter-spacing) is size-specific: large display wants **negative** tracking (`-0.02em`); body near `0`; small text slightly positive.
- Leading tracks size inversely (tight on headings, looser on body).
- Hierarchy = weight + size + leading as a set.
- Scale layout with text (`rem`/`em`, not fixed px); respect Dynamic Type.
- Default to the platform system font.

## 16. Design foundations — the eight principles
Purpose, Agency, Responsibility, Familiarity, Flexibility, Simplicity (not minimalism), Craft, Delight.
- Feedback kinds: status, completion, warning, error.
- Wayfinding: every screen answers where am I / where can I go / what's there / how do I get out.
- Grouping & mapping: place a control near what it affects.
- Direct, specific labels beat generic ones.

## 17. Process
Prototype interactively; design interaction and visuals together; test with real people and review motion frame-by-frame.

## Quick Reference
| Need | Technique | Value |
| --- | --- | --- |
| Default UI spring | Critically damped | `damping 1.0`, `response 0.3–0.4` (Motion: `bounce 0`, `duration 0.3–0.4`) |
| Momentum spring | Slight bounce | `damping ~0.8` (Motion: `bounce ~0.2`) |
| Interrupt cleanly | Start from presentation value | read live transform |
| 1:1 drag | Pointer Events + capture | respect grab offset |
| Feedback | On pointer-down, continuous | never only at end |
| Boundary | Rubber-band | progressive resistance |
| Translucent chrome | `backdrop-filter` layer | content scrolls under |
| Type tracking | Size-specific | tighten large (`-0.02em`), body `0` |
| Reduced motion | Cross-fade, not slide/spring | `@media (prefers-reduced-motion)` |
