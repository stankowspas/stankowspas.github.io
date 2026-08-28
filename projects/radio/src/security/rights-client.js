const https=value=>{try{const u=new URL(String(value||''));return u.protocol==='https:'?u.href:''}catch{return ''}};
const candidates=station=>[...new Set([station?.url_resolved,station?.url].map(https).filter(Boolean))].slice(0,4);
export async function checkStationRights(station={}){
  const allowedUrls=candidates(station),officialUrl=https(station?.homepage);
  if(allowedUrls.length)return {status:'PUBLIC_STREAM',allowPlayback:true,reason:'public_https_direct_browser',officialUrl,evidenceUrl:'',operator:'',verifiedAt:'',expiresAt:'',allowedUrls};
  return {status:officialUrl?'LINK_ONLY':'REVIEW_REQUIRED',allowPlayback:false,reason:'https_stream_required',officialUrl,evidenceUrl:'',operator:'',verifiedAt:'',expiresAt:'',allowedUrls:[]};
}
export function stationRightsSummary(station={}){
  const raw=station&&typeof station==='object'?station._rights:null;
  if(raw&&raw.allowPlayback===true&&raw.status==='PUBLIC_STREAM')return {status:'PUBLIC_STREAM',allowPlayback:true,reason:'public_https_direct_browser',officialUrl:https(raw.officialUrl)||https(station.homepage),evidenceUrl:''};
  const allowedUrls=candidates(station),officialUrl=https(station.homepage);
  return allowedUrls.length?{status:'PUBLIC_STREAM',allowPlayback:true,reason:'public_https_direct_browser',officialUrl,evidenceUrl:''}:{status:officialUrl?'LINK_ONLY':'REVIEW_REQUIRED',allowPlayback:false,reason:'https_stream_required',officialUrl,evidenceUrl:''};
}
