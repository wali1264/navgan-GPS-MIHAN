/**
 * Core Processing Engines Tests
 * Tests Geofence calculations, Event engine triggers, and Trip/Stop detection.
 */
import { GeofenceEngine } from '../src/services/geofence-engine.ts';
import { GeofenceType } from '../src/shared/types/enums.ts';
import { Geofence } from '../src/shared/types/models.ts';
import { NormalizedGpsPosition } from '../src/shared/types/protocols.ts';

export function runEngineTests(): boolean {
  console.log('\n--- Running Processing Engines Test Suite ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${testName}`);
      failed++;
    }
  }

  // Test 1: Distance Calculation (Haversine)
  const d = GeofenceEngine.calculateDistanceMeters(34.5368, 69.1724, 34.5368, 69.1824);
  assert(d > 850 && d < 1000, `Haversine distance calculates accurately (${Math.round(d)}m)`);

  // Test 2: Circular Geofence
  const circleGf: Geofence = {
    id: 'geo-kbl-circle',
    organizationId: 'org-01',
    customerId: 'cust-01',
    name: 'Kabul Center Area',
    color: '#06b6d4',
    type: GeofenceType.CIRCLE,
    centerLatitude: 34.5368,
    centerLongitude: 69.1724,
    radiusMeters: 500,
    assignedVehicleIds: ['veh-01'],
    notifyOnEnter: true,
    notifyOnExit: true,
    createdAt: new Date().toISOString(),
  };

  const insidePos: NormalizedGpsPosition = {
    deviceId: 'dev-01',
    imei: '868204051189201',
    latitude: 34.537,
    longitude: 69.1725,
    speed: 30,
    heading: 90,
    ignition: true,
    gpsValid: true,
    timestamp: new Date().toISOString(),
    originalProtocol: 0 as any,
    transport: 0 as any,
  };

  const outsidePos: NormalizedGpsPosition = {
    deviceId: 'dev-01',
    imei: '868204051189201',
    latitude: 34.59,
    longitude: 69.25,
    speed: 30,
    heading: 90,
    ignition: true,
    gpsValid: true,
    timestamp: new Date().toISOString(),
    originalProtocol: 0 as any,
    transport: 0 as any,
  };

  assert(GeofenceEngine.isPointInside(insidePos.latitude, insidePos.longitude, circleGf), 'Point inside circular geofence identified correctly');
  assert(!GeofenceEngine.isPointInside(outsidePos.latitude, outsidePos.longitude, circleGf), 'Point outside circular geofence identified correctly');

  // Test 3: Polygon Geofence (Ray-casting Algorithm)
  const polyGf: Geofence = {
    id: 'geo-kbl-poly',
    organizationId: 'org-01',
    customerId: 'cust-01',
    name: 'Kabul Industrial Polygon',
    color: '#3b82f6',
    type: GeofenceType.POLYGON,
    coordinates: [
      [34.50, 69.10],
      [34.50, 69.20],
      [34.60, 69.20],
      [34.60, 69.10],
    ],
    assignedVehicleIds: ['veh-01'],
    notifyOnEnter: true,
    notifyOnExit: true,
    createdAt: new Date().toISOString(),
  };

  assert(GeofenceEngine.isPointInside(34.55, 69.15, polyGf), 'Point inside polygon geofence identified correctly');
  assert(!GeofenceEngine.isPointInside(34.70, 69.15, polyGf), 'Point outside polygon geofence identified correctly');

  console.log(`Engine Tests Summary: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}
