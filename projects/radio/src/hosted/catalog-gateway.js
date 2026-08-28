const SEED_SERVERS=[
  'https://de1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info'
];
const cleanPath=value=>{const path=String(value||'').trim();return path.startsWith('/')?path:`/${path}`};
const shuffle=list=>{const out=[...list];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out};
const uniqueHttps=value=>[...new Set((Array.isArray(value)?value:[]).map(String).map(x=>x.trim()).filter(x=>x.startsWith('https://')))];
export function createHostedCatalogGateway({fetchImpl=globalThis.fetch?.bind(globalThis)}={}){
  if(typeof fetchImpl!=='function')throw new TypeError('fetch implementation required');
  let servers=shuffle(SEED_SERVERS),current=servers[0]||'';
  async function discover(){
    for(const base of [...servers,...SEED_SERVERS]){
      try{
        const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),3500);
        const response=await fetchImpl(`${base}/json/servers`,{headers:{Accept:'application/json'},cache:'no-store',referrerPolicy:'no-referrer',signal:ctl.signal});
        clearTimeout(timer);
        if(!response.ok)continue;
        const rows=await response.json();
        const found=uniqueHttps((Array.isArray(rows)?rows:[]).map(row=>row?.name?`https://${String(row.name).trim()}`:''));
        if(found.length){servers=shuffle([...found,...SEED_SERVERS]);current=servers[0];return servers}
      }catch{}
    }
    servers=shuffle(SEED_SERVERS);current=servers[0]||'';return servers;
  }
  async function api(path,{silent=false,totalTimeoutMs=9000}={}){
    const target=cleanPath(path);if(!servers.length)await discover();
    let lastError=null;
    for(const base of [...servers]){
      const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),Math.max(800,Number(totalTimeoutMs)||9000));
      try{
        const response=await fetchImpl(`${base}${target}`,{headers:{Accept:'application/json'},cache:'no-store',referrerPolicy:'no-referrer',signal:ctl.signal});
        if(!response.ok)throw new Error(`Radio Browser HTTP ${response.status}`);
        current=base;return await response.json();
      }catch(error){lastError=error}finally{clearTimeout(timer)}
    }
    await discover();
    if(silent)return null;
    throw lastError||new Error('Radio Browser unavailable');
  }
  async function refresh(){await discover();return {ok:true,servers:[...servers]}}
  discover().catch(()=>{});
  return {api,refresh,getCurrentServer:()=>current,getKnownServers:()=>[...servers]};
}
