# Person 1 & Person 2 — Collaboration Agreement

## File Ownership

| File | Owner | Touch? |
|------|-------|--------|
| `addin/smartroute-algo.js` | **Person 2** | Person 1: never |
| `addin/smartroute.js` | **Person 1** | Person 2: never |
| `addin/smartroute.html` | Person 1 (primary) | Person 2: one-time change (add script tag, see below) |

---

## One-Time HTML Change (Person 2 does this once)

Person 2 adds a `<script>` tag to `smartroute.html` **before** the existing `smartroute.js` tag:

```html
<script src="smartroute-algo.js"></script>
<script src="smartroute.js"></script>
```

After that, Person 1 owns `smartroute.html`.

---

## Contract 1: Real-Time Optimization

Person 2 exposes a global object `window.SmartRouteAlgo` in `smartroute-algo.js`.

### Person 1 calls it like this:

```javascript
// Wire this once on initialize — Person 1 sets the callback:
SmartRouteAlgo.onComplete = function(results) {
  // results.optimizedOrder — render on map
  // results.skippedBins   — grey out on map
  // results.savings       — update KPI cards
};

// Call this whenever the slider changes or user hits Optimize:
SmartRouteAlgo.run(bins, depot, {
  threshold: 70,          // fill level % cutoff
  vehicleCapacity: 10,    // max bins per truck (use 10 if unknown)
  vehicles: vehicleStatuses  // array of { latitude, longitude } from Geotab
});
```

### Person 2 guarantees `results` has this shape:

```javascript
{
  optimizedOrder: [         // bins to collect, in order
    { id, name, lat, lng, fillLevel }
  ],
  skippedBins: [            // bins below threshold (for greying out on map)
    { id, name, lat, lng, fillLevel }
  ],
  savings: {
    stopsReduced: Number,   // originalCount - optimizedCount
    kmSaved: Number,        // original distance - optimized distance
    fuelSavedL: Number,     // kmSaved * 0.3
    co2AvoidedKg: Number    // fuelSavedL * 2.68
  }
}
```

**Person 1 does not call `nearestNeighborRoute`, `twoOptImprove`, or any other internal algo function directly.**

---

## Contract 2: Predictive Model (AddInData Pipeline)

Person 2 computes predictions and writes them to `AddInData`. Person 1 reads and displays them.

### AddInData schema Person 2 writes:

```javascript
{
  addInId: 'SmartRouteBinState2026',
  details: {
    type: 'bin_predictions',
    generatedAt: '2026-03-01T10:00:00Z',
    predictions: [
      {
        binId: 'zone-abc123',
        predictedFullDate: '2026-03-04',   // ISO date string, or null if unknown
        fillRatePerDay: 12.5,              // % per day estimated
        recommendedCollectionDays: ['Monday', 'Thursday'],
        confidence: 'high'                 // 'high' | 'medium' | 'low'
      }
    ]
  }
}
```

### Person 1 reads it like this:

```javascript
api.call('Get', { typeName: 'AddInData', search: { addInId: 'SmartRouteBinState2026' } },
  function(results) {
    var predRecord = results.find(function(r) { return r.details.type === 'bin_predictions'; });
    var predictions = predRecord ? predRecord.details.predictions : [];
    // use predictions to show badge on bin marker: "Full by Thursday"
  }
);
```

**Person 2 runs `predict()` once on load (or on demand). Person 1 never calls predict() directly — they only read the stored result.**

---

## Summary

```
User interaction (slider/button)
        │
        ▼
Person 1 calls SmartRouteAlgo.run(bins, depot, options)
        │
        ▼
Person 2's algo computes optimized route
        │
        ▼
onComplete(results) fires → Person 1 renders map + KPIs

─────────────────────────────────────────────────────

Person 2's predict() → writes bin_predictions to AddInData
                                    │
                                    ▼
                     Person 1 reads on load → shows badges
```

---

## Quick Rules

1. If you need to change the **shape** of `results` or `bin_predictions`, tell the other person **before** you change it.
2. Person 2 does not touch the map, DOM, or KPI card elements.
3. Person 1 does not touch nearest-neighbor, Clarke-Wright, or any function inside `smartroute-algo.js`.
4. The `bins` array shape never changes: `[{ id, name, lat, lng, fillLevel }]`.
