export const RADIO_STORAGE_KEY='ssgpt14-radio-standalone-v1';
export const RADIO_CACHE_TTL_MS=6*60*60*1000;
export const RADIO_MAX_RECENTS=10;
export const RADIO_MAX_CACHE_ENTRIES=6;
const TZ_COUNTRY={
'Europe/Sofia':'BG','Europe/London':'GB','Europe/Berlin':'DE','Europe/Paris':'FR','Europe/Rome':'IT','Europe/Madrid':'ES',
'Europe/Bucharest':'RO','Europe/Athens':'GR','Europe/Warsaw':'PL','Europe/Prague':'CZ','Europe/Vienna':'AT','Europe/Amsterdam':'NL',
'Europe/Brussels':'BE','Europe/Lisbon':'PT','Europe/Stockholm':'SE','Europe/Oslo':'NO','Europe/Copenhagen':'DK','Europe/Helsinki':'FI',
'Europe/Budapest':'HU','Europe/Belgrade':'RS','Europe/Zagreb':'HR','Europe/Kyiv':'UA','Europe/Istanbul':'TR','Europe/Moscow':'RU',
'America/New_York':'US','America/Chicago':'US','America/Denver':'US','America/Los_Angeles':'US','America/Toronto':'CA','America/Vancouver':'CA',
'America/Mexico_City':'MX','America/Sao_Paulo':'BR','America/Argentina/Buenos_Aires':'AR',
'Asia/Tokyo':'JP','Asia/Seoul':'KR','Asia/Shanghai':'CN','Asia/Hong_Kong':'HK','Asia/Singapore':'SG','Asia/Kolkata':'IN',
'Australia/Sydney':'AU','Australia/Melbourne':'AU','Pacific/Auckland':'NZ'
};
export function normalizeCountryCode(value,fallback='BG'){
const code=String(value||'').trim().toUpperCase();
return /^[A-Z]{2}$/.test(code)?code:fallback;
}
export function inferCountryCode(languages=[],timezone=''){
const list=Array.isArray(languages)?languages:[languages];
const tz=TZ_COUNTRY[String(timezone||'')];
if(tz)return tz;
for(const raw of list){
const tag=String(raw||'').trim();
if(!tag)continue;
try{
const direct=new Intl.Locale(tag).region;
if(direct&&/^[A-Z]{2}$/.test(direct))return direct;
}catch{}
const match=tag.match(/[-_]([A-Za-z]{2})\b/);
if(match)return match[1].toUpperCase();
}
for(const raw of list){
try{
const max=new Intl.Locale(String(raw||'')).maximize?.();
if(max?.region&&/^[A-Z]{2}$/.test(max.region))return max.region;
}catch{}
}
return 'BG';
}
export function safeHttpUrl(value){
const raw=String(value||'').trim();
if(!raw)return '';
try{
const url=new URL(raw);
return ['http:','https:'].includes(url.protocol)?url.href:'';
}catch{return ''}
}
function normalizeRightsSummary(raw={}){
raw=raw&&typeof raw==='object'?raw:{};
const status=['EMBED_OK','PUBLIC_STREAM','LINK_ONLY','BLOCKED','REVIEW_REQUIRED'].includes(raw.status)?raw.status:'REVIEW_REQUIRED';
return {
status,
allowPlayback:raw.allowPlayback===true&&(status==='EMBED_OK'||status==='PUBLIC_STREAM'),
reason:String(raw.reason||'').trim().slice(0,100),
officialUrl:safeHttpUrl(raw.officialUrl).startsWith('https://')?safeHttpUrl(raw.officialUrl):'',
operator:String(raw.operator||'').trim().slice(0,180),
evidenceUrl:safeHttpUrl(raw.evidenceUrl).startsWith('https://')?safeHttpUrl(raw.evidenceUrl):'',
evidenceLabel:String(raw.evidenceLabel||'').trim().slice(0,180),
verifiedAt:String(raw.verifiedAt||'').trim().slice(0,40),
expiresAt:String(raw.expiresAt||'').trim().slice(0,40)
};
}
export function normalizeStation(raw={}){
raw=raw&&typeof raw==='object'?raw:{};
const stationuuid=String(raw.stationuuid||'').trim();
const originalUrl=safeHttpUrl(raw.url);
const resolvedUrl=safeHttpUrl(raw.url_resolved)||safeHttpUrl(raw.urlcache)||originalUrl;
const name=String(raw.name||'').trim().slice(0,240)||'Unnamed station';
return {
stationuuid,
name,
url:originalUrl,
url_resolved:resolvedUrl,
homepage:safeHttpUrl(raw.homepage),
countrycode:String(raw.countrycode||'').trim().toUpperCase().slice(0,2),
country:String(raw.country||'').trim().slice(0,120),
state:String(raw.state||'').trim().slice(0,120),
language:String(raw.language||'').trim().slice(0,160),
tags:String(raw.tags||'').trim().slice(0,260),
codec:String(raw.codec||'').trim().slice(0,32),
bitrate:Number.isFinite(Number(raw.bitrate))?Math.max(0,Math.min(1000000,Number(raw.bitrate))):0,
hls:Number(raw.hls)===1,
lastcheckok:Number(raw.lastcheckok)===1||raw.lastcheckok===true,
lastchecktime_iso8601:String(raw.lastchecktime_iso8601||'').trim().slice(0,64),
clickcount:Number.isFinite(Number(raw.clickcount))?Math.max(0,Number(raw.clickcount)):0,
source:'catalog',
_rights:normalizeRightsSummary(raw._rights)
};
}
export function stationKey(station){
const s=normalizeStation(station);
return s.stationuuid||s.url_resolved||s.url||s.name;
}
export function stationStreamCandidates(station,{secure=false}={}){
const s=normalizeStation(station),seen=new Set(),out=[];
for(const raw of [s.url_resolved,s.url]){
const url=safeHttpUrl(raw);if(!url||seen.has(url))continue;
if(secure&&!url.startsWith('https://'))continue;
seen.add(url);out.push(url);
}
return out;
}
export function stationPlayable(station,{hlsSupported=false}={}){
const s=normalizeStation(station);
if(!s.url_resolved&&!s.url)return false;
if(s.hls&&!hlsSupported)return false;
return true;
}
export function buildStationSearchPath({countrycode='',name='',tag='',limit=80,offset=0}={}){
const p=new URLSearchParams();
if(countrycode&&countrycode!=='ALL')p.set('countrycode',normalizeCountryCode(countrycode));
if(String(name||'').trim())p.set('name',String(name).trim().slice(0,120));
if(String(tag||'').trim())p.set('tag',String(tag).trim().slice(0,80));
p.set('hidebroken','true');
p.set('order','clickcount');
p.set('reverse','true');
p.set('limit',String(Math.max(1,Math.min(200,Number(limit)||80))));
p.set('offset',String(Math.max(0,Number(offset)||0)));
return `/json/stations/search?${p.toString()}`;
}
export function dedupeStations(items=[]){
const out=[],seen=new Set();
for(const raw of Array.isArray(items)?items:[]){
if(!raw||typeof raw!=='object')continue;
const s=normalizeStation(raw),key=stationKey(s);
if(!key||seen.has(key))continue;
seen.add(key);out.push(s);
}
return out;
}
export function defaultRadioState({countryCode='BG',language='bg'}={}){
return {
version:1,
language:String(language||'bg').slice(0,8),
mode:'local',
theme:'neon',
countryCode:normalizeCountryCode(countryCode),
worldCountry:'ALL',
genre:'',
search:'',
favorites:[],
recent:[],
lastStation:null,
volume:.7,
sleepMinutes:0,
cache:[],
health:{}
};
}
export function migrateRadioState(saved,defaults={}){
const base=defaultRadioState(defaults);
if(!saved||typeof saved!=='object')return base;
const next={...base,version:1};
for(const key of Object.keys(base))if(Object.prototype.hasOwnProperty.call(saved,key))next[key]=saved[key];
next.language=String(next.language||base.language).trim().slice(0,8);
next.countryCode=normalizeCountryCode(next.countryCode,base.countryCode);
next.worldCountry=next.worldCountry==='ALL'?'ALL':normalizeCountryCode(next.worldCountry,base.countryCode);
next.mode=['local','world','favorites','recent','appearance','about'].includes(next.mode)?next.mode:'local';
next.theme=['neon','aurora','sunset','emerald','arctic','graphite'].includes(next.theme)?next.theme:'neon';
next.search=typeof next.search==='string'?next.search.slice(0,120):'';
next.genre=typeof next.genre==='string'?next.genre.slice(0,80):'';
next.volume=Math.max(0,Math.min(1,Number(next.volume)||0));
next.favorites=dedupeStations(next.favorites).slice(0,300);
next.recent=dedupeStations(next.recent).slice(0,RADIO_MAX_RECENTS);
next.lastStation=next.lastStation?normalizeStation(next.lastStation):null;
next.cache=(Array.isArray(next.cache)?next.cache:[]).filter(x=>x&&typeof x==='object'&&typeof x.key==='string'&&Number.isFinite(Number(x.ts))&&Array.isArray(x.stations)).slice(0,RADIO_MAX_CACHE_ENTRIES).map(x=>({...x,stations:dedupeStations(x.stations)}));
const health=next.health&&typeof next.health==='object'&&!Array.isArray(next.health)?next.health:{};
next.health=Object.fromEntries(Object.entries(health).filter(([k,v])=>typeof k==='string'&&k&&v&&typeof v==='object'&&['ok','fail'].includes(v.status)).sort((a,b)=>(Number(b[1].ts)||0)-(Number(a[1].ts)||0)).slice(0,500));
return next;
}
export function addRecent(list,station){
const s=normalizeStation(station),key=stationKey(s);
return [s,...dedupeStations(list).filter(x=>stationKey(x)!==key)].slice(0,RADIO_MAX_RECENTS);
}
export function toggleFavorite(list,station){
const s=normalizeStation(station),key=stationKey(s),items=dedupeStations(list);
const exists=items.some(x=>stationKey(x)===key);
return exists?items.filter(x=>stationKey(x)!==key):[s,...items].slice(0,300);
}
export function isFavorite(list,station){
const key=stationKey(station);
return dedupeStations(list).some(x=>stationKey(x)===key);
}
export function cacheGet(cache,key,now=Date.now(),ttl=RADIO_CACHE_TTL_MS){
const row=(Array.isArray(cache)?cache:[]).find(x=>x?.key===key);
if(!row||now-Number(row.ts)>ttl)return null;
return dedupeStations(row.stations);
}
export function cachePut(cache,key,stations,now=Date.now()){
const rows=(Array.isArray(cache)?cache:[]).filter(x=>x?.key!==key);
rows.unshift({key,ts:now,stations:dedupeStations(stations)});
return rows.slice(0,RADIO_MAX_CACHE_ENTRIES);
}
