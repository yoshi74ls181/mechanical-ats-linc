# Slide animations — ATS and LINC

Two cut-down versions of the top-level animation for dropping onto PowerPoint slides.
Each shows **one** element, and of that only the pendulum, the `U(φ)` plot and the `φ(t)`
plot, **stacked vertically** as a 2:3 portrait column. No second panel, no circuit
schematic, no Taylor-coefficient table, no control bar, no `m₁`/`m₂` labels.

|  | `ats-slide.html` | `linc-slide.html` |
|---|---|---|
| bias `σ` | `π/2` — loop fluxes `(π, 0)` | `0` — loop fluxes `(π/2, π/2)` |
| beam | vertical | horizontal see-saw |
| pump depth `ε` | 0.2 | 0.2 |
| damping `ζ` | 0.05 (Q = 10) | **0.02** (Q = 25) |
| signal drive | 0 | **0.2** |
| imbalance | 0 | 0 |
| pump-sector label | `π + φ_in` | `π + φ_pump` |
| pump frequency | `1 × f` — resonant force | `2 × f` — degenerate parametric |
| protected channel | `C ≡ 0` — Kerr-free | `S ≡ 0` — parity protected |
| peak `φ` | **1.101 rad** = 0.70 × π/2 | **1.370 rad** = 0.87 × π/2 (cut mid-ring-up) |
| mode time per run | 60 s | **108 s** |
| video length | 18 s | 18 s |

Both differ from the top-level animation in three ways, deliberately:

- **The centre of mass is drawn true to scale.** The masses sit at `R_ARM = 1`, drawn `R`
  px from the pivot, so the COM is exactly `(C, S)/Σm · R` px — no fudge factor, where
  `index.html` inflates it about 3× via `tanh(4.4·v/Σm)·R·0.78`. Peak excursion is
  `sin(ε) = 0.199` arm lengths.
- **`φ(t)` is in radians, ticked at `±π/4` and `±π/2`**, and has no envelope curve — the
  min/max band's own outline reads as the envelope. Both pages use the identical range,
  `1.3·(π/2)`, so the two plots can be read directly against each other.
- **The pump sector is labelled** (`π + φ_in` / `π + φ_pump`), and the rotor angle is not labelled
  at all. The label sits on the sector's bisector, which is the bias axis, so it lands at
  the open end of the pink dashed line just past the arc at `0.62R`. The arms are at
  `φ + σ ± δ` with `δ ≈ π/2`, so that direction stays ~90° from *both* arms at all times
  and an arm can never run over the label. It does lie on the bias axis, so `sym()` grew
  an optional white knockout halo that cuts a gap in whatever passes under it, plus a
  `romanSub` option for upright `\mathrm{}` subscripts.
- **The pump-off reference in `U(φ)` is the fixed `ε = 0` potential**, `κφ²/2`. For the
  ATS that equals `index.html`'s `κφ²/2 − gC` since `C ≡ 0`, but for the LINC it must not:
  there `C` *is* the pumped quantity, and subtracting the live `C` would draw a reference
  parabola bobbing along with the pump instead of the fixed curve it is measured against.

### The sector bug (fixed here and in `index.html`)

`wedge()` used to draw "whichever of the two complementary sectors is smaller". The sector
between the arms spans `2δ` with `δ = π/2 + ε sin(ω_p t)`, so `2δ` crosses `π` twice per
pump period — and that rule makes the sector **jump to the opposite half-plane** every time
it does, roughly 19 times per ATS run. It went unnoticed because nothing was attached to
the sector; it is fatal once the sector *is* the pump and carries a label.

`wedge()` now takes an explicit sweep direction, and the pump sector pins itself to the
between-arms one, whose bisector is always the bias axis. **The same fix is applied in
`index.html`**, where the mode-angle wedge also now passes `ccw = φ < 0` — identical to the
old behaviour while `|φ| < π`, and still correct past it, which a deep pump at low damping
does reach.

Verified rather than assumed: `wedgetest.js` drives the real page over CDP,
freezes its animation loop, marches `St.t` across several `δ = π/2` crossings and reads the
canvas back with `getImageData`, checking that two probes either side of the bias axis land
on sector fill. The pristine `index.html` scored 8 pass / 8 fail — failing exactly the
`2δ > π` samples. Fixed, it is 16/16.

## What each one shows

**ATS.** Balanced junctions and no signal drive mean `C ≡ 0` to machine precision, so the
rotor is Kerr-free *and* starts from exact rest. It rings up anyway, because the coupling
is **odd**: the pump enters as `c₁ = gS`, a force at the resonance. The pump rocks the
centre of mass **across** gravity (the short pink stub at the hub), tilting the `U(φ)` well
back and forth against the dashed pump-off parabola, and the rotor grows out of nothing to
a cubic-damping-limited 1.101 rad (0.70 × π/2) over about 45 mode-seconds.

