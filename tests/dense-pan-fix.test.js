import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('dense pan fix is loaded and cached without replacing the native chart',()=>{
  const index=read('index.html');
  const sw=read('sw.js');
  const fix=read('src/dense-pan-fix.js');
  assert.match(index,/src\/dense-pan-fix\.js/);
  assert.match(sw,/src\/dense-pan-fix\.js/);
  assert.match(fix,/TradeAvataNativeChart/);
  assert.match(fix,/ta-chart-interacting/);
  assert.match(fix,/requestAnimationFrame/);
  assert.match(fix,/originalEmitCrosshair/);
  assert.match(fix,/ta-performance-mode/);
});

test('existing R3 overlay throttle is activated by the dense pan interaction marker',()=>{
  const live=read('src/live-ready-upgrade.js');
  const fix=read('src/dense-pan-fix.js');
  assert.match(live,/classList\.contains\('ta-chart-interacting'\)/);
  assert.match(fix,/classList\.add\('ta-chart-interacting'\)/);
  assert.match(fix,/classList\.remove\('ta-chart-interacting'/);
});
