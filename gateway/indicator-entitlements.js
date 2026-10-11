import crypto from 'node:crypto';
import {FieldValue} from 'firebase-admin/firestore';
import {adminDb} from './secure-session-store.js';
import {compile as compileTaScript} from './ta-script/index.js';

const clean=(v,max=180)=>String(v??'').trim().slice(0,max);
const isOwner=decoded=>String(decoded?.role||'').toLowerCase()==='owner';
const now=()=>Date.now();
const productId=v=>clean(v,120).toLowerCase();
const entitlementId=(indicatorId,uid)=>`${productId(indicatorId)}__${String(uid).replace(/[^A-Za-z0-9_-]/g,'_')}`;

function active(row){
  if(!row||String(row.status||'active')==='revoked')return false;
  const t=row.expiresAt?.toMillis?row.expiresAt.toMillis():row.expiresAt?new Date(row.expiresAt).getTime():null;
  return !t||t>now();
}

async function entitlementFor(uid,indicatorId){
  const id=entitlementId(indicatorId,uid),snap=await adminDb.collection('indicatorEntitlements').doc(id).get();
  return snap.exists?{id:snap.id,...snap.data()}:null;
}
function deviceHash(deviceId){return crypto.createHash('sha256').update(clean(deviceId,240)).digest('hex');}
async function bindEntitlementDevice(uid,indicatorId,deviceId){
  const id=entitlementId(indicatorId,uid),ref=adminDb.collection('indicatorEntitlements').doc(id),hash=deviceHash(deviceId);
  if(!clean(deviceId,240))throw Object.assign(new Error('A Trade Avata device identity is required for this private indicator.'),{status:400});
  return adminDb.runTransaction(async tx=>{
    const snap=await tx.get(ref);if(!snap.exists)throw Object.assign(new Error('Indicator access is not authorized for this Trade Avata account.'),{status:403});
    const row=snap.data()||{};if(!active(row))throw Object.assign(new Error('Indicator access has expired or was revoked.'),{status:403});
    const hashes=Array.isArray(row.deviceHashes)?row.deviceHashes.filter(Boolean):[],limit=Math.max(1,Math.min(20,Number(row.deviceAllowance)||3));
    if(hashes.includes(hash))return{...row,id,devicesUsed:hashes.length,deviceAllowance:limit};
    if(hashes.length>=limit)throw Object.assign(new Error(`Private indicator device allowance reached (${limit}). Revoke an old device or change the entitlement allowance.`),{status:403});
    const next=[...hashes,hash];tx.set(ref,{deviceHashes:next,lastDeviceBoundAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
    return{...row,id,deviceHashes:next,devicesUsed:next.length,deviceAllowance:limit};
  });
}

async function resolveTaId(taId){
  const id=clean(taId,64).toUpperCase();
  if(!/^TA-[A-Z0-9-]{4,}$/.test(id))throw Object.assign(new Error('Invalid TA ID.'),{status:400});
  const snap=await adminDb.collection('taIds').doc(id).get();
  if(!snap.exists)throw Object.assign(new Error('TA ID was not found.'),{status:404});
  return{taId:id,...snap.data()};
}

export async function listIndicatorEntitlements(decoded){
  if(!decoded?.uid)throw Object.assign(new Error('Sign in required'),{status:401});
  const snap=await adminDb.collection('indicatorEntitlements').where('uid','==',decoded.uid).get();
  return snap.docs.map(d=>{const x={id:d.id,...d.data()},devicesUsed=Array.isArray(x.deviceHashes)?x.deviceHashes.length:0;delete x.deviceHashes;return{...x,devicesUsed,active:active(x)};});
}

async function authorizeIndicator(decoded,indicatorId,{deviceId=''}={}){
  if(!decoded?.uid)throw Object.assign(new Error('Sign in required'),{status:401});
  const id=productId(indicatorId);if(!id)throw Object.assign(new Error('Indicator ID is required.'),{status:400});
  const owner=isOwner(decoded),grant=owner?null:await entitlementFor(decoded.uid,id);
  if(!owner&&!active(grant))throw Object.assign(new Error('Indicator access is not authorized for this Trade Avata account.'),{status:403});
  if(!owner)await bindEntitlementDevice(decoded.uid,id,deviceId);
  const snap=await adminDb.collection('indicatorPrograms').doc(id).get();
  if(!snap.exists)throw Object.assign(new Error('Authorized indicator program has not been securely deployed yet.'),{status:404});
  return{id,owner,grant,row:snap.data()||{}};
}

export async function getIndicatorProgram(decoded,indicatorId,{deviceId=''}={}){
  const {id,row}=await authorizeIndicator(decoded,indicatorId,{deviceId});
  const source=String(row.source||'');
  return{
    indicatorId:id,
    name:clean(row.name,160)||id,
    version:clean(row.version,40)||'1.0',
    defaultAttach:row.defaultAttach||'none',
    accessPolicy:row.accessPolicy||'owner_or_grant',
    entitlement:id,
    calculate:row.calculate||'bar-close',
    overlay:row.overlay!==false,
    settingsSchema:Array.isArray(row.settingsSchema)?row.settingsSchema:[],
    checksum:row.checksum||crypto.createHash('sha256').update(source).digest('hex'),
    execution:'server'
  };
}

export async function runIndicatorProgram(decoded,indicatorId,{deviceId='',bars=[],inputs={},pipSize=.01,hasLiveBar=true}={}){
  const {id,owner,row}=await authorizeIndicator(decoded,indicatorId,{deviceId});
  const source=String(row.source||'');if(!source.trim())throw Object.assign(new Error('Private indicator source is not deployed on the secure server.'),{status:503});
  if(!Array.isArray(bars)||bars.length<2)throw Object.assign(new Error('At least two market bars are required.'),{status:400});
  if(bars.length>5000)throw Object.assign(new Error('Private indicator requests are limited to 5,000 bars.'),{status:413});
  const safeBars=bars.map((b,i)=>{const out={time:Number(b?.time),open:Number(b?.open),high:Number(b?.high),low:Number(b?.low),close:Number(b?.close),volume:Number(b?.volume??b?.tickVolume??0)};if(!Number.isFinite(out.time)||!['open','high','low','close','volume'].every(k=>Number.isFinite(out[k])))throw Object.assign(new Error(`Invalid market bar at index ${i}.`),{status:400});if(out.high<Math.max(out.open,out.close,out.low)||out.low>Math.min(out.open,out.close,out.high))throw Object.assign(new Error(`Invalid OHLC geometry at index ${i}.`),{status:400});return out;});
  const safeInputs={};for(const [k,v] of Object.entries(inputs&&typeof inputs==='object'?inputs:{}).slice(0,100)){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))continue;if(['number','string','boolean'].includes(typeof v))safeInputs[k]=typeof v==='string'?clean(v,500):v;}
  let compiled;try{compiled=compileTaScript(source);}catch(err){throw Object.assign(new Error(`Private indicator compile failed: ${err?.message||err}`),{status:500});}
  const authorization={verified:true,isOwner:owner,role:owner?'owner':'member',entitlements:[id],grants:[id]};
  let result;try{result=compiled.run(safeBars,{inputs:safeInputs,hasLiveBar:hasLiveBar!==false,pipSize:Number(pipSize)||.01,authorization,enforceAccess:true,allowAutomation:false});}catch(err){throw Object.assign(new Error(`Private indicator execution failed: ${err?.message||err}`),{status:500});}
  return{
    indicatorId:id,name:clean(row.name,160)||id,version:clean(row.version,40)||'1.0',overlay:row.overlay!==false,calculate:row.calculate||'bar-close',descriptor:compiled.descriptor,
    result:{plots:(result.plots||[]).map(p=>({name:p.name,values:p.values})),markers:(result.markers||[]).slice(-500),signals:(result.signals||[]).slice(-500),alerts:(result.alerts||[]).slice(-500),orderIntents:(result.orderIntents||[]).slice(-200),backtest:{summary:result.backtest?.summary||null},processedThrough:result.processedThrough}
  };
}

