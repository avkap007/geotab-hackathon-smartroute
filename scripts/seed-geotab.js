#!/usr/bin/env node
/**
 * Seed 10 Toronto waste-collection routes into Geotab.
 * Creates Zones (bins) and Routes (with routePlanItemCollection).
 * Also generates data/bin-data.json for the addin to consume at runtime.
 *
 * Run once:  node scripts/seed-geotab.js
 */
const path = require('path');
const fs = require('fs');

/* ── Load .env ── */
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').replace(/\r/g, '').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) {
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[m[1].trim()] = val;
    }
  });
}

const DB = process.env.GEOTAB_DATABASE;
const USER = process.env.GEOTAB_USERNAME;
const PASS = process.env.GEOTAB_PASSWORD;
const SERVER = process.env.GEOTAB_SERVER || 'my.geotab.com';

if (!DB || !USER || !PASS) {
  console.error('Missing GEOTAB_DATABASE, GEOTAB_USERNAME, or GEOTAB_PASSWORD in .env');
  process.exit(1);
}

const apiUrl = `https://${SERVER}/apiv1`;

function zonePoints(lat, lng) {
  const o = 0.0001;
  return [
    { x: lng - o, y: lat - o },
    { x: lng + o, y: lat - o },
    { x: lng + o, y: lat + o },
    { x: lng - o, y: lat + o },
    { x: lng - o, y: lat - o }
  ];
}

/**
 * Generate synthetic collection logs for a bin.
 * Creates entries every 3-7 days over the past 45 days.
 */
function generateCollectionLogs(binName) {
  const logs = [];
  const now = new Date();
  const MS_PER_DAY = 86400000;

  let cursor = new Date(now.getTime() - 45 * MS_PER_DAY);
  while (cursor < now) {
    const intervalDays = 3 + Math.floor(Math.random() * 5);
    cursor = new Date(cursor.getTime() + intervalDays * MS_PER_DAY);
    if (cursor >= now) break;

    const fillPct = 55 + Math.floor(Math.random() * 41);
    logs.push({
      binName,
      collectedAt: cursor.toISOString(),
      fillPctAtCollection: fillPct
    });
  }
  return logs;
}

