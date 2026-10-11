import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {adminDb} from '../secure-session-store.js';

const file=process.env.TA_PRIVATE_INDICATOR_FILE;
const indicatorId=String(process.env.TA_PRIVATE_INDICATOR_ID||'gold-hunter-v4').toLowerCase();
if(!file)throw new Error('Set TA_PRIVATE_INDICATOR_FILE to a local private .tas file. Never commit the private source to a public repository.');
const source=await fs.readFile(file,'utf8');
if(!/^\s*ta_script\s+1\.0\b/m.test(source))throw new Error('Private indicator file is not TA Script 1.0.');

function inferSettings(source){
  const rows=[];
  for(const line of String(source||'').split(/\r?\n/)){
    const m=/^\s*input\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/.exec(line);if(!m)continue;
    const key=m[1],raw=m[2].trim();let type='text',value=raw;
    if(/^[-+]?\d+(?:\.\d+)?$/.test(raw)){type='number';value=Number(raw);}
    else if(/^(true|false)$/i.test(raw)){type='boolean';value=/^true$/i.test(raw);}
    else if((raw.startsWith('"')&&raw.endsWith('"'))||(raw.startsWith("'")&&raw.endsWith("'"))){type='text';value=raw.slice(1,-1);}
    else continue;
    rows.push({key,label:key.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),type,default:value});
  }
  return rows.slice(0,200);
}

const checksum=crypto.createHash('sha256').update(source).digest('hex');
await adminDb.collection('indicatorPrograms').doc(indicatorId).set({
  indicatorId,name:process.env.TA_PRIVATE_INDICATOR_NAME||'Gold Hunter V4',version:process.env.TA_PRIVATE_INDICATOR_VERSION||'4.0',
  source,checksum,accessPolicy:'owner_or_grant',defaultAttach:'owner',calculate:'bar-close',overlay:true,settingsSchema:inferSettings(source),updatedAt:new Date()
},{merge:true});
console.log(`Seeded ${indicatorId} (${checksum.slice(0,12)}…) securely.`);