export async function grantIndicatorByTaId(decoded,{taId,indicatorId='gold-hunter-v4',duration='until-revoked',deviceAllowance=3}={}){
  if(!isOwner(decoded))throw Object.assign(new Error('Verified Owner authority is required.'),{status:403});
  const target=await resolveTaId(taId),id=productId(indicatorId);if(!id)throw Object.assign(new Error('Indicator ID is required.'),{status:400});
  const days={"7d":7,"30d":30,"3m":90,"6m":180,"1y":365}[String(duration||'').toLowerCase()];
  const expiresAt=days?new Date(now()+days*86400000):null;
  const docId=entitlementId(id,target.uid);
  const payload={
    uid:target.uid,taId:target.taId,indicatorId:id,status:'active',startsAt:FieldValue.serverTimestamp(),
    expiresAt:expiresAt||null,deviceAllowance:Math.max(1,Math.min(20,Number(deviceAllowance)||3)),deviceHashes:[],
    grantedByUid:decoded.uid,updatedAt:FieldValue.serverTimestamp()
  };
  await adminDb.collection('indicatorEntitlements').doc(docId).set(payload,{merge:true});
  return{...payload,id:docId,expiresAt:expiresAt?.toISOString()||null};
}

export async function revokeIndicatorByTaId(decoded,{taId,indicatorId='gold-hunter-v4'}={}){
  if(!isOwner(decoded))throw Object.assign(new Error('Verified Owner authority is required.'),{status:403});
  const target=await resolveTaId(taId),id=productId(indicatorId),docId=entitlementId(id,target.uid);
  await adminDb.collection('indicatorEntitlements').doc(docId).set({
    uid:target.uid,taId:target.taId,indicatorId:id,status:'revoked',revokedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),grantedByUid:decoded.uid
  },{merge:true});
  return{ok:true,id:docId,indicatorId:id,taId:target.taId};
}

export async function listOwnerIndicatorGrants(decoded,indicatorId='gold-hunter-v4'){
  if(!isOwner(decoded))throw Object.assign(new Error('Verified Owner authority is required.'),{status:403});
  const id=productId(indicatorId);
  const snap=await adminDb.collection('indicatorEntitlements').where('indicatorId','==',id).get();
  return snap.docs.map(d=>{const x={id:d.id,...d.data()},devicesUsed=Array.isArray(x.deviceHashes)?x.deviceHashes.length:0;delete x.deviceHashes;return{...x,devicesUsed,active:active(x)};});
}