async function main() {
  console.log(`Authenticating to ${DB} on ${SERVER}...`);
  const authRes = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'Authenticate',
      params: { database: DB, userName: USER, password: PASS }
    })
  });
  const authData = await authRes.json();
  if (authData.error) {
    console.error('Auth failed:', authData.error.message);
    process.exit(1);
  }
  const credentials = authData.result.credentials;
  console.log('Connected.\n');

  const api = (method, params) =>
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, params: { ...params, credentials } })
    }).then(r => r.json()).then(d => {
      if (d.error) throw new Error(`${method} failed: ${d.error.message}`);
      return d.result;
    });

  /* ── Idempotency: fetch existing data ── */
  console.log('Checking for existing data...');

  const existingZones = await api('Get', { typeName: 'Zone', search: {} });
  const zoneMap = {};
  for (const z of existingZones) {
    if (z.name && z.name.startsWith('SR-')) {
      zoneMap[z.name] = z.id;
    }
  }
  console.log(`  Found ${Object.keys(zoneMap).length} existing SR- zones`);

  const existingRoutes = await api('Get', { typeName: 'Route', search: {} });
  const routeMap = {};
  for (const r of existingRoutes) {
    routeMap[r.name] = r.id;
  }
  console.log(`  Found ${Object.keys(routeMap).length} existing routes`);
  console.log();

  /* ── Load route definitions ── */
  const routesPath = path.join(__dirname, '../data/seed-routes.json');
  const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
  console.log(`Loaded ${routes.length} route definitions.\n`);

  const summary = [];
  const binData = {};

  for (let ri = 0; ri < routes.length; ri++) {
    const route = routes[ri];
    const routeLabel = `[${ri + 1}/${routes.length}] ${route.name}`;
    console.log(`${routeLabel}`);
    console.log(`  Creating ${route.bins.length} zones...`);

    /* ── Create Zones (skip existing) ── */
    const zoneIds = [];
    let zonesCreated = 0, zonesReused = 0;
    for (const bin of route.bins) {
      const zoneName = `SR-${bin.name}`;
      if (zoneMap[zoneName]) {
        zoneIds.push({ zoneId: zoneMap[zoneName], bin });
        zonesReused++;
        process.stdout.write('~');
        continue;
      }
      try {
        const zoneId = await api('Add', {
          typeName: 'Zone',
          entity: {
            name: zoneName,
            points: zonePoints(bin.lat, bin.lng),
            displayed: true,
            groups: [{ id: 'GroupCompanyId' }]
          }
        });
        zoneIds.push({ zoneId, bin });
        zoneMap[zoneName] = zoneId;
        zonesCreated++;
        process.stdout.write('.');
      } catch (err) {
        console.error(`\n  Zone "${bin.name}" failed: ${err.message}`);
        zoneIds.push({ zoneId: null, bin });
      }
    }
    console.log(` ${zonesCreated} created, ${zonesReused} reused`);

    const validZones = zoneIds.filter(z => z.zoneId);
    if (validZones.length === 0) {
      console.log('  Skipping route (no zones created)');
      continue;
    }

    /* ── Create Route (skip existing) ── */
    let routeId;
    if (routeMap[route.name]) {
      routeId = routeMap[route.name];
      console.log(`  Route exists: ${routeId}`);
    } else {
      try {
        const routePlanItems = validZones.map((z, i) => ({
          zone: { id: z.zoneId },
          sequence: i
        }));
        routeId = await api('Add', {
          typeName: 'Route',
          entity: {
            name: route.name,
            comment: 'SmartRoute demo - waste collection',
            routeType: 'Basic',
            routePlanItemCollection: routePlanItems
          }
        });
        routeMap[route.name] = routeId;
        console.log(`  Route created: ${routeId}`);
      } catch (err) {
        console.error(`  Route creation failed: ${err.message}`);
        try {
          routeId = await api('Add', {
            typeName: 'Route',
            entity: {
              name: route.name,
              comment: 'SmartRoute demo - waste collection',
              routeType: 'Basic'
            }
          });
          routeMap[route.name] = routeId;
          console.log(`  Route created (without plan items): ${routeId}`);
        } catch (err2) {
          console.error(`  Route creation totally failed: ${err2.message}`);
          continue;
        }
      }
    }

    /* ── Build local bin data for this route ── */
    const collectionLogs = [];
    for (const z of validZones) {
      collectionLogs.push(...generateCollectionLogs(z.bin.name));
    }

    binData[route.name] = {
      depot: route.depot,
      bins: validZones.map(z => ({
        name: z.bin.name,
        lat: z.bin.lat,
        lng: z.bin.lng,
        fillLevel: z.bin.fillLevel
      })),
      collectionLogs
    };

    console.log(`  Generated ${collectionLogs.length} collection log entries`);
    summary.push({ name: route.name, routeId, zones: validZones.length, logs: collectionLogs.length });
    console.log();
  }

  /* ── Write bin-data.json ── */
  const binDataPath = path.join(__dirname, '../data/bin-data.json');
  fs.writeFileSync(binDataPath, JSON.stringify(binData, null, 2));
  console.log(`Wrote ${binDataPath}`);

  /* ── Summary ── */
  console.log('\n════════════════════════════════════════');
  console.log('  SEED COMPLETE');
  console.log('════════════════════════════════════════');
  for (const s of summary) {
    console.log(`  ${s.name}: route=${s.routeId}, ${s.zones} zones, ${s.logs} logs`);
  }
  console.log(`\nTotal: ${summary.length} routes seeded.`);
  console.log('Rebuild the add-in and refresh Geotab to see the routes.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
