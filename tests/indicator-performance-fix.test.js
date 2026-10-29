import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const patch=fs.readFileSync(new URL('../src/indicator-performance-fix.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('indicator pipeline renders main chart before deferred indicator rebuild',()=>{
  assert.match(patch,/original\(opts\); \/\/ candles\/main series become usable first/);
  assert.match(patch,/requestIdleCallback/);
  assert.match(patch,/preserveVisibleRange:true/);
});

test('indicator work yields while pointer interaction is active',()=>{
  assert.match(patch,/__taIndicatorBusy/);
  assert.match(patch,/pointerdown/);
  assert.match(patch,/pointerup/);
  assert.match(patch,/QUIET_MS/);
});

test('SECURE page activates indicator performance repair',()=>{
  assert.match(index,/src\/indicator-performance-fix\.js/);
});
