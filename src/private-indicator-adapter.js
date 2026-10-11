/* Secure private TA Script indicator execution.
 * Proprietary source never leaves the Trade Avata backend. The browser receives metadata and calculated results only.
 */
const cleanBase=v=>String(v||'').trim().replace(/\/$/,'');
function base(){return cleanBase(window.TRADE_AVATA_BACKEND_CONFIG?.apiHttp||window.TRADE_AVATA_CTRADER_CONFIG?.gatewayHttp||'');}
function deviceId(){try{return window.TRADE_AVATA_ACCOUNT_SYNC?.deviceId?.()||localStorage.getItem('tradeAvataDeviceIdV12')||'';}catch{return'';}}
async function token(){const t=await window.TRADE_AVATA_AUTH_ADAPTER?.getIdToken?.();if(!t)throw new Error('Sign in to Trade Avata first.');return t;}
async function request(path,{method='GET',body=null}={}){
  const b=base();if(!b)throw new Error('Trade Avata secure backend is not configured.');
  const appCheck=await window.TRADE_AVATA_AUTH_ADAPTER?.getAppCheckToken?.();
  if(window.TRADE_AVATA_SECURITY_CONFIG?.requireAppCheck===true&&!appCheck)throw new Error('Trade Avata App Check is not configured for this deployment.');
  const r=await fetch(`${b}${path}`,{method,credentials:'omit',headers:{Authorization:`Bearer ${await token()}`,'X-TA-Device-ID':deviceId(),...(appCheck?{'X-Firebase-AppCheck':appCheck}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||`Indicator service returned ${r.status}.`);return j;
}
async function entitlements(){return (await request('/api/indicators/entitlements')).entitlements||[];}
async function program(indicatorId){return (await request(`/api/indicators/program/${encodeURIComponent(indicatorId)}`)).program;}
async function run(indicatorId,{bars=[],inputs={},pipSize=.01,hasLiveBar=true}={}){return (await request(`/api/indicators/run/${encodeURIComponent(indicatorId)}`,{method:'POST',body:{bars,inputs,pipSize,hasLiveBar}})).program;}
async function grant({taId,indicatorId='gold-hunter-v4',duration='until-revoked',deviceAllowance=3}){return (await request('/api/indicators/grant',{method:'POST',body:{taId,indicatorId,duration,deviceAllowance}})).grant;}
async function revoke({taId,indicatorId='gold-hunter-v4'}){return (await request('/api/indicators/revoke',{method:'POST',body:{taId,indicatorId}})).result;}
async function grants(indicatorId='gold-hunter-v4'){return (await request(`/api/indicators/grants?indicatorId=${encodeURIComponent(indicatorId)}`)).grants||[];}
const adapter={entitlements,program,run,grant,revoke,grants};
window.TRADE_AVATA_PRIVATE_INDICATORS=adapter;
export default adapter;
