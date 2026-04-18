import { setupRenderingContext } from 'ember-vitest';
import App from './app/app.ts';
import { Text, render } from 'ember-tui';
import { rerender } from '@ember/test-helpers';
import { trackedObject } from '@ember/reactive/collections';
import { writeHeapSnapshot } from 'v8';

async function runMemoryTest() {
  console.log('Starting memory leak test...');
  
  const ctx = await setupRenderingContext(App);
  const state = trackedObject({ showFirst: true });

  await ctx.render(
    `{{#if state.showFirst}}
      <Text @backgroundColor="green">First element</Text>
    {{else}}
      <Text @backgroundColor="blue">Second element</Text>
    {{/if}}`
  );

  const warmupIterations = 50;
  console.log(`Warmup: ${warmupIterations} iterations...`);
  for (let i = 0; i < warmupIterations; i++) {
    state.showFirst = !state.showFirst;
    await rerender();
    render(ctx.element);
  }

  if (typeof global.gc === 'function') {
    global.gc();
  }

  console.log('Taking heap snapshot BEFORE...');
  const beforeSnapshot = writeHeapSnapshot('./heap-before.heapsnapshot');
  console.log('Snapshot saved:', beforeSnapshot);

  const heapBefore = process.memoryUsage().heapUsed;
  console.log('Heap before:', (heapBefore / 1024 / 1024).toFixed(2), 'MB');

  const iterations = 500; // Reduced for faster execution
  console.log(`Running ${iterations} iterations...`);
  for (let i = 0; i < iterations; i++) {
    state.showFirst = !state.showFirst;
    await rerender();
    render(ctx.element);
    
    if (i % 100 === 0) {
      console.log(`Progress: ${i}/${iterations}`);
    }
  }

  if (typeof global.gc === 'function') {
    global.gc();
  }

  const heapAfter = process.memoryUsage().heapUsed;
  const heapGrowth = heapAfter - heapBefore;
  console.log('Heap after:', (heapAfter / 1024 / 1024).toFixed(2), 'MB');
  console.log('Heap growth:', (heapGrowth / 1024 / 1024).toFixed(2), 'MB');

  console.log('Taking heap snapshot AFTER...');
  const afterSnapshot = writeHeapSnapshot('./heap-after.heapsnapshot');
  console.log('Snapshot saved:', afterSnapshot);

  console.log('\nMemory leak detected:', heapGrowth > 2 * 1024 * 1024 ? 'YES' : 'NO');
  
  await ctx[Symbol.asyncDispose]();
  process.exit(0);
}

runMemoryTest().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
