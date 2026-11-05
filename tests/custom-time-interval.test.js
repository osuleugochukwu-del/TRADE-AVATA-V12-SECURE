import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCustomTimeInterval} from '../src/custom-time-interval.js';

test('SECURE accepts valid custom live time durations',()=>{
 for(const [input,expected] of [['1s','1s'],['12s','12s'],['59s','59s'],['7m','7m'],['13m','13m'],['2h','2h'],['2d','2d'],['30d','30d'],[' 7m ','7m']]){
  const result=parseCustomTimeInterval(input);
  assert.equal(result.ok,true,input);
  assert.equal(result.value,expected,input);
 }
});
test('SECURE rejects malformed and unsupported custom durations',()=>{
 for(const input of ['', '0s','60s','90s','1.5m','7','3w','1M','1mo','31d','721h','43201m','10000000m','-3m','3ms']){
  assert.equal(parseCustomTimeInterval(input).ok,false,input);
 }
});
test('SECURE validation never creates chart bars or synthetic market data',()=>{
 const result=parseCustomTimeInterval('7m');
 assert.deepEqual(Object.keys(result).sort(),['ok','seconds','value']);
 assert.equal(result.seconds,420);
});
