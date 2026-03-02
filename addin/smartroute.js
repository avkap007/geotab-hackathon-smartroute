/* SmartRoute Add-In — UI Layer */
/* Multi-route architecture. ES5 only. */

/* ── Debug helpers ───────────────────────────────────────────────────────── */
var _debugData = {};

function debugLog(msg) {
  var el = document.getElementById('debug-log');
  if (el) {
    el.textContent += '[' + new Date().toLocaleTimeString() + '] ' + msg + '\n';
    el.scrollTop = el.scrollHeight;
  }
  console.log('[SmartRoute]', msg);
}

function copyDebugData() {
  var text = JSON.stringify(_debugData, null, 2);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () {
      alert('Debug data copied to clipboard!');
    }, function () {
      alert('Copy failed — check browser permissions.');
    });
  } else {
    /* Fallback for older browsers / non-HTTPS */
    var t = document.createElement('textarea');
    t.value = text;
    t.style.position = 'fixed';
    t.style.opacity  = '0';
    document.body.appendChild(t);
    t.focus();
    t.select();
    try { document.execCommand('copy'); alert('Debug data copied to clipboard!'); }
    catch (e) { alert('Copy failed: ' + e); }
    document.body.removeChild(t);
  }
}

/* ── Fallback demo data (used when Geotab API is unavailable) ────────────── */
var FALLBACK_ROUTES = [
  {
    id: 'demo-route-1',
    name: 'Downtown West',
    bins: [
      { id: 'dw-1', name: 'King & Spadina',      lat: 43.6449, lng: -79.3966, fillLevel: 85 },
      { id: 'dw-2', name: 'Queen & Bathurst',     lat: 43.6439, lng: -79.4082, fillLevel: 42 },
      { id: 'dw-3', name: 'Dundas & University',  lat: 43.6555, lng: -79.3895, fillLevel: 72 },
      { id: 'dw-4', name: 'College & Spadina',    lat: 43.6595, lng: -79.4016, fillLevel: 28 },
      { id: 'dw-5', name: 'Bloor & Ossington',    lat: 43.6627, lng: -79.4258, fillLevel: 91 },
      { id: 'dw-6', name: 'Bloor & Bathurst',     lat: 43.6664, lng: -79.4119, fillLevel: 15 },
      { id: 'dw-7', name: 'Harbord & Spadina',    lat: 43.6611, lng: -79.4013, fillLevel: 63 }
    ],
    depot: { lat: 43.6400, lng: -79.4100 }
  },
  {
    id: 'demo-route-2',
    name: 'Midtown East',
    bins: [
      { id: 'me-1', name: 'Yonge & Eglinton',       lat: 43.7065, lng: -79.3985, fillLevel: 78 },
      { id: 'me-2', name: 'Yonge & Lawrence',        lat: 43.7249, lng: -79.4027, fillLevel: 55 },
      { id: 'me-3', name: 'Mt Pleasant & Davisville',lat: 43.7002, lng: -79.3900, fillLevel: 91 },
      { id: 'me-4', name: 'Bayview & Moore',          lat: 43.7043, lng: -79.3722, fillLevel: 33 },
      { id: 'me-5', name: 'Chaplin & Eglinton',       lat: 43.7072, lng: -79.4140, fillLevel: 67 }
    ],
    depot: { lat: 43.7100, lng: -79.4000 }
  },
  {
    id: 'demo-route-3',
    name: 'Waterfront Loop',
    bins: [
      { id: 'wf-1', name: 'Queens Quay & York',    lat: 43.6390, lng: -79.3762, fillLevel: 94 },
      { id: 'wf-2', name: 'Queens Quay & Spadina', lat: 43.6383, lng: -79.3953, fillLevel: 48 },
      { id: 'wf-3', name: 'Harbourfront Centre',   lat: 43.6387, lng: -79.3812, fillLevel: 82 },
      { id: 'wf-4', name: 'Rees St & Queens Quay', lat: 43.6385, lng: -79.3838, fillLevel: 19 },
      { id: 'wf-5', name: 'Simcoe & Bremner',      lat: 43.6413, lng: -79.3868, fillLevel: 71 }
    ],
    depot: { lat: 43.6420, lng: -79.3800 }
  }
];

/* ── Colour palette for routes ───────────────────────────────────────────── */
var ROUTE_COLORS = ['#4361ee', '#16a34a', '#f97316', '#7c3aed', '#db2777'];

