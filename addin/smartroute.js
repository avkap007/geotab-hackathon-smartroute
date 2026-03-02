/* SmartRoute Add-In — UI Layer */
/* Person 1 owns this file. ES5 only. */
/* Algorithm lives in smartroute-algo.js (Person 2). */
/* See docs/COLLABORATION.md for the data contract. */

var _debugData = {};
var MY_ADDIN_ID = 'SmartRouteBinState2026';

function debugLog(msg) {
  var el = document.getElementById('debug-log');
  if (el) {
    el.textContent += '[' + new Date().toLocaleTimeString() + '] ' + msg + '\n';
    el.scrollTop = el.scrollHeight;
  }
}

function copyDebugData() {
  var t = document.createElement('textarea');
  t.value = JSON.stringify(_debugData, null, 2);
  document.body.appendChild(t);
  t.select();
  document.execCommand('copy');
  document.body.removeChild(t);
  alert('Debug data copied to clipboard!');
}

function debugSample(key, arr) {
  _debugData[key] = arr ? { total: arr.length, sample: arr.slice(0, 5) } : null;
}

/* Embedded fallback bin data (used if Geotab Zone fetch fails) */
var BINS_DATA = {
  bins: [
    { id: 'bin-1',  lat: 40.7128, lng: -74.006,  fillLevel: 85 },
    { id: 'bin-2',  lat: 40.715,  lng: -74.008,  fillLevel: 42 },
    { id: 'bin-3',  lat: 40.718,  lng: -74.004,  fillLevel: 92 },
    { id: 'bin-4',  lat: 40.71,   lng: -74.01,   fillLevel: 28 },
    { id: 'bin-5',  lat: 40.72,   lng: -74.012,  fillLevel: 67 },
    { id: 'bin-6',  lat: 40.708,  lng: -74.002,  fillLevel: 15 },
    { id: 'bin-7',  lat: 40.722,  lng: -74.006,  fillLevel: 78 },
    { id: 'bin-8',  lat: 40.706,  lng: -74.014,  fillLevel: 55 },
    { id: 'bin-9',  lat: 40.724,  lng: -74.01,   fillLevel: 91 },
    { id: 'bin-10', lat: 40.714,  lng: -74.0,    fillLevel: 33 },
    { id: 'bin-11', lat: 40.716,  lng: -74.016,  fillLevel: 72 },
    { id: 'bin-12', lat: 40.704,  lng: -74.006,  fillLevel: 8  },
    { id: 'bin-13', lat: 40.726,  lng: -74.004,  fillLevel: 88 },
    { id: 'bin-14', lat: 40.712,  lng: -74.018,  fillLevel: 61 },
    { id: 'bin-15', lat: 40.702,  lng: -74.01,   fillLevel: 45 },
    { id: 'bin-16', lat: 40.728,  lng: -74.008,  fillLevel: 95 },
    { id: 'bin-17', lat: 40.71,   lng: -74.02,   fillLevel: 22 },
    { id: 'bin-18', lat: 40.7,    lng: -74.002,  fillLevel: 76 },
    { id: 'bin-19', lat: 40.73,   lng: -74.012,  fillLevel: 54 },
    { id: 'bin-20', lat: 40.708,  lng: -74.022,  fillLevel: 39 },
    { id: 'bin-21', lat: 40.718,  lng: -73.998,  fillLevel: 83 },
    { id: 'bin-22', lat: 40.698,  lng: -74.006,  fillLevel: 12 },
    { id: 'bin-23', lat: 40.732,  lng: -74.002,  fillLevel: 69 },
    { id: 'bin-24', lat: 40.706,  lng: -74.024,  fillLevel: 97 },
    { id: 'bin-25', lat: 40.72,   lng: -73.996,  fillLevel: 51 },
    { id: 'bin-26', lat: 40.696,  lng: -74.014,  fillLevel: 36 },
    { id: 'bin-27', lat: 40.734,  lng: -74.016,  fillLevel: 74 },
    { id: 'bin-28', lat: 40.704,  lng: -74.026,  fillLevel: 19 },
    { id: 'bin-29', lat: 40.722,  lng: -73.994,  fillLevel: 87 },
    { id: 'bin-30', lat: 40.694,  lng: -74.018,  fillLevel: 63 }
  ],
  depot: { lat: 40.7128, lng: -74.006 }
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function getBinColor(fillLevel) {
  if (fillLevel < 50) return '#28a745';
  if (fillLevel < 70) return '#ffc107';
  return '#dc3545';
}

function createZonePoints(lat, lng) {
  var offset = 0.0001;
  return [
    { x: lng - offset, y: lat - offset },
    { x: lng + offset, y: lat - offset },
    { x: lng + offset, y: lat + offset },
    { x: lng - offset, y: lat + offset },
    { x: lng - offset, y: lat - offset }
  ];
}

/* ── Add-In ───────────────────────────────────────────────────────────────── */

geotab.addin['smartroute'] = function () {
  var map, apiRef;
  var binMarkers      = [];
  var routePolylines  = [];
  var originalPolyline = null;
  var vehicleMarkers  = [];
  var bins            = [];
  var depot           = BINS_DATA.depot;
  var binStateId      = null;
  var vehicleStatuses = [];
  var lastOptimizedOrder = [];
  var lastThreshold   = 70;

  /* ── Zone centroid ── */
  function zoneCentroid(zone) {
    var pts = zone.points || [];
    if (pts.length === 0) return null;
    var lat = 0, lng = 0;
    for (var i = 0; i < pts.length; i++) {
      lng += pts[i].x || 0;
      lat += pts[i].y || 0;
    }
    return { lat: lat / pts.length, lng: lng / pts.length };
  }

  /* ── Data loading ── */
  function loadZonesFromGeotab(cb) {
    apiRef.call('Get', { typeName: 'Zone' }, function (zones) {
      apiRef.call('Get', { typeName: 'RoutePlanItem' }, function (planItems) {
        var zoneMap = {};
        (zones || []).forEach(function (z) {
          var c = zoneCentroid(z);
          if (c) zoneMap[z.id] = { id: z.id, name: z.name || ('Zone ' + z.id), lat: c.lat, lng: c.lng };
        });

        var ordered = [];
        if (planItems && planItems.length > 0) {
          planItems.sort(function (a, b) {
            var ra = (a.route && a.route.id) || a.route;
            var rb = (b.route && b.route.id) || b.route;
            if (ra !== rb) return String(ra).localeCompare(String(rb));
            return (a.sequence || 0) - (b.sequence || 0);
          });
          var seen = {};
          planItems.forEach(function (item) {
            var zid = (item.zone && item.zone.id) || item.zone;
            if (zid && zoneMap[zid] && !seen[zid]) {
              ordered.push(zoneMap[zid]);
              seen[zid] = true;
            }
          });
        }

        if (ordered.length === 0) {
          for (var k in zoneMap) ordered.push(zoneMap[k]);
        }

        bins = ordered.map(function (b) {
          return { id: b.id, name: b.name, lat: b.lat, lng: b.lng, fillLevel: Math.floor(Math.random() * 95) + 5 };
        });

        if (bins.length > 0) {
          depot = { lat: bins[0].lat, lng: bins[0].lng };
          debugLog('Loaded ' + bins.length + ' bins from Geotab Zones');
          if (map) map.setView([depot.lat, depot.lng], 13);
        }
        if (cb) cb();
      }, function () {
        /* RoutePlanItem failed — fall back to raw zones */
        bins = (zones || []).filter(function (z) { return zoneCentroid(z); }).map(function (z) {
          var c = zoneCentroid(z);
          return { id: z.id, name: z.name || ('Zone ' + z.id), lat: c.lat, lng: c.lng, fillLevel: Math.floor(Math.random() * 95) + 5 };
        });
        if (bins.length > 0) {
          depot = { lat: bins[0].lat, lng: bins[0].lng };
          if (map) map.setView([depot.lat, depot.lng], 13);
        }
        if (cb) cb();
      });
    }, function () {
      debugLog('Zone fetch failed — using synthetic bins');
      bins = BINS_DATA.bins.map(function (b) {
        return { id: b.id, lat: b.lat, lng: b.lng, fillLevel: Math.floor(Math.random() * 95) + 5 };
      });
      depot = BINS_DATA.depot;
      if (map) map.setView([depot.lat, depot.lng], 13);
      if (cb) cb();
    });
  }

  function loadBinState(cb) {
    apiRef.call('Get', { typeName: 'AddInData', search: { addInId: MY_ADDIN_ID } }, function (results) {
      var binState = null;
      (results || []).forEach(function (r) {
        if (!binState && r.details && r.details.type === 'bin_state') {
          binState = r.details;
          binStateId = r.id;
        }
      });
      if (binState && binState.bins) {
        var byId = {};
        binState.bins.forEach(function (b) { byId[b.id] = b.fillLevel; });
        bins.forEach(function (b) { if (byId[b.id] !== undefined) b.fillLevel = byId[b.id]; });
        debugLog('Merged fillLevels from AddInData');
      }
      if (cb) cb();
    }, function (err) {
      debugLog('AddInData Get error: ' + err);
      if (cb) cb();
    });
  }

  function saveBinState(cb) {
    var entity = {
      addInId: MY_ADDIN_ID,
      groups: [{ id: 'GroupCompanyId' }],
      details: { type: 'bin_state', bins: bins, savedAt: new Date().toISOString() }
    };
    if (binStateId) entity.id = binStateId;
    apiRef.call(binStateId ? 'Set' : 'Add', { typeName: 'AddInData', entity: entity }, function (id) {
      if (!binStateId) binStateId = id;
      debugLog('Saved bin_state');
      if (cb) cb();
    }, function (err) {
      debugLog('AddInData save error: ' + err);
      if (cb) cb();
    });
  }

  function addCollectionLog(routeId, deviceId, binId, fillPct, lat, lng, thresholdUsed) {
    apiRef.call('Add', {
      typeName: 'AddInData',
      entity: {
        addInId: MY_ADDIN_ID,
        groups: [{ id: 'GroupCompanyId' }],
        details: {
          type: 'collection_log',
          routeId: routeId || 'demo',
          deviceId: deviceId || 'demo',
          binId: binId,
          collectedAt: new Date().toISOString(),
          fillPctAtCollection: fillPct,
          lat: lat,
          lng: lng,
          thresholdUsed: thresholdUsed
        }
      }
    }, function () {
      debugLog('Collection logged: ' + binId);
    }, function (err) {
      debugLog('Collection log error: ' + err);
    });
  }

  /* ── Map rendering ── */
  function clearMapOverlays() {
    binMarkers.forEach(function (m) { if (map) map.removeLayer(m); });
    binMarkers = [];
    routePolylines.forEach(function (p) { if (map) map.removeLayer(p); });
    routePolylines = [];
    if (originalPolyline && map) { map.removeLayer(originalPolyline); originalPolyline = null; }
  }

  function addBinMarker(bin) {
    var color = getBinColor(bin.fillLevel);
    var icon = L.divIcon({
      className: 'bin-marker',
      html: '<div style="width:14px;height:14px;border-radius:50%;background:' + color + ';border:2px solid #333;"></div>',
      iconSize: [14, 14]
    });
    var m = L.marker([bin.lat, bin.lng], { icon: icon })
      .addTo(map)
      .bindPopup('<b>' + (bin.name || bin.id) + '</b><br>Fill: ' + bin.fillLevel + '%');
    binMarkers.push(m);
  }

  function addVehicleMarker(status) {
    var name = (status.device && status.device.id) ? status.device.id : 'Vehicle';
    var m = L.marker([status.latitude, status.longitude])
      .addTo(map)
      .bindPopup('<b>' + name + '</b><br>Speed: ' + (status.speed || 0) + ' km/h');
    vehicleMarkers.push(m);
  }

  function drawRoute(points, color, weight) {
    var latlngs = points.map(function (p) { return [p.lat, p.lng]; });
    return L.polyline(latlngs, { color: color, weight: weight || 4 }).addTo(map);
  }

  /* ── Algorithm callback — Person 1 renders whatever SmartRouteAlgo gives back ── */
  function setupAlgoCallback() {
    SmartRouteAlgo.onComplete = function (results) {
      clearMapOverlays();

      /* Draw all bin markers */
      bins.forEach(addBinMarker);

      /* Grey baseline route (all bins, unoptimised) */
      if (results.originalPoints && results.originalPoints.length > 1) {
        originalPolyline = drawRoute(results.originalPoints, '#6c757d', 3);
      }

      /* Optimised vehicle route(s) */
      results.vehicleRoutes.forEach(function (vr) {
        routePolylines.push(drawRoute(vr.points, vr.color || '#0d6efd', 5));
      });

      /* KPI cards */
      var s = results.savings;
      document.getElementById('val-stops').textContent = s.stopsReduced;
      document.getElementById('val-km').textContent    = s.kmSaved.toFixed(1);
      document.getElementById('val-fuel').textContent  = s.fuelSavedL.toFixed(2) + ' L';
      document.getElementById('val-co2').textContent   = s.co2AvoidedKg.toFixed(1) + ' kg';

      /* Status bar */
      document.getElementById('status-text').textContent =
        results.optimizedOrder.length + ' bins to collect · ' +
        results.skippedBins.length + ' skipped (below ' + lastThreshold + '% threshold)';

      debugLog('Optimised: ' + results.optimizedOrder.length + ' stops, ' +
               s.kmSaved.toFixed(1) + ' km saved');
      debugSample('optimizedOrder', results.optimizedOrder);

      lastOptimizedOrder = results.optimizedOrder;
      saveBinState();
    };
  }

  /* ── Optimization trigger ── */
  function runOptimization() {
    lastThreshold = parseInt(document.getElementById('threshold-slider').value, 10);
    document.getElementById('threshold-value').textContent = lastThreshold;

    SmartRouteAlgo.run(bins, depot, {
      threshold: lastThreshold,
      vehicleCapacity: 10,
      vehicles: vehicleStatuses.filter(function (s) { return s.latitude && s.longitude; })
    });
  }

  /* ── Geotab writeback ── */
  function writeRouteToGeotab() {
    if (lastOptimizedOrder.length < 2) {
      alert('Need at least 2 bins above threshold to create a route.');
      return;
    }

    var btn = document.getElementById('write-route-btn');
    btn.disabled = true;
    btn.textContent = 'Writing...';

    var routeName = 'SmartRoute-' + new Date().toISOString().slice(0, 10) + '-' + Date.now();
    var zoneRefs = [];
    var idx = 0;

    function createNextZone() {
      if (idx >= lastOptimizedOrder.length) { createRoute(zoneRefs); return; }
      var bin = lastOptimizedOrder[idx];
      if (bin.id && bin.id.indexOf('bin-') !== 0) {
        /* Already a real Geotab Zone ID */
        zoneRefs.push({ id: bin.id });
        idx++;
        createNextZone();
        return;
      }
      apiRef.call('Add', {
        typeName: 'Zone',
        entity: { name: 'SmartRoute-' + bin.id, points: createZonePoints(bin.lat, bin.lng), displayed: true }
      }, function (zoneId) {
        zoneRefs.push({ id: zoneId });
        idx++;
        createNextZone();
      }, function (err) {
        debugLog('Zone Add error: ' + err);
        btn.disabled = false;
        btn.textContent = 'Write Route to MyGeotab';
        alert('Failed to create zone: ' + err);
      });
    }

    function createRoute(zones) {
      apiRef.call('Add', {
        typeName: 'Route',
        entity: { name: routeName, comment: 'SmartRoute optimized waste collection route' }
      }, function (routeId) {
        var seq = 0;
        function addNextPlanItem() {
          if (seq >= zones.length) {
            debugLog('Route created: ' + routeName);
            btn.disabled = false;
            btn.textContent = 'Write Route to MyGeotab';
            alert('Route "' + routeName + '" created successfully!');
            return;
          }
          apiRef.call('Add', {
            typeName: 'RoutePlanItem',
            entity: { route: { id: routeId }, zone: zones[seq], sequence: seq }
          }, function () {
            seq++;
            addNextPlanItem();
          }, function (err) {
            debugLog('RoutePlanItem Add error: ' + err);
            btn.disabled = false;
            btn.textContent = 'Write Route to MyGeotab';
            alert('Route created but failed to add waypoint: ' + err);
          });
        }
        addNextPlanItem();
      }, function (err) {
        debugLog('Route Add error: ' + err);
        btn.disabled = false;
        btn.textContent = 'Write Route to MyGeotab';
        alert('Failed to create route: ' + err);
      });
    }

    createNextZone();
  }

  function logCollectionSimulate() {
    if (lastOptimizedOrder.length === 0) {
      alert('Optimize a route first.');
      return;
    }
    var bin = lastOptimizedOrder[0];
    var deviceId = (vehicleStatuses[0] && vehicleStatuses[0].device) ? vehicleStatuses[0].device.id : 'demo';
    addCollectionLog('demo', deviceId, bin.id, bin.fillLevel, bin.lat, bin.lng, lastThreshold);
    bin.fillLevel = 0;
    saveBinState(function () {
      runOptimization();
      alert('Simulated collection of ' + (bin.name || bin.id) + ' — fill reset to 0%.');
    });
  }

  function loadVehicles() {
    apiRef.call('Get', { typeName: 'DeviceStatusInfo' }, function (statuses) {
      debugLog('DeviceStatusInfo: ' + (statuses ? statuses.length : 0) + ' vehicles');
      debugSample('deviceStatuses', statuses);
      vehicleStatuses = statuses || [];
      vehicleStatuses.forEach(function (s) {
        if (s.latitude && s.longitude) addVehicleMarker(s);
      });
      runOptimization();
    }, function (err) {
      debugLog('DeviceStatusInfo error: ' + err);
      _debugData.lastError = String(err);
      runOptimization();
    });
  }

  /* ── Add-In lifecycle ── */
  return {
    initialize: function (api, _state, callback) {
      apiRef = api;
      debugLog('SmartRoute initialize');

      map = L.map('map').setView([depot.lat, depot.lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map);

      document.getElementById('threshold-slider').oninput = runOptimization;
      document.getElementById('write-route-btn').onclick  = writeRouteToGeotab;
      document.getElementById('log-collection-btn').onclick = logCollectionSimulate;

      setupAlgoCallback();

      loadZonesFromGeotab(function () {
        loadBinState(function () {
          loadVehicles();
        });
      });

      callback();
    },
    focus: function (api, _state) {
      apiRef = api;
      if (map) setTimeout(function () { map.invalidateSize(); }, 200);
    },
    blur: function () {}
  };
};
