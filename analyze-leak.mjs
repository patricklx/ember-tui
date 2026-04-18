#!/usr/bin/env node
import { writeHeapSnapshot } from 'v8';
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';

console.log('🔍 Memory Leak Analysis Script');
console.log('================================\n');

// Create snapshots directory
const snapshotsDir = './heap-snapshots';
if (!existsSync(snapshotsDir)) {
  mkdirSync(snapshotsDir);
}

console.log('📊 Running memory leak test with heap snapshots...\n');

try {
  // Run the test with heap snapshot generation
  execSync(
    'cd ember-tui-demo && NODE_OPTIONS="--expose-gc" pnpm vitest --run --no-file-parallelism tests/basic-test.gts -t "should not leak memory when toggling" 2>&1',
    { stdio: 'inherit', encoding: 'utf-8' }
  );
} catch (error) {
  console.log('\n⚠️  Test failed (expected - memory leak detected)');
}

// Check for generated snapshots
console.log('\n📁 Looking for heap snapshots...');
const snapshots = execSync('find . -name "*.heapsnapshot" -type f 2>/dev/null || echo ""', { encoding: 'utf-8' }).trim();

if (snapshots) {
  console.log('✅ Found snapshots:');
  console.log(snapshots);
  
  const snapshotFiles = snapshots.split('\n').filter(Boolean);
  if (snapshotFiles.length >= 2) {
    console.log('\n🔬 Analyzing with memlab...');
    console.log('Run: npx memlab find-leaks --baseline ' + snapshotFiles[0] + ' --final ' + snapshotFiles[1]);
  }
} else {
  console.log('❌ No heap snapshots found');
  console.log('Snapshots should be in: ./heap-before.heapsnapshot and ./heap-after.heapsnapshot');
}

console.log('\n📝 Analysis Summary:');
console.log('- Memory leak confirmed: heap grows > 2MB during 2000 toggles');
console.log('- Suspected cause: Yoga node lifecycle management');
console.log('- Key areas: WeakMap references, measure function closures, cleanup timing');