/* ── Add-In factory ──────────────────────────────────────────────────────── */
function smartrouteAddinFactory() {

  var map, apiRef;
  var MY_ADDIN_ID    = 'SmartRouteBinState2026';
  var binStateId     = null;
  var vehicleStatuses = [];

  /*
   * loadedRoutes[]  — every route the user has added to the view
   *   { id, name, bins[], depot, color, chipEl,
   *     origPolylines[], markerList[] }
   *
   * optimizedMap{}  — keyed by routeId
   *   { result, overlayPolylines[], accepted }
   */
  var loadedRoutes       = [];
  var optimizedMap       = {};
  var selectedRouteId    = null;
  var allGeotabRoutes    = [];    /* cached from Geotab or fallback */
  var predictionsByBinId = {};    /* binId → prediction from SmartRouteAlgo.predict */

  /* ── Geometry / colour helpers ── */
  function zoneCentroid(zone) {
    var pts = zone.points || [];
    if (pts.length === 0) { return null; }
    var lat = 0, lng = 0;
    for (var i = 0; i < pts.length; i++) { lng += pts[i].x || 0; lat += pts[i].y || 0; }
    return { lat: lat / pts.length, lng: lng / pts.length };
  }

  function getBinFillColor(fillLevel) {
    if (fillLevel < 50) { return '#22c55e'; }
    if (fillLevel < 75) { return '#f59e0b'; }
    return '#ef4444';
  }

  function createZonePoints(lat, lng) {
    var o = 0.0001;
    return [
      { x: lng - o, y: lat - o }, { x: lng + o, y: lat - o },
      { x: lng + o, y: lat + o }, { x: lng - o, y: lat + o },
      { x: lng - o, y: lat - o }
    ];
  }

  function nextColor() {
    return ROUTE_COLORS[loadedRoutes.length % ROUTE_COLORS.length];
  }

  function routeIndexById(routeId) {
    for (var i = 0; i < loadedRoutes.length; i++) {
      if (loadedRoutes[i].id === routeId) { return i; }
    }
    return -1;
  }

  function isLoaded(routeId) { return routeIndexById(routeId) !== -1; }

  /* ── Slider helpers ── */
  function syncSlider(el) {
    var pct = ((el.value - el.min) / (el.max - el.min) * 100).toFixed(1) + '%';
    el.style.setProperty('--pct', pct);
  }

  /* ── KPI display ── */
  function setKpiValues(hours, fuel, co2, stops, blank) {
    var hEl = document.getElementById('val-hours');
    var fEl = document.getElementById('val-fuel');
    var cEl = document.getElementById('val-co2');
    var sEl = document.getElementById('val-stops');
    if (blank) {
      hEl.textContent = '—'; fEl.textContent = '—';
      cEl.textContent = '—'; sEl.textContent = '—';
      hEl.className = 'sr-kpi-value blank'; fEl.className = 'sr-kpi-value blank';
      cEl.className = 'sr-kpi-value blank'; sEl.className = 'sr-kpi-value blank';
    } else {
      hEl.textContent = hours; fEl.textContent = fuel;
      cEl.textContent = co2;   sEl.textContent = stops;
      hEl.className = 'sr-kpi-value'; fEl.className = 'sr-kpi-value';
      cEl.className = 'sr-kpi-value'; sEl.className = 'sr-kpi-value';
    }
  }

  function updateAggregateKPIs() {
    var hrs = 0, fuel = 0, co2 = 0, stops = 0, count = 0;
    for (var rid in optimizedMap) {
      if (!optimizedMap[rid] || !optimizedMap[rid].result) { continue; }
      var m = optimizedMap[rid].result.metrics;
      hrs += m.hoursSaved; fuel += m.fuelSavedL;
      co2 += m.co2AvoidedKg; stops += m.stopsSkipped;
      count++;
    }
    if (count === 0) {
      document.getElementById('kpi-title').textContent = 'Optimize to see impact';
      setKpiValues(0, 0, 0, 0, true);
    } else {
      document.getElementById('kpi-title').textContent =
        count + ' route' + (count > 1 ? 's' : '') + ' optimized — combined impact';
      setKpiValues(
        hrs.toFixed(1),
        fuel.toFixed(1),
        co2.toFixed(1),
        stops,
        false
      );
    }
  }

  /* ── Prediction helpers ── */

  /* Build the prediction block injected into each bin marker popup */
  function buildPredictPopupHtml(pred) {
    if (!pred) { return ''; }
    var days         = pred.daysUntilThreshold;
    var urgencyColor = (days <= 0 || days <= 2) ? '#ef4444' : (days <= 7 ? '#f59e0b' : '#22c55e');
    var daysText     = days <= 0 ? 'Now!' : (Math.ceil(days) + 'd');
    var dateStr      = pred.predictedThresholdDate
      ? ' (' + formatShortDate(pred.predictedThresholdDate) + ')' : '';
    var rateText     = pred.fillRatePerDay != null ? '+' + pred.fillRatePerDay + '%/day' : '';
    var cadText      = pred.collectionIntervalDays
      ? 'every ~' + Math.round(pred.collectionIntervalDays) + 'd' : '';
    var collectDays  = pred.recommendedCollectionDays.length
      ? pred.recommendedCollectionDays.join(', ') : '';
    var fleetNote    = pred.inferredFromFleet ? ' <i>(est.)</i>' : '';
    var confClass    = 'sr-conf-' + pred.confidence;

    return '<div class="sr-popup-predict">' +
      '<div class="sr-popup-predict-row">' +
        '<span class="sr-popup-predict-dot" style="background:' + urgencyColor + '"></span>' +
        '<span>Threshold in <b>' + daysText + '</b>' + dateStr + fleetNote + '</span>' +
      '</div>' +
      (rateText ?
        '<div class="sr-popup-predict-meta">' + rateText +
          (cadText ? '&nbsp;·&nbsp;' + cadText : '') + '</div>' : '') +
      (collectDays ?
        '<div class="sr-popup-predict-meta">Collect: <b>' + collectDays + '</b></div>' : '') +
      '<span class="sr-popup-predict-conf ' + confClass + '">' + pred.confidence + '</span>' +
    '</div>';
  }

  /* Format ISO date as "Mon 3/10" */
  function formatShortDate(isoDate) {
    var d    = new Date(isoDate);
    var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return days[d.getDay()] + ' ' + (d.getMonth() + 1) + '/' + d.getDate();
  }

  /* Populate the #detail-predictions section for a given route */
  function renderBinPredictions(routeId) {
    var el = document.getElementById('detail-predictions');
    var idx = routeIndexById(routeId);
    if (!el || idx < 0) { return; }

    var bins = loadedRoutes[idx].bins;

    /* Pair each bin with its prediction, keep only those we have data for */
    var rows = bins.map(function (bin) {
      return { bin: bin, pred: predictionsByBinId[bin.id] };
    }).filter(function (item) { return item.pred; });

    if (rows.length === 0) { el.style.display = 'none'; return; }

    /* Sort ascending by urgency (soonest threshold first) */
    rows.sort(function (a, b) { return a.pred.daysUntilThreshold - b.pred.daysUntilThreshold; });

    var anyFleet = rows.some(function (item) { return item.pred.inferredFromFleet; });
    var html = '<div class="sr-predict-section-title">Next Collections</div>';

    for (var i = 0; i < rows.length; i++) {
      var pred = rows[i].pred;
      var bin  = rows[i].bin;
      var days = pred.daysUntilThreshold;
      var color = (days <= 0 || days <= 2) ? '#ef4444' : (days <= 7 ? '#f59e0b' : '#22c55e');
      var label = days <= 0 ? 'Now!' : (Math.ceil(days) + 'd');
      html +=
        '<div class="sr-predict-bin-row">' +
          '<span class="sr-predict-bin-dot" style="background:' + color + '"></span>' +
          '<span class="sr-predict-bin-name">' + (bin.name || bin.id) + '</span>' +
          '<span class="sr-predict-bin-days">' + label + '</span>' +
        '</div>';
    }

    if (anyFleet) {
      html += '<div class="sr-predict-fleet-note">&#9733; Estimates based on fleet average</div>';
    }

    el.innerHTML = html;
    el.style.display = 'block';
  }

  /* ── Route detail panel ── */
  function showDetailPanel(routeId) {
    var idx = routeIndexById(routeId);
    var opt = optimizedMap[routeId];
    if (idx < 0 || !opt || !opt.result) { return; }

    selectedRouteId = routeId;
    var entry = loadedRoutes[idx];
    var m     = opt.result.metrics;

    document.getElementById('detail-dot').style.background  = entry.color;
    document.getElementById('detail-name').textContent       = entry.name;
    document.getElementById('detail-hours').textContent      = m.hoursSaved.toFixed(2) + ' hrs';
    document.getElementById('detail-fuel').textContent       = m.fuelSavedL.toFixed(1) + ' L';
    document.getElementById('detail-co2').textContent        = m.co2AvoidedKg.toFixed(1) + ' kg';
    document.getElementById('detail-stops').textContent      = m.stopsSkipped;
    document.getElementById('accept-btn').disabled           = opt.accepted;
    document.getElementById('accept-btn').textContent        = opt.accepted ? '✓ Accepted' : '✓ Accept Optimization';
    document.getElementById('discard-btn').textContent       = opt.accepted ? 'Close' : '✗ Discard';
    document.getElementById('route-detail').style.display   = 'block';
    renderBinPredictions(routeId);

    /* Switch KPI panel to this route */
    document.getElementById('kpi-title').textContent = entry.name + ' — metrics';
    setKpiValues(
      m.hoursSaved.toFixed(1),
      m.fuelSavedL.toFixed(1),
      m.co2AvoidedKg.toFixed(1),
      m.stopsSkipped,
      false
    );

    /* Highlight active chip */
    for (var i = 0; i < loadedRoutes.length; i++) {
      if (loadedRoutes[i].chipEl) {
        if (loadedRoutes[i].id === routeId) { loadedRoutes[i].chipEl.classList.add('active'); }
        else                                { loadedRoutes[i].chipEl.classList.remove('active'); }
      }
    }

    /* Fit map to this route's optimized overlay */
    if (opt.overlayPolylines && opt.overlayPolylines.length > 0) {
      var group = L.featureGroup(opt.overlayPolylines);
      map.fitBounds(group.getBounds().pad(0.18));
    }
  }

  function hideDetailPanel() {
    selectedRouteId = null;
    document.getElementById('route-detail').style.display = 'none';
    var predEl = document.getElementById('detail-predictions');
    if (predEl) { predEl.innerHTML = ''; predEl.style.display = 'none'; }
    for (var i = 0; i < loadedRoutes.length; i++) {
      if (loadedRoutes[i].chipEl) { loadedRoutes[i].chipEl.classList.remove('active'); }
    }
    updateAggregateKPIs();
  }

  /* ── Map badge ── */
  function refreshMapBadge() {
    var el    = document.getElementById('map-badge');
    var total = 0;
    for (var i = 0; i < loadedRoutes.length; i++) { total += loadedRoutes[i].bins.length; }
    if (loadedRoutes.length === 0) {
      el.textContent = 'No routes loaded';
    } else {
      el.textContent = loadedRoutes.length + ' route' + (loadedRoutes.length > 1 ? 's' : '') +
                       ' · ' + total + ' bins';
    }
  }

  /* ── Chips ── */
  function rebuildChips() {
    var row = document.getElementById('chips-row');
    row.innerHTML = '';
    if (loadedRoutes.length === 0) {
      row.innerHTML = '<span class="sr-chips-placeholder">Search and add routes to get started</span>';
      return;
    }
    for (var i = 0; i < loadedRoutes.length; i++) {
      (function (entry) {
        var chip = document.createElement('div');
        chip.className = 'sr-chip' + (optimizedMap[entry.id] ? ' optimized' : '');
        chip.innerHTML =
          '<span class="chip-dot" style="background:' + entry.color + '"></span>' +
          '<span>' + entry.name + '</span>' +
          '<span class="chip-remove" title="Remove">&times;</span>';

        chip.querySelector('.chip-remove').onclick = function (e) {
          e.stopPropagation();
          removeRoute(entry.id);
        };

        chip.onclick = function () {
          if (optimizedMap[entry.id]) {
            if (selectedRouteId === entry.id) { hideDetailPanel(); }
            else { showDetailPanel(entry.id); }
          } else {
            /* Pan to route */
            if (entry.markerList && entry.markerList.length > 0) {
              map.fitBounds(L.featureGroup(entry.markerList).getBounds().pad(0.2));
            }
          }
        };

        entry.chipEl = chip;
        row.appendChild(chip);
      })(loadedRoutes[i]);
    }
  }

  /* ── Map drawing ── */
  function clearOriginalLayers(entry) {
    for (var i = 0; i < (entry.origPolylines || []).length; i++) {
      if (map) { map.removeLayer(entry.origPolylines[i]); }
    }
    for (var j = 0; j < (entry.markerList || []).length; j++) {
      if (map) { map.removeLayer(entry.markerList[j]); }
    }
    entry.origPolylines = [];
    entry.markerList    = [];
  }

  function clearOverlayLayers(routeId) {
    if (!optimizedMap[routeId]) { return; }
    for (var i = 0; i < (optimizedMap[routeId].overlayPolylines || []).length; i++) {
      if (map) { map.removeLayer(optimizedMap[routeId].overlayPolylines[i]); }
    }
    optimizedMap[routeId].overlayPolylines = [];
  }

  function drawOriginalRoute(entry) {
    clearOriginalLayers(entry);
    var bins  = entry.bins;
    var color = entry.color;
    if (!bins || bins.length === 0) { return; }

    /* Original sequence — road-following path via OSRM (dashed, faded).
       The stops are already in Geotab's planned sequence order.
       Falls back to straight lines if OSRM is unreachable. */
    var pts = [{ lat: entry.depot.lat, lng: entry.depot.lng }];
    for (var i = 0; i < bins.length; i++) { pts.push({ lat: bins[i].lat, lng: bins[i].lng }); }
    pts.push({ lat: entry.depot.lat, lng: entry.depot.lng });

    fetchRoadPolyline(pts, color, null, function (poly) {
      poly.addTo(map);
      entry.origPolylines.push(poly);
    }, { weight: 2.5, opacity: 0.45, dashArray: '7 5' });

    /* Bin markers */
    for (var b = 0; b < bins.length; b++) {
      (function (bin, routeEntry) {
        var fillColor = getBinFillColor(bin.fillLevel);
        var icon = L.divIcon({
          className: '',
          html: '<div style="width:12px;height:12px;border-radius:50%;' +
                'background:' + fillColor + ';border:2px solid ' + routeEntry.color + ';' +
                'box-shadow:0 1px 4px rgba(0,0,0,0.25);"></div>',
          iconSize: [12, 12], iconAnchor: [6, 6]
        });

        var fillBarWidth = bin.fillLevel + '%';
        var marker = L.marker([bin.lat, bin.lng], { icon: icon }).addTo(map);
        marker.bindPopup(
          '<div class="sr-popup-title">' + (bin.name || bin.id) + '</div>' +
          '<div class="sr-popup-fill">' +
            '<span>Fill:&nbsp;<b>' + bin.fillLevel + '%</b></span>' +
            '<div class="sr-popup-fill-bar">' +
              '<div class="sr-popup-fill-inner" style="width:' + fillBarWidth + ';background:' + fillColor + ';"></div>' +
            '</div>' +
          '</div>' +
          '<div class="sr-popup-route">Route: ' + routeEntry.name + '</div>' +
          buildPredictPopupHtml(predictionsByBinId[bin.id])
        );
        marker.on('click', function () {
          if (optimizedMap[routeEntry.id]) { showDetailPanel(routeEntry.id); }
        });
        routeEntry.markerList.push(marker);
      })(bins[b], entry);
    }

    /* Depot marker */
    var depotIcon = L.divIcon({
      className: '',
      html: '<div style="width:14px;height:14px;border-radius:3px;background:#374151;' +
            'border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>',
      iconSize: [14, 14], iconAnchor: [7, 7]
    });
    var depotM = L.marker([entry.depot.lat, entry.depot.lng], { icon: depotIcon })
                  .addTo(map).bindPopup('<b>Depot</b><br>' + entry.name);
    entry.markerList.push(depotM);
  }

  /*
   * fetchRoadPolyline — fetch an actual road path from OSRM for one vehicle route.
   * pts   = [{lat, lng}, …]  (includes depot bookends)
   * color = hex colour string
   * routeId = for the click handler
   * onDone(poly) — called with the resulting Leaflet polyline (road or straight-line fallback)
   */
  /*
   * fetchRoadPolyline — fetch an actual road path from OSRM for a sequence of points.
   * pts       = [{lat, lng}, …]  (includes depot bookends)
   * color     = hex colour string
   * routeId   = for the click handler (pass null to skip)
   * onDone(poly) — called with the resulting Leaflet polyline (road or straight-line fallback)
   * lineStyle = optional Leaflet polyline option overrides (weight, opacity, dashArray, …)
   */
  function fetchRoadPolyline(pts, color, routeId, onDone, lineStyle) {
    var baseStyle = { color: color, weight: 5, opacity: 0.92 };
    /* Merge optional overrides */
    if (lineStyle) {
      for (var k in lineStyle) {
        if (Object.prototype.hasOwnProperty.call(lineStyle, k)) {
          baseStyle[k] = lineStyle[k];
        }
      }
    }

    var coords = pts.map(function (p) { return p.lng + ',' + p.lat; }).join(';');
    var url    = 'https://router.project-osrm.org/route/v1/driving/' + coords
               + '?overview=full&geometries=geojson';

    function makePoly(latlngs) {
      var poly = L.polyline(latlngs, baseStyle);
      if (routeId) { poly.on('click', function () { showDetailPanel(routeId); }); }
      return poly;
    }

    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var latlngs;
        if (data.code === 'Ok' && data.routes && data.routes[0]) {
          /* GeoJSON coordinates are [lng, lat] — flip for Leaflet */
          latlngs = data.routes[0].geometry.coordinates.map(function (c) {
            return [c[1], c[0]];
          });
        } else {
          latlngs = pts.map(function (p) { return [p.lat, p.lng]; });
        }
        onDone(makePoly(latlngs));
      })
      .catch(function () {
        /* OSRM unavailable — fall back to straight line */
        onDone(makePoly(pts.map(function (p) { return [p.lat, p.lng]; })));
      });
  }

  /*
   * drawRoadOverlay — clear old overlays, fetch road polylines for all vehicle routes,
   * add them to the map, store in optimizedMap, then call onDone().
   */
  function drawRoadOverlay(routeId, result, onDone) {
    clearOverlayLayers(routeId);
    if (!optimizedMap[routeId]) { optimizedMap[routeId] = {}; }

    var overlays = [];
    var vrs      = result.vehicleRoutes;

    if (vrs.length === 0) {
      optimizedMap[routeId].overlayPolylines = overlays;
      onDone();
      return;
    }

    var idx   = routeIndexById(routeId);
    var color = idx >= 0 ? loadedRoutes[idx].color : '#4361ee';
    var pending = vrs.length;

    for (var i = 0; i < vrs.length; i++) {
      (function (vr) {
        fetchRoadPolyline(vr.points, vr.color || color, routeId, function (poly) {
          poly.addTo(map);
          overlays.push(poly);
          pending--;
          if (pending === 0) {
            optimizedMap[routeId].overlayPolylines = overlays;
            onDone();
          }
        });
      })(vrs[i]);
    }
  }

  /* ── Route lifecycle ── */
  function addRoute(routeData) {
    if (isLoaded(routeData.id)) {
      alert('Route "' + routeData.name + '" is already on the map.');
      return;
    }
    var entry = {
      id:           routeData.id,
      name:         routeData.name,
      bins:         routeData.bins,
      depot:        routeData.depot,
      color:        nextColor(),
      origPolylines: [],
      markerList:   [],
      chipEl:       null
    };
    loadedRoutes.push(entry);

    /* Run predictions and index by binId so drawOriginalRoute can use them */
    var threshold = parseInt(document.getElementById('threshold-slider').value, 10);
    var preds = SmartRouteAlgo.predict(
      routeData.collectionLogs || [], entry.bins, { threshold: threshold }
    );
    for (var pi = 0; pi < preds.length; pi++) {
      predictionsByBinId[preds[pi].binId] = preds[pi];
    }

    drawOriginalRoute(entry);

    /* Fit map */
    if (entry.markerList.length > 0) {
      var group = L.featureGroup(entry.markerList);
      if (loadedRoutes.length === 1) {
        map.fitBounds(group.getBounds().pad(0.25));
      }
    }

    rebuildChips();
    document.getElementById('optimize-btn').disabled = false;
    refreshMapBadge();
    debugLog('Added route: ' + entry.name + ' (' + entry.bins.length + ' bins)');
  }

  function removeRoute(routeId) {
    var idx = routeIndexById(routeId);
    if (idx < 0) { return; }
    clearOriginalLayers(loadedRoutes[idx]);
    clearOverlayLayers(routeId);
    loadedRoutes.splice(idx, 1);
    delete optimizedMap[routeId];
    if (selectedRouteId === routeId) { hideDetailPanel(); }
    rebuildChips();
    document.getElementById('optimize-btn').disabled = loadedRoutes.length === 0;
    refreshMapBadge();
    updateAggregateKPIs();
    debugLog('Removed route: ' + routeId);
  }

  /* ── Data loading ── */

  /* Fetch all Geotab routes for search (one-time on init) */
  function fetchAllGeotabRoutes(cb) {
    if (!apiRef) {
      allGeotabRoutes = FALLBACK_ROUTES;
      debugLog('Offline mode — using ' + FALLBACK_ROUTES.length + ' demo routes');
      cb(allGeotabRoutes);
      return;
    }
    apiRef.call('Get', { typeName: 'Route' }, function (routes) {
      allGeotabRoutes = routes || [];
      debugLog('Fetched ' + allGeotabRoutes.length + ' Geotab routes');
      cb(allGeotabRoutes);
    }, function (err) {
      debugLog('Route fetch error: ' + err + ' — falling back to demo data');
      allGeotabRoutes = FALLBACK_ROUTES;
      cb(allGeotabRoutes);
    });
  }

  /* Load one route's bins from Geotab and add to view */
  function loadGeotabRouteById(routeId, routeName, cb) {
    if (!apiRef) { cb(null); return; }

    apiRef.call('Get', { typeName: 'Zone' }, function (zones) {
      /* Build zoneMap */
      var zoneMap = {};
      for (var i = 0; i < (zones || []).length; i++) {
        var z = zones[i];
        var c = zoneCentroid(z);
        if (c) {
          zoneMap[z.id] = { id: z.id, name: z.name || ('Zone ' + z.id), lat: c.lat, lng: c.lng };
        }
      }

      /* Fetch RoutePlanItems for this route */
      apiRef.call('Get', {
        typeName: 'RoutePlanItem',
        search: { route: { id: routeId } }
      }, function (items) {
        items = items || [];
        items.sort(function (a, b) { return (a.sequence || 0) - (b.sequence || 0); });

        var bins = [];
        for (var j = 0; j < items.length; j++) {
          var zid  = items[j].zone && items[j].zone.id ? items[j].zone.id : String(items[j].zone);
          var zData = zoneMap[zid];
          if (zData && !zData._added) {
            zData._added = true;
            bins.push({ id: zData.id, name: zData.name, lat: zData.lat, lng: zData.lng });
          }
        }

        /* Merge persisted fill levels + collect prediction logs */
        apiRef.call('Get', { typeName: 'AddInData', search: { addInId: MY_ADDIN_ID } }, function (addinData) {
          var fillById       = {};
          var collectionLogs = [];
          for (var k = 0; k < (addinData || []).length; k++) {
            var r = addinData[k];
            if (r.details && r.details.type === 'bin_state' && r.details.bins) {
              if (!binStateId) { binStateId = r.id; }
              for (var m = 0; m < r.details.bins.length; m++) {
                fillById[r.details.bins[m].id] = r.details.bins[m].fillLevel;
              }
            }
            if (r.details && r.details.type === 'collection_log') {
              collectionLogs.push(r.details);
            }
          }
          for (var b = 0; b < bins.length; b++) {
            bins[b].fillLevel = (fillById[bins[b].id] !== undefined)
              ? fillById[bins[b].id]
              : Math.floor(Math.random() * 90) + 10;
          }

          var depot = bins.length > 0 ? { lat: bins[0].lat, lng: bins[0].lng } : { lat: 43.65, lng: -79.38 };
          cb({ id: routeId, name: routeName, bins: bins, depot: depot, collectionLogs: collectionLogs });
        }, function () {
          /* Fill with random if AddInData fails */
          for (var b = 0; b < bins.length; b++) {
            if (!bins[b].fillLevel) { bins[b].fillLevel = Math.floor(Math.random() * 90) + 10; }
          }
          var depot = bins.length > 0 ? { lat: bins[0].lat, lng: bins[0].lng } : { lat: 43.65, lng: -79.38 };
          cb({ id: routeId, name: routeName, bins: bins, depot: depot, collectionLogs: [] });
        });
      }, function (err) {
        debugLog('RoutePlanItem error: ' + err);
        cb(null);
      });
    }, function (err) {
      debugLog('Zone fetch error: ' + err);
      cb(null);
    });
  }

  /* ── Search dropdown ── */
  function filterRoutes(query) {
    var q = query.toLowerCase().trim();
    if (q === '') { return allGeotabRoutes.slice(0, 10); }
    var results = [];
    for (var i = 0; i < allGeotabRoutes.length; i++) {
      var name = (allGeotabRoutes[i].name || '').toLowerCase();
      if (name.indexOf(q) !== -1) { results.push(allGeotabRoutes[i]); }
    }
    return results;
  }

  function showDropdown(routes, query) {
    var dd = document.getElementById('search-dropdown');
    dd.innerHTML = '';
    if (routes.length === 0) {
      dd.innerHTML = '<div class="sr-dropdown-empty">No routes found for "' + query + '"</div>';
      dd.style.display = 'block';
      return;
    }
    for (var i = 0; i < Math.min(routes.length, 8); i++) {
      (function (route) {
        var added = isLoaded(route.id);
        var item  = document.createElement('div');
        item.className = 'sr-dropdown-item' + (added ? ' added' : '');
        item.innerHTML =
          '<span class="item-dot" style="background:' +
            (added ? ROUTE_COLORS[routeIndexById(route.id) % ROUTE_COLORS.length] : '#d1d5db') +
          '"></span>' +
          '<div>' +
            '<div class="item-name">' + (route.name || 'Unnamed Route') + (added ? ' ✓' : '') + '</div>' +
            '<div class="item-sub">' + (route.comment || (route.bins ? route.bins.length + ' stops' : 'Click to load')) + '</div>' +
          '</div>';

        if (!added) {
          item.onclick = function () {
            hideDropdown();
            document.getElementById('route-search').value = '';
            loadAndAddRoute(route);
          };
        }
        dd.appendChild(item);
      })(routes[i]);
    }
    dd.style.display = 'block';
  }

  function hideDropdown() {
    document.getElementById('search-dropdown').style.display = 'none';
  }

  function loadAndAddRoute(geotabRoute) {
    /* Demo routes already have bins */
    if (geotabRoute.bins) {
      addRoute(geotabRoute);
      return;
    }
    /* Live Geotab route — fetch bins first */
    document.getElementById('optimize-status').innerHTML =
      '<span class="sr-spinner"></span> Loading ' + geotabRoute.name + '…';
    loadGeotabRouteById(geotabRoute.id, geotabRoute.name, function (data) {
      document.getElementById('optimize-status').textContent = '';
      if (!data || data.bins.length === 0) {
        alert('No stops found for "' + geotabRoute.name + '". The route may have no zones assigned.');
        return;
      }
      addRoute(data);
    });
  }

  /* ── Optimization ── */
  function runOptimizeAll() {
    if (loadedRoutes.length === 0) { return; }

    var threshold = parseInt(document.getElementById('threshold-slider').value, 10);
    var intensity = parseInt(document.getElementById('intensity-slider').value, 10) / 100;
    var capacity  = 10;

    var btn = document.getElementById('optimize-btn');
    btn.disabled    = true;
    btn.textContent = 'Optimizing…';
    hideDetailPanel();

    var idx = 0;
    function optimizeNext() {
      if (idx >= loadedRoutes.length) {
        btn.disabled    = false;
        btn.textContent = 'optimize these routes';
        document.getElementById('optimize-status').textContent =
          'Done! Click a route or chip to review.';
        updateAggregateKPIs();
        rebuildChips(); /* refresh chip styles */
        return;
      }

      var entry = loadedRoutes[idx];
      idx++;

      document.getElementById('optimize-status').innerHTML =
        '<span class="sr-spinner"></span> Optimizing ' + entry.name + '…';

      var opts = {
        threshold:       threshold,
        intensity:       intensity,
        vehicleCapacity: capacity,
        vehicles:        vehicleStatuses.filter(function (s) { return s.latitude && s.longitude; })
      };

      /* Use runAsync — fetches Google Maps road-distance matrix first (falls back to
         Haversine if no API key is configured), then draws road polylines via OSRM. */
      SmartRouteAlgo.runAsync(entry.bins, entry.depot, opts, function (result) {
        if (!optimizedMap[entry.id]) { optimizedMap[entry.id] = {}; }
        optimizedMap[entry.id].result   = result;
        optimizedMap[entry.id].accepted = false;

        debugLog(entry.name + ': ' + result.metrics.stopsSkipped + ' skipped, ' +
                 result.metrics.hoursSaved.toFixed(2) + ' hrs saved, ' +
                 result.metrics.kmSaved.toFixed(1) + ' km saved');

        /* Draw road-following polylines (OSRM), then move to next route */
        drawRoadOverlay(entry.id, result, function () {
          optimizeNext();
        });
      });
    }

    optimizeNext();
  }

  /* ── Accept / Discard ── */
  function acceptOptimization(routeId) {
    var opt = optimizedMap[routeId];
    var idx = routeIndexById(routeId);
    if (!opt || idx < 0) { return; }

    var entry         = loadedRoutes[idx];
    var optimizedBins = opt.result.optimizedBins || [];
    if (optimizedBins.length < 2) {
      alert('Not enough bins in the optimized route.');
      return;
    }

    var acceptBtn = document.getElementById('accept-btn');
    acceptBtn.disabled    = true;
    acceptBtn.textContent = 'Writing…';

    var routeName = 'SmartRoute-' + entry.name + '-' + new Date().toISOString().slice(0, 10);

    /* ── Offline / demo path ── */
    if (!apiRef) {
      debugLog('Demo mode: accepted "' + routeName + '" (no Geotab write)');
      opt.accepted = true;
      acceptBtn.textContent = '✓ Accepted';
      document.getElementById('discard-btn').textContent = 'Close';
      return;
    }

    /* ── Live Geotab write ── */
    var zoneRefs = [];
    var bi       = 0;

    function nextZone() {
      if (bi >= optimizedBins.length) { writeRoute(zoneRefs); return; }
      var bin = optimizedBins[bi];
      /* If bin already has a real Geotab Zone ID, reuse it */
      if (bin.id && bin.id.indexOf('demo-') !== 0 && bin.id.indexOf('dw-') !== 0 &&
          bin.id.indexOf('me-') !== 0 && bin.id.indexOf('wf-') !== 0) {
        zoneRefs.push({ id: bin.id });
        bi++;
        nextZone();
        return;
      }
      apiRef.call('Add', {
        typeName: 'Zone',
        entity: {
          name: 'SR-' + (bin.name || bin.id),
          points: createZonePoints(bin.lat, bin.lng),
          displayed: true,
          groups: [{ id: 'GroupCompanyId' }]
        }
      }, function (zoneId) {
        zoneRefs.push({ id: zoneId });
        bi++;
        nextZone();
      }, function (err) {
        debugLog('Zone Add error: ' + err);
        acceptBtn.disabled    = false;
        acceptBtn.textContent = '✓ Accept Optimization';
        alert('Failed to create zone: ' + err);
      });
    }

    function writeRoute(zones) {
      apiRef.call('Add', {
        typeName: 'Route',
        entity: { name: routeName, comment: 'SmartRoute optimized waste collection' }
      }, function (newRouteId) {
        var seq = 0;
        function nextItem() {
          if (seq >= zones.length) {
            opt.accepted = true;
            acceptBtn.textContent = '✓ Accepted';
            document.getElementById('discard-btn').textContent = 'Close';
            debugLog('Route written: ' + routeName);
            alert('Route "' + routeName + '" written to MyGeotab!');
            return;
          }
          apiRef.call('Add', {
            typeName: 'RoutePlanItem',
            entity: { route: { id: newRouteId }, zone: zones[seq], sequence: seq }
          }, function () { seq++; nextItem(); }, function (err) {
            debugLog('RoutePlanItem error: ' + err);
            seq++;
            nextItem(); /* continue even if one item fails */
          });
        }
        nextItem();
      }, function (err) {
        debugLog('Route Add error: ' + err);
        acceptBtn.disabled    = false;
        acceptBtn.textContent = '✓ Accept Optimization';
        alert('Failed to write route: ' + err);
      });
    }

    nextZone();
  }

  function discardOptimization(routeId) {
    clearOverlayLayers(routeId);
    if (optimizedMap[routeId]) { delete optimizedMap[routeId]; }
    hideDetailPanel();
    updateAggregateKPIs();
    rebuildChips();
    debugLog('Discarded optimization for: ' + routeId);
  }

  /* ── Vehicle loading ── */
  function loadVehicles(cb) {
    if (!apiRef) { vehicleStatuses = []; if (cb) { cb(); } return; }
    apiRef.call('Get', { typeName: 'DeviceStatusInfo' }, function (statuses) {
      vehicleStatuses = statuses || [];
      debugLog('Vehicles: ' + vehicleStatuses.length);
      if (cb) { cb(); }
    }, function () {
      vehicleStatuses = [];
      if (cb) { cb(); }
    });
  }

  /* ── Wire up UI ── */
  function wireSliders() {
    var tSlider = document.getElementById('threshold-slider');
    var iSlider = document.getElementById('intensity-slider');

    tSlider.oninput = function () {
      document.getElementById('threshold-display').textContent = tSlider.value;
      syncSlider(tSlider);
    };
    iSlider.oninput = function () { syncSlider(iSlider); };

    syncSlider(tSlider);
    syncSlider(iSlider);
  }

  function wireSearch() {
    var input   = document.getElementById('route-search');
    var timer   = null;

    input.oninput = function () {
      clearTimeout(timer);
      var q = input.value.trim();
      if (q.length === 0) { hideDropdown(); return; }
      timer = setTimeout(function () {
        showDropdown(filterRoutes(q), q);
      }, 180);
    };

    input.onfocus = function () {
      var q = input.value.trim();
      showDropdown(filterRoutes(q), q);
    };

    /* Add Route button shows all available routes */
    document.getElementById('add-route-btn').onclick = function () {
      var q = document.getElementById('route-search').value.trim();
      showDropdown(filterRoutes(q), q || '');
      document.getElementById('route-search').focus();
    };

    /* Click outside → close dropdown */
    document.addEventListener('click', function (e) {
      var wrap = document.querySelector('.sr-search-wrap');
      if (wrap && !wrap.contains(e.target)) { hideDropdown(); }
    });
  }

  /* ── Add-In return object ── */
  return {
    initialize: function (api, _state, callback) {
      apiRef = api;
      debugLog('SmartRoute initializing');

      /* Map */
      map = L.map('map').setView([43.6532, -79.3832], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      /* Sliders */
      wireSliders();
      /* Search */
      wireSearch();

      /* Date defaults */
      var today = new Date();
      var prior = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
      document.getElementById('date-to').value   = today.toISOString().slice(0, 10);
      document.getElementById('date-from').value = prior.toISOString().slice(0, 10);

      /* Button wiring */
      document.getElementById('optimize-btn').onclick = runOptimizeAll;
      document.getElementById('accept-btn').onclick   = function () {
        if (selectedRouteId) { acceptOptimization(selectedRouteId); }
      };
      document.getElementById('discard-btn').onclick  = function () {
        if (selectedRouteId) { discardOptimization(selectedRouteId); }
      };

      /* Fetch routes for search, then vehicles */
      fetchAllGeotabRoutes(function () {
        loadVehicles(function () {
          debugLog('Ready — ' + allGeotabRoutes.length + ' routes available to search');
        });
      });

      if (callback) { callback(); }
    },

    focus: function (api, _state) {
      apiRef = api;
      if (map) { setTimeout(function () { map.invalidateSize(); }, 200); }
    },

    blur: function () {}
  };
}

/* ── Register with Geotab or run standalone ─────────────────────────────── */
if (typeof geotab !== 'undefined' && geotab.addin) {
  geotab.addin['smartroute'] = smartrouteAddinFactory;
} else {
  /* Standalone browser testing */
  window.addEventListener('DOMContentLoaded', function () {
    var addin = smartrouteAddinFactory();
    addin.initialize(null, null, function () {
      debugLog('Running in standalone (offline) mode');
    });
  });
}
