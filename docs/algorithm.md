# SmartRoute — Algorithm Overview

## The Problem

Given a set of waste bins scattered across a city, each with a known fill level, find the shortest route that collects the right bins while respecting truck capacity — and skip the ones that aren't worth the detour.

This is a variant of the **Vehicle Routing Problem (VRP)**, one of the most studied problems in operations research. It is NP-hard in general, meaning no known algorithm finds the perfect solution for large inputs in reasonable time. Instead, we use fast, high-quality heuristics that produce near-optimal routes in milliseconds.

---

## Two-Phase Approach

SmartRoute splits the problem into two phases, controlled by the user via two sliders:

```
All bins
  │
  ├── Fill level ≥ threshold  →  MANDATORY  →  Phase 1: Clarke-Wright
  │
  └── Fill level < threshold  →  CANDIDATES →  Phase 2: Selective Insertion
```

---

## Phase 1 — Clarke-Wright Savings Algorithm

### The Core Idea

Imagine the naive approach: send a truck on a separate round trip for every single bin.

```
depot → Bin A → depot   (trip 1)
depot → Bin B → depot   (trip 2)
depot → Bin C → depot   (trip 3)
```

This is obviously wasteful. The Clarke-Wright algorithm asks: **how much distance do we save by combining two trips into one?**

The saving from merging the trips for Bin A and Bin B is:

```
saving(A, B) = d(depot, A) + d(depot, B) − d(A, B)
```

In plain English: instead of making two separate depot round trips, we drive `depot → A → B → depot` — saving the two "wasted" depot returns and paying only the direct A→B leg.

### Step-by-Step

**1. Compute savings for every pair of bins**

For `n` bins above the threshold, calculate `saving(i, j)` for every pair `(i, j)`. This produces `n(n−1)/2` savings values.

**2. Sort by saving, descending**

The highest-saving pairs represent the merges that reduce total distance the most.

**3. Greedily merge routes**

Starting from `n` singleton routes (`depot → bin_i → depot`), work through the sorted list and merge pairs when all of the following hold:

| Condition | Why it matters |
|---|---|
| Bins `i` and `j` are in **different** routes | Can't merge a route with itself |
| Both `i` and `j` are **endpoints** of their routes | Interior bins can't be joined without breaking route continuity |
| Combined route length ≤ `vehicleCapacity` | Truck can't carry more than its capacity |

A merge connects the end of one route to the start of another, so the bins sit adjacent:

```
Before:  [depot → ... → A]   and   [B → ... → depot]
After:   [depot → ... → A → B → ... → depot]
```

**4. Repeat until no more valid merges exist**

What remains is a set of complete routes — one per vehicle if capacity forces splits, or a single route if all bins fit on one truck.

### Why Clarke-Wright?

| Property | Detail |
|---|---|
| **Quality** | Consistently produces routes 5–15% shorter than nearest-neighbour |
| **Speed** | O(n² log n) — fast enough to run in-browser for hundreds of bins |
| **Capacity-aware** | Capacity constraints are enforced during merging, not as an afterthought |
| **No tuning required** | Purely geometric — no parameters to set, deterministic output |

---

## Post-Processing — Or-Opt

After Clarke-Wright produces routes, **or-opt** refines each one by relocating short segments.

### What it does

For each route, try moving a segment of **1, 2, or 3 consecutive bins** to every other position in the same route. Accept the move only if it reduces total route distance.

```
Before:  depot → A → B → C → D → E → depot
Try moving [C] to position between A and B:
After:   depot → A → C → B → D → E → depot
         ↑ is this shorter? if yes, keep it.
```

Repeat until no improving move exists.

### Why or-opt instead of 2-opt?

2-opt reverses a sub-sequence of the route to improve it. Or-opt *relocates* segments without reversing. For waste collection routes that start and end at a depot, or-opt tends to find better improvements because it respects the natural flow of the route rather than flipping it.

---

## Phase 2 — Selective Insertion

After the mandatory route is finalized, each **sub-threshold bin** is evaluated individually. The question is: is this bin worth a detour?

### Profit/Cost Model

For each candidate bin `b`, find the **cheapest position** to insert it across all existing routes:

```
insertionCost(b) = d(prev, b) + d(b, next) − d(prev, next)
```

This is the extra distance added by inserting `b` between two consecutive stops. Normalize all insertion costs to a 0–100 scale, then compute:

```
netValue(b) = fillLevel(b) − α × normalizedCost(b)
```

where **α** is controlled by the Intensity slider:

| Slider | α value | Behaviour |
|---|---|---|
| 0 (Collect all) | 0 | Include every candidate regardless of detour |
| 0.5 (Balanced) | 1.5 | Include if fill level outweighs cost |
| 1.0 (Critical only) | 3.0 | Only include nearly-full bins with near-zero detour |

**If `netValue > 0`**, the bin is inserted at its cheapest position. Bins are evaluated in descending fill order so the fullest bins claim the best slots first.

### Why this matters

This phase prevents the route from wasting time on mostly-empty bins while still capturing high-fill bins that happen to be close to the existing route — giving the fleet manager a single lever (the Intensity slider) to tune collection aggressiveness without touching the underlying math.

---

## Savings Metrics

After optimization, SmartRoute computes what was gained vs. the naive "collect everything" baseline:

| Metric | Formula |
|---|---|
| **km Saved** | `baselineKm − optimizedKm` |
| **Fuel Saved (L)** | `kmSaved × 0.3 L/km` |
| **CO₂ Reduced (kg)** | `fuelSaved × 2.68 kg/L` |
| **Hours Saved** | `(kmSaved / 25 km/h) + (stopsSkipped × 5 min)` |

The baseline uses a nearest-neighbour ordering of **all** bins (including below-threshold ones), representing the cost of an unoptimized full-collection run.

---

## Algorithm Complexity

| Component | Time Complexity | Typical runtime (30 bins) |
|---|---|---|
| Clarke-Wright savings | O(n² log n) | < 1 ms |
| Or-opt post-processing | O(n³) per pass | < 5 ms |
| Selective insertion | O(c × r × n) | < 2 ms |
| **Total** | — | **< 10 ms** |

All computation runs client-side in the browser. No server, no network call, no latency.

---

## Summary

```
Bins above threshold
       │
       ▼
Clarke-Wright Savings   →   near-optimal route skeleton
       │
       ▼
Or-Opt refinement       →   local improvements via segment relocation
       │
Bins below threshold
       │
       ▼
Selective Insertion     →   profitable candidates added via net-value test
       │
       ▼
Final optimized route   →   metrics computed and displayed
```

The combination of Clarke-Wright + or-opt + selective insertion gives SmartRoute a route quality significantly above what a human dispatcher could produce manually, while remaining fast enough to re-optimize interactively as the slider values change.
