/**
 * Master Test Runner
 * Executes all protocol decoders and engine test suites.
 */
import { runProtocolTests } from './protocols.test.ts';
import { runEngineTests } from './engines.test.ts';

console.log('=====================================================');
console.log('  GPS Fleet Management Platform - Automated Tests   ');
console.log('=====================================================');

const p1 = runProtocolTests();
const p2 = runEngineTests();

if (p1 && p2) {
  console.log('🎉 ALL TEST SUITES PASSED SUCCESSFULLY (100%)\n');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED\n');
  process.exit(1);
}
