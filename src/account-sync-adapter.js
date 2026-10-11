/* Trade Avata V12 cross-device settings/workspace sync adapter.
 * Firestore is used for account preferences and coarse chart/workspace state only.
 * Live market ticks never pass through Firestore.
 */
import {
  doc,getDoc,setDoc,onSnapshot,serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const CACHE_KEY='tradeAvataAccountSyncV12';
const DEVICE_KEY='tradeAvataDeviceIdV12';
const clean=s=>String(s??'').slice(0,160);
const clone=v=>{try{return structuredClone(v);}catch{return JSON.parse(JSON.stringify(v));}};

function authAdapter(){return window.TRADE_AVATA_AUTH_ADAPTER||null;}
function current(){return authAdapter()?.getCurrentUser?.()||null;}
function db(){return authAdapter()?.db||null;}
function ref(){const u=current(),firestore=db();if(!u?.uid||!firestore)return null;return doc(firestore,'accountSettings',u.uid);}
function deviceId(){
  try{
    let id=localStorage.getItem(DEVICE_KEY);
    if(!id){id=`dev-${crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}`;localStorage.setItem(DEVICE_KEY,id);}
    return id;
  }catch{return `dev-session-${Math.random().toString(36).slice(2)}`;}
}
function cached(){try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'null');}catch{return null;}}
function writeCache(v){try{localStorage.setItem(CACHE_KEY,JSON.stringify(v));}catch{}}

async function load(){
  const r=ref();if(!r)return cached();
  try{const snap=await getDoc(r);if(!snap.exists())return cached();const v=snap.data();writeCache(v);return v;}catch{return cached();}
}

async function save(payload={}){
  const r=ref(),u=current();if(!r||!u?.uid)throw new Error('Sign in required for account sync.');
  const value={
    uid:u.uid,
    schemaVersion:12,
    preferences:clone(payload.preferences||{}),
    identityPublic:{taId:clean(payload.identity?.taId||u.taId||'')},
    preferenceRevision:`${Date.now()}-${deviceId()}`,
    updatedByDevice:deviceId(),
    updatedAt:serverTimestamp()
  };
  await setDoc(r,value,{merge:true});
  writeCache({...cached(),...value,updatedAt:new Date().toISOString()});
  return value;
}

async function saveWorkspaceState({preferences={},activeChart=null,layoutState=null,drawings=null,linked=false}={}){
  const r=ref(),u=current();if(!r||!u?.uid)return null;
  const now=Date.now();
  const patch={
    uid:u.uid,schemaVersion:12,
    v12Preferences:clone(preferences),
    layoutState:clone(layoutState),
    drawings:clone(drawings),
    workspaceRevision:`${now}-${deviceId()}`,
    updatedByDevice:deviceId(),updatedAt:serverTimestamp()
  };
  if(linked&&activeChart){
    patch.live={
      activeChart:clone(activeChart),
      revision:`${now}-${deviceId()}`,
      updatedByDevice:deviceId(),
      updatedAtClient:now
    };
  }
  await setDoc(r,patch,{merge:true});
  return patch;
}

async function publishActiveChart(activeChart){
  const r=ref(),u=current();if(!r||!u?.uid)return null;
  const now=Date.now();
  const live={activeChart:clone(activeChart),revision:`${now}-${deviceId()}`,updatedByDevice:deviceId(),updatedAtClient:now};
  await setDoc(r,{uid:u.uid,schemaVersion:12,live,updatedAt:serverTimestamp()},{merge:true});
  return live;
}

function subscribe(fn){
  const r=ref();if(!r||typeof fn!=='function')return()=>{};
  return onSnapshot(r,snap=>{
    if(!snap.exists())return;
    const value=snap.data();writeCache(value);fn(value);
  },()=>{});
}

const adapter={load,save,saveWorkspaceState,publishActiveChart,subscribe,deviceId,getCached:cached};
window.TRADE_AVATA_CLOUD_SETTINGS=adapter;
window.TRADE_AVATA_ACCOUNT_SYNC=adapter;
export default adapter;
