# Mechanical analogues of the ATS and the LINC

**▶ [Open the animation](https://yoshi74ls181.github.io/mechanical-ats-linc/)** — runs in
any browser, no install, works on a phone.

A single self-contained HTML file (no dependencies, no network access) animating a
mechanical analogy for two superconducting circuit elements used in cat-qubit and bosonic
control: the **ATS** (asymmetrically threaded SQUID) and the **LINC** (linear quantum
coupler). It extends the pendulum analogy for a Josephson junction — mass ↔ Josephson
energy, angle ↔ superconducting phase, external flux ↔ a fixed angle between the arms —
to the two-junction-plus-shunt geometry both elements share.

## The idea

Add the shunt inductance as a torsion spring and the rotor potential is exactly

```
U(φ) = ½κφ² − g (C cos φ − S sin φ),      (C, S) = Σ mᵢ (cos θᵢ, sin θᵢ)
```

and `(C, S)` *is* the mass-weighted centre-of-mass vector of the rotor:

- **C**, the component **along** gravity, generates only **even** powers of φ → frequency
  shift and **Kerr**.
- **S**, the component **across** gravity, generates only **odd** powers → force and **φ³**.

The ATS and the LINC are the same circuit; only the flux bias differs, and that just
rotates the balanced beam by 90°:

| | loop fluxes | beam | protected | pump drives |
|---|---|---|---|---|
| **ATS** | (π, 0) — asymmetric | vertical | `C ≡ 0`, so Kerr-free at any pump depth | `S` → φ³ |
| **LINC** | (π/2, π/2) — symmetric | horizontal see-saw | `S ≡ 0`, parity protected, exactly linear when idle | `C` → φ² |

Each beam's symmetry forbids the other's term — exactly, to machine precision — until the
junctions are imbalanced, which leaks precisely the imbalance into the forbidden channel.
Both elements carry the same total flux round the outer loop, `φ₁ + φ₂ = π`; they differ
only in how it is distributed.

## Controls

`space` pump on/off · `F` pump frequency · `R` reset · `←/→` junction imbalance, plus
sliders for pump depth, pump phase, damping (Q), signal drive and playback speed.
Each panel plots the live potential `U(φ)`, the Taylor coefficients (with the forbidden
ones marked *protected*), and `φ(t)` with its envelope so the ring-up is visible.

Some things worth trying:

- Set the junction imbalance above zero and watch **KERR** light up in the ATS panel.
- Drop the pump depth below `4ζ` and the LINC stops amplifying entirely — it is below its
  parametric threshold, and the panel says so.
- Switch the pump to `÷3`: the ATS still responds through third-harmonic generation, while
  the LINC needs a much deeper pump, because there it is driven only by the `J₃` Bessel
  harmonic of the flux modulation.

URL presets are supported, e.g.
[`#imb=0.14&eps=1.0&drive=0.3`](https://yoshi74ls181.github.io/mechanical-ats-linc/#imb=0.14&eps=1.0&drive=0.3).

## Credit

The underlying pendulum analogy (junction → pendulum, SQUID → double pendulum at fixed
angle, and the balanced-beam condition) is taken from the "3SQUID: a mechanical analogy"
slide of a talk on recent advances in cat qubits. The LINC/ATS relationship follows
Maiti *et al.*, [*A Linear Quantum Coupler for Clean Bosonic
Control*](https://arxiv.org/abs/2501.18025) (PRX Quantum), which notes the two have
nominally identical circuit geometries with opposing bias points — the fact this animation
makes visual.