**LINC.** Balanced means `S ≡ 0` **exactly** — verified `0.0e+0`, not merely small — so the
coupling is **even**: the pump moves `C` only, which modulates the spring constant instead
of pushing the rotor. Pumped at `2f` that is the degenerate parametric point, and the well
visibly *breathes* rather than tilting, its curvature alternating between `κ+g|C|` and
`κ−g|C|` (2.40 and 1.60). Two things follow that the ATS slide does not have:

- **A threshold.** Gain only beats loss above `ε > 4ζ`. Here the relative spring modulation
  is `2 sin(ε)/κ = 0.199` against a threshold of `0.08`, so it amplifies — but the margin
  sets the rate, `0.199/4 − 0.02 = 0.0297 /s`, a **33.7 s e-folding**. It does not saturate
  until ~130 s, which is why the LINC run is 180 mode-seconds where the ATS needs 60.
- **It needs a seed.** The pumped torque `−gC sin φ` vanishes at `φ = 0`, so a
  parity-protected rig cannot be driven out of exact rest, only amplified. That is what
  `signal drive = 0.2` is for: it injects a ~0.168 rad seed for the pump to work on.

## Files

`out/` is generated — regenerate it rather than editing it.

| file | use |
|---|---|
| `out/ats-slide.mp4`, `out/linc-slide.mp4` | 1080×1620 (2:3), H.264 High / yuv420p, 30 fps, faststart. **Insert these.** |
| `out/*-slide.gif` | 480×720, 12 fps, self-looping — no media controls, no click to start |
| `out/*-slide-poster.png` | last frame, as a static fallback |
| `ats-slide.html`, `linc-slide.html` | the animations; open either to preview, it loops in real time |
| `render.js` | renders a page to the three files above |
| `wedgetest.js` | regression test for the sector bug: `node slide/wedgetest.js index.html` |

## Putting them on a slide

*Insert → Video → This Device*, pick the `.mp4`, then under *Playback* set **Start:
Automatically** (and tick *Loop until Stopped* to repeat — each run starts from rest, so a
loop restarts the ring-up rather than continuing it).

The background is pure white, so it sits flush on a white slide. At full slide height the
column takes up about 37% of a 16:9 slide's width (1080/1620 × 1080 ≈ 720 of 1920),
leaving the other ~63% for a title and text. To change the background, set `K.bg`.

The `.gif` is the fallback if the deck has to survive being emailed around or opened in
Google Slides: a GIF animates on its own with no playback settings to get wrong. The
`.mp4` is much better quality — prefer it whenever PowerPoint is doing the playing.

### If you show them side by side

The `φ(t)` axes are now identical, so the traces are directly comparable — the LINC really
does swing wider than the ATS. Two asymmetries remain:

- **Both clips are 18 s, but mode time runs 1.8× faster in the LINC** — 108 s over 18 s
  versus the ATS's 60 s over 18 s — so its see-saw swings about 1/s against the ATS's 1 per
  1.8 s.
- **The LINC clip stops mid-ring-up.** It is cut at 108 mode-seconds, and with a 33.7 s
  e-folding it does not saturate until ~130 s, so the trace is still visibly climbing at
  the right edge and tops out near 0.87 × π/2 rather than its ~π/2 plateau. That is the cost of
  an 18 s clip at a watchable swing rate: of `T_END`, `VID_S` and the on-screen swing rate,
  you can pick two. `T_END = 180, VID_S = 30` gets the full curve at this rate;
  `T_END = 180, VID_S = 18` gets the full curve in 18 s but plays 1.7× faster again.

## Regenerating

```sh
node slide/render.js                                # -> out/ats-slide.*
node slide/render.js --page slide/linc-slide.html    # -> out/linc-slide.*
node slide/render.js --frames 30                     # quick smoke test, no encode
node slide/render.js --dsf 1 --format jpeg           # fast, lower quality
```

Output names come from the page's basename, and the scratch frame directory and debug port
are per-page, so two renders can run at once (`--port` to pick the second one).

Needs `ffmpeg` on `PATH`, Node ≥ 22, and Chrome or Edge (set `CHROME_PATH` to override the
search). No npm install — the DevTools Protocol is spoken over Node's built-in `WebSocket`.

Timing and geometry live at the top of each page: `T_END` mode-seconds are played over
`VID_S` seconds of video at `FPS`, and `VW`/`VH`/`RIG`/`PU`/`PA` set the frame size and the
three panel boxes. `render.js` reads the frame size back out of the page, so re-shaping a
column needs no edit there — but keep `VW` and `VH` even, which H.264 requires (the
renderer checks, and also checks the page laid out at the size it claims).

Capture never touches the wall clock: `render.js` calls `window.renderFrame(i)`, which
advances exactly one fixed `DT`, so output is reproducible — verified bit-identical across
runs — and independent of how fast the machine renders.
