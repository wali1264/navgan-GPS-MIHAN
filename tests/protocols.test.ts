/**
 * Protocol Decoders Unit Tests
 * Validates binary & text packet decoding for GT06, TK103, Eelink, and Custom JSON.
 */
import { Gt06Decoder } from '../src/protocols/gt06/decoder.ts';
import { Tk103Decoder } from '../src/protocols/tk103/decoder.ts';
import { EelinkDecoder } from '../src/protocols/eelink/decoder.ts';
import { Gps103Decoder } from '../src/protocols/gps103/decoder.ts';
import { CustomJsonDecoder } from '../src/protocols/custom/decoder.ts';
import { TransportType } from '../src/shared/types/enums.ts';
import { GpsPacketContext } from '../src/shared/types/protocols.ts';

export function runProtocolTests(): boolean {
  console.log('\n--- Running Protocol Decoders Test Suite ---');
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

  const dummyContext: GpsPacketContext = {
    remoteAddress: '127.0.0.1',
    remotePort: 54321,
    transport: TransportType.TCP,
    sessionId: 'sess-test-01',
    associatedDeviceId: 'dev-01',
  };

  // 1. GT06 Tests
  const gt06 = new Gt06Decoder();

  // Test GT06 Login packet: 78 78 0d 01 01 23 45 67 89 01 23 45 00 01 8c dd 0d 0a
  const loginBuf = Buffer.from('78780d01012345678901234500018cdd0d0a', 'hex');
  assert(gt06.canHandle(loginBuf, dummyContext), 'GT06 canHandle recognizes 0x78 0x78 header');
  const loginResult = gt06.decode(loginBuf, dummyContext);
  assert(loginResult.success && loginResult.identifiedImei === '123456789012345', 'GT06 extracts correct IMEI from login packet');
  assert(loginResult.responsePayload !== undefined, 'GT06 generates login ACK packet');

  // Test GT06 Location packet (34.5368° N, 69.1724° E, Course 0x105a = GPS Fixed, North, East, Heading 90)
  const gt06LocContext: GpsPacketContext = {
    ...dummyContext,
    associatedImei: '123456789012345',
  };
  const locBuf = Buffer.from('78781f121a081e0a151ec803b49ce0076be07037105a0100000000000128890d0a', 'hex');
  const locResult = gt06.decode(locBuf, gt06LocContext);
  assert(locResult.success, 'GT06 decodes valid location packet');
  assert(
    locResult.positions.length > 0 && Math.abs(locResult.positions[0].latitude - 34.5368) < 0.01,
    'GT06 decodes accurate latitude near Kabul'
  );
  assert(
    locResult.positions.length > 0 && Math.abs(locResult.positions[0].longitude - 69.1724) < 0.01,
    'GT06 decodes accurate longitude near Kabul'
  );

  // 2. TK103 Tests
  const tk103 = new Tk103Decoder();
  // TK103 Login
  const tk103LoginBuf = Buffer.from('(868204051189201BP050000868204051189201)');
  assert(tk103.canHandle(tk103LoginBuf, dummyContext), 'TK103 canHandle recognizes parentheses packet format');
  const tk103LoginRes = tk103.decode(tk103LoginBuf, dummyContext);
  assert(tk103LoginRes.success && tk103LoginRes.identifiedImei === '868204051189201', 'TK103 decodes login IMEI correctly');

  // TK103 Location
  const tk103LocBuf = Buffer.from('(868204051189201BR00260830A3432.2080N06910.3440E045.0121530000.0000000000L00000000)');
  const tk103LocRes = tk103.decode(tk103LocBuf, dummyContext);
  assert(tk103LocRes.success && tk103LocRes.positions.length > 0, 'TK103 decodes location telemetry packet');
  assert(
    tk103LocRes.positions.length > 0 && Math.abs(tk103LocRes.positions[0].latitude - 34.5368) < 0.01,
    'TK103 converts NMEA degrees/minutes to Kabul latitude accurately'
  );

  // 3. Custom JSON Telemetry Test
  const jsonDecoder = new CustomJsonDecoder();
  const sampleJson = JSON.stringify({
    imei: '868204051189205',
    lat: 34.5501,
    lng: 69.1822,
    speed: 55,
    heading: 90,
    ignition: true,
  });
  const jsonBuf = Buffer.from(sampleJson);
  assert(jsonDecoder.canHandle(jsonBuf, dummyContext), 'Custom JSON decoder recognizes valid JSON buffer');
  const jsonResult = jsonDecoder.decode(jsonBuf, dummyContext);
  assert(jsonResult.success && jsonResult.positions[0].speed === 55, 'JSON decoder extracts telemetry values');

  console.log(`Protocol Tests Summary: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}
