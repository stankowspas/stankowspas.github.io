import {
RADIO_STORAGE_KEY, inferCountryCode, safeHttpUrl, normalizeCountryCode, normalizeStation, stationKey,
stationPlayable, stationStreamCandidates, buildStationSearchPath, dedupeStations, migrateRadioState,
addRecent, toggleFavorite, isFavorite, cacheGet, cachePut
} from './core/radio.js';
import {LANGUAGES, SUPPORTED_LANGUAGE_CODES, normalizeLanguage, translate} from './i18n.js';
import {createHostedCatalogGateway} from './hosted/catalog-gateway.js';
import {sandboxStreamCandidates} from './security/sandbox-client.js';
import {checkStationRights,stationRightsSummary} from './security/rights-client.js';
import { monetization } from './monetization/bootstrap.js';
const qs=s=>document.querySelector(s), qsa=s=>[...document.querySelectorAll(s)];
const $list=qs('#stationList');
let $audio=qs('#audioPlayer');
const params=new URLSearchParams(location.search);
const browserLanguage=(navigator.languages?.[0]||navigator.language||'en');
let language=normalizeLanguage(params.get('lang')||browserLanguage,'en');
const tr=(key,vars)=>translate(language,key,vars);
function readStored(){try{return JSON.parse(localStorage.getItem(RADIO_STORAGE_KEY)||'null')}catch{return null}}
const autoCountry=inferCountryCode(navigator.languages||[navigator.language],Intl.DateTimeFormat().resolvedOptions().timeZone||'');
let state=migrateRadioState(readStored(),{countryCode:autoCountry,language});
if(!params.get('lang')&&SUPPORTED_LANGUAGE_CODES.includes(normalizeLanguage(state.language,'')))language=normalizeLanguage(state.language,'en');
state.countryCode=autoCountry;
state.language=language;
let stations=[],current=null,requestToken=0,playbackToken=0,searchTimer=null,sleepDeadline=0,sleepTick=null,countryCodes=[],catalogKind='',refreshInProgress=false,storageWarningShown=false,rightsLeaseTimer=0,rightsLeaseCheckedAt=0;
const CATALOG_STALE_TTL_MS=24*60*60*1000;
const RIGHTS_LEASE_MS=5*60*1000;
const catalogClient=createHostedCatalogGateway();
const api=(path,options)=>catalogClient.api(path,options);
let visualizerFrame=0,visualizerLastFrame=0;
let visualizerPalette={a:'110,143,255',b:'56,208,189',c:'167,92,255',bg1:'7,16,35',bg2:'14,28,58',bg3:'13,20,48'};
let countryDisplayNames=null,countryDisplayNamesLanguage='',countryNameCache=new Map();
let playbackIntent=false,lifecycleRecoveryInFlight=false;
const hlsSupported=!!($audio.canPlayType('application/vnd.apple.mpegurl')||$audio.canPlayType('audio/mpegurl'));
const secureMediaMode=true;
const STATION_MODES=new Set(['local','world','favorites','recent']);
const THEMES=new Set(['neon','aurora','sunset','emerald','arctic','graphite']);
const THEME_ACTIVE_NAV=Object.freeze({
neon:{bg:'linear-gradient(135deg,#6e8fff,#38d0bd)',border:'#6e8fff',text:'#ffffff',shadow:'rgba(110,143,255,.30)'},
aurora:{bg:'linear-gradient(135deg,#35c8c7,#a65cf1)',border:'#35c8c7',text:'#ffffff',shadow:'rgba(53,200,199,.29)'},
sunset:{bg:'linear-gradient(135deg,#ef6f63,#d94da9)',border:'#ef6f63',text:'#ffffff',shadow:'rgba(239,111,99,.30)'},
emerald:{bg:'linear-gradient(135deg,#31c58a,#78d66a)',border:'#31c58a',text:'#071a16',shadow:'rgba(49,197,138,.28)'},
arctic:{bg:'linear-gradient(135deg,#2a72d4,#0e9d9a)',border:'#2a72d4',text:'#ffffff',shadow:'rgba(42,114,212,.25)'},
graphite:{bg:'linear-gradient(135deg,#8f6f32,#d8b960)',border:'#c39a45',text:'#17191c',shadow:'rgba(195,154,69,.34)'}
});
const isStationMode=mode=>STATION_MODES.has(mode);
function applyTheme(theme=state.theme){
const value=THEMES.has(theme)?theme:'neon';state.theme=value;document.documentElement.dataset.theme=value;
const nav=THEME_ACTIVE_NAV[value]||THEME_ACTIVE_NAV.neon;
const style=document.documentElement.style;
style.setProperty('--nav-active-bg',nav.bg);style.setProperty('--nav-active-border',nav.border);style.setProperty('--nav-active-text',nav.text);style.setProperty('--nav-active-shadow',nav.shadow);
qsa('[data-theme-choice]').forEach(el=>{const active=el.dataset.themeChoice===value;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active))});
refreshVisualizerPalette();clearVisualizer();
}
async function configureServiceWorker(){
if(!('serviceWorker' in navigator))return;
const localHost=['127.0.0.1','localhost','::1'].includes(location.hostname);
if(localHost){
try{
const registrations=await navigator.serviceWorker.getRegistrations();
await Promise.all(registrations.map(registration=>registration.unregister()));
if('caches' in window){
const keys=await caches.keys();
await Promise.all(keys.filter(key=>key.startsWith('ssgpt14-radio-hosted-')).map(key=>caches.delete(key)));
}
}catch{}
return;
}
navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
function refreshVisualizerPalette(){
const style=getComputedStyle(document.documentElement),read=(name,fallback)=>style.getPropertyValue(name).trim()||fallback;
visualizerPalette={a:read('--viz-a-rgb','110,143,255'),b:read('--viz-b-rgb','56,208,189'),c:read('--viz-c-rgb','167,92,255'),bg1:read('--viz-bg1-rgb','7,16,35'),bg2:read('--viz-bg2-rgb','14,28,58'),bg3:read('--viz-bg3-rgb','13,20,48')};
}
function rgbaViz(name,alpha){return `rgba(${visualizerPalette[name]},${alpha})`}
function updateViewportMetrics(){
const topRect=qs('#topDock')?.getBoundingClientRect(),adRect=qs('#adFooter')?.getBoundingClientRect();const top=topRect?.height||0,ad=adRect?.height||0;
document.documentElement.style.setProperty('--top-dock-height',`${Math.ceil(top)}px`);document.documentElement.style.setProperty('--top-dock-bottom',`${Math.ceil(topRect?.bottom||top)}px`);document.documentElement.style.setProperty('--ad-dock-height',`${Math.ceil(ad)}px`);
}
function persist({notify=true}={}){
try{localStorage.setItem(RADIO_STORAGE_KEY,JSON.stringify(state));storageWarningShown=false;return true}
catch(err){
console.warn('Radio state could not be saved.',err);
if(notify&&!storageWarningShown){storageWarningShown=true;queueMicrotask(()=>toast(tr('storageError')))}
return false;
}
}
function toast(text){const el=qs('#radioToast');el.textContent=text;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2200)}
function initials(name){return String(name||'♫').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')||'♫'}
function displayCountry(code){
const value=String(code||'').toUpperCase();if(!value)return value;
if(countryDisplayNamesLanguage!==language){countryDisplayNamesLanguage=language;countryNameCache=new Map();try{countryDisplayNames=new Intl.DisplayNames([language],{type:'region'})}catch{countryDisplayNames=null}}
if(countryNameCache.has(value))return countryNameCache.get(value);
let label=value;try{label=countryDisplayNames?.of(value)||value}catch{}countryNameCache.set(value,label);return label;
}
function statusClass(station){const h=state.health[stationKey(station)];if(h?.status==='ok')return'ok';if(h?.status==='fail')return'fail';return station.lastcheckok?'ok':''}
function rightsLabel(rights){
const status=rights?.status||'REVIEW_REQUIRED';
if(rights?.reason==='local_open_public_https')return tr('rightsTestOpen');
if(status==='PUBLIC_STREAM'||rights?.reason==='public_https_direct_browser')return tr('rightsPublicStream');
if(status==='EMBED_OK')return tr('rightsEmbedOk');
if(status==='LINK_ONLY')return tr('rightsLinkOnly');
if(status==='BLOCKED')return tr('rightsBlocked');
return tr('rightsReview');
}
function rightsClass(rights){return String(rights?.status||'REVIEW_REQUIRED').toLowerCase().replaceAll('_','-')}
function officialStationUrl(station){const rights=stationRightsSummary(station);return rights.officialUrl||(String(station?.homepage||'').startsWith('https://')?String(station.homepage):'')}
function openExternalHttps(url){if(!String(url||'').startsWith('https://'))return;const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.click()}
function clearRightsLease(){clearTimeout(rightsLeaseTimer);rightsLeaseTimer=0;rightsLeaseCheckedAt=0}
function scheduleRightsLease(key=stationKey(current||{})){
clearTimeout(rightsLeaseTimer);if(!current||!key)return;
rightsLeaseTimer=setTimeout(()=>revalidateRightsLease(key),RIGHTS_LEASE_MS);
}
async function revalidateRightsLease(key){
if(!current||stationKey(current)!==key)return;
const result=await checkStationRights(current);if(!current||stationKey(current)!==key)return;
rightsLeaseCheckedAt=Date.now();current._rights={...current._rights,...result};
if(!result.allowPlayback){stopPlayback();toast(tr('rightsPlaybackDenied'));return}
scheduleRightsLease(key);
}
function setHealth(station,status){
const key=stationKey(station);if(!key)return;
state.health[key]={status,ts:Date.now(),failures:status==='fail'?(Number(state.health[key]?.failures)||0)+1:0};
const rows=Object.entries(state.health).sort((a,b)=>(Number(b[1]?.ts)||0)-(Number(a[1]?.ts)||0)).slice(0,500);
state.health=Object.fromEntries(rows);persist();if(!current)renderStations();
}
function visualizerCanvas(){return qs('#visualizerCanvas')}
function clearVisualizer(){
const canvas=visualizerCanvas();if(!canvas)return;
const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,rect.width,rect.height);
const y=rect.height/2,grad=ctx.createLinearGradient(0,0,rect.width,0);grad.addColorStop(0,rgbaViz('a',.18));grad.addColorStop(.5,rgbaViz('b',.42));grad.addColorStop(1,rgbaViz('c',.18));ctx.strokeStyle=grad;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(rect.width,y);ctx.stroke();
}
function pauseVisualizer(){if(visualizerFrame)cancelAnimationFrame(visualizerFrame);visualizerFrame=0;visualizerLastFrame=0}
function stopVisualizer(){pauseVisualizer();clearVisualizer()}
function startVisualizer(){
if(visualizerFrame)cancelAnimationFrame(visualizerFrame);visualizerFrame=0;visualizerLastFrame=0;
const reduced=matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;const minDelta=reduced?66:30;
const frame=ts=>{
visualizerFrame=requestAnimationFrame(frame);if(ts-visualizerLastFrame<minDelta)return;visualizerLastFrame=ts;drawVisualizer();
};
visualizerFrame=requestAnimationFrame(frame);
}
function drawVisualizer(){
const canvas=visualizerCanvas();if(!canvas||!current)return;const badge=qs('#visualizerIndicator');if(badge)badge.classList.toggle('is-live',!!$audio&&!$audio.paused);
const rect=canvas.getBoundingClientRect();if(rect.width<2||rect.height<2)return;
const dpr=Math.min(devicePixelRatio||1,2),w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);const W=rect.width,H=rect.height,mid=H/2,t=performance.now()/1000;
ctx.clearRect(0,0,W,H);
const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,rgbaViz('bg1',.82));bg.addColorStop(.5,rgbaViz('bg2',.68));bg.addColorStop(1,rgbaViz('bg3',.86));ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
const grid=ctx.createLinearGradient(0,0,W,0);grid.addColorStop(0,rgbaViz('a',.04));grid.addColorStop(.5,rgbaViz('b',.15));grid.addColorStop(1,rgbaViz('c',.04));ctx.strokeStyle=grid;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,mid);ctx.lineTo(W,mid);ctx.stroke();
const playing=!!$audio&&!$audio.paused,amp=playing?Math.max(3,H*.12):1.5;const wave=ctx.createLinearGradient(0,0,W,0);wave.addColorStop(0,rgbaViz('a',.35));wave.addColorStop(.5,rgbaViz('b',.85));wave.addColorStop(1,rgbaViz('c',.35));ctx.strokeStyle=wave;ctx.lineWidth=playing?1.7:1.2;ctx.beginPath();
for(let x=0;x<=W;x+=3){const edge=Math.sin(Math.PI*x/W),carrier=Math.sin(x*.052+t*2.5),detail=Math.sin(x*.117-t*1.7)*.33;const y=mid+(carrier+detail)*amp*edge;if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke();
}
function configurePlatformAudioSession(){
try{if(navigator.audioSession&&'type' in navigator.audioSession)navigator.audioSession.type='playback'}catch{}
}
function setMediaSessionPlaybackState(value){
try{if('mediaSession' in navigator)navigator.mediaSession.playbackState=value}catch{}
}
function updateMediaSessionMetadata(station=current){
if(!('mediaSession' in navigator))return;
if(!station){try{navigator.mediaSession.metadata=null}catch{};setMediaSessionPlaybackState('none');return}
const s=normalizeStation(station),artist=[s.countrycode&&displayCountry(s.countrycode),s.codec,s.bitrate?`${s.bitrate} kbps`:null].filter(Boolean).join(' · ');
try{
if('MediaMetadata' in globalThis)navigator.mediaSession.metadata=new MediaMetadata({
title:s.name,artist:artist||'SSGPT14 Radio',album:'SSGPT14 Radio',
artwork:[{src:new URL('./assets/icon-192.png',location.href).href,sizes:'192x192',type:'image/png'},{src:new URL('./assets/icon-512.png',location.href).href,sizes:'512x512',type:'image/png'}]
});
}catch{}
}
function pausePlaybackByUser(){playbackIntent=false;try{$audio.pause()}catch{};setMediaSessionPlaybackState('paused')}
async function recoverPlaybackAfterLifecycle(reason='resume'){
if(lifecycleRecoveryInFlight||!playbackIntent||!current||!navigator.onLine||!$audio?.getAttribute('src'))return false;
if(!$audio.paused&&!$audio.error)return true;
lifecycleRecoveryInFlight=true;const priorPhase=$audio.dataset.playbackPhase||'active';
try{
configurePlatformAudioSession();$audio.dataset.playbackPhase='attempting';
if($audio.error){try{$audio.load()}catch{}}
const result=await waitForPlaybackStart($audio,playbackToken,5000);
if(result.ok){$audio.dataset.playbackPhase='active';if(document.visibilityState!=='hidden')startVisualizer();return true}
$audio.dataset.playbackPhase=priorPhase;return false;
}catch{$audio.dataset.playbackPhase=priorPhase;return false}
finally{lifecycleRecoveryInFlight=false}
}
function configureMediaSessionControls(){
if(!('mediaSession' in navigator))return;
const set=(action,handler)=>{try{navigator.mediaSession.setActionHandler(action,handler)}catch{}};
set('play',async()=>{playbackIntent=true;configurePlatformAudioSession();if(current&&$audio?.getAttribute('src')){if(await recoverPlaybackAfterLifecycle('media-session-play'))return}const target=current||state.lastStation;if(target)await playStation(target)});
set('pause',()=>pausePlaybackByUser());
set('stop',()=>stopPlayback());
}
function detachAudio(){
try{$audio.dataset.playbackPhase='stopping';$audio.pause();$audio.removeAttribute('src');$audio.load()}catch{}
}
function bindAudioEvents(audio){
const isAttempting=()=>audio.dataset.playbackPhase==='attempting';
const isInternalTransition=()=>['attempting','replacing','stopping','terminal'].includes(audio.dataset.playbackPhase);
audio.addEventListener('loadstart',()=>{if(audio===$audio&&isAttempting())qs('#playerStatus').textContent=tr('loading')});
audio.addEventListener('playing',()=>{if(audio!==$audio)return;audio.dataset.playbackPhase='active';playbackIntent=true;setMediaSessionPlaybackState('playing');qs('#playerStatus').textContent=tr('playing');qs('#playPause').textContent='❚❚';if(document.visibilityState!=='hidden')startVisualizer();const key=audio.dataset.stationKey||'',s=current&&stationKey(current)===key?current:findStation(key);if(s){updateMediaSessionMetadata(s);setHealth(s,'ok');if(audio.dataset.recentRecorded!=='1'){audio.dataset.recentRecorded='1';state.lastStation=normalizeStation(s);state.recent=addRecent(state.recent,s);persist();if(state.mode==='recent'){stations=monetization.featured.decorateMany(filterLocal(state.recent));renderStations()}}if(audio.dataset.analyticsStarted==='1')monetization.analytics.resumeListening(stationKey(s));else{audio.dataset.analyticsStarted='1';monetization.analytics.playStart(stationKey(s))}}});
audio.addEventListener('pause',()=>{if(audio!==$audio||isInternalTransition())return;if(audio.getAttribute('src')){pauseVisualizer();clearVisualizer();setMediaSessionPlaybackState('paused');qs('#playerStatus').textContent=tr('paused');qs('#playPause').textContent='▶';monetization.analytics.pauseListening('audio-pause')}});
for(const eventName of ['waiting','stalled'])audio.addEventListener(eventName,()=>{if(audio===$audio&&audio.getAttribute('src'))qs('#playerStatus').textContent=tr('loading')});
const terminalFailure=reason=>{if(audio!==$audio||isInternalTransition())return;audio.dataset.playbackPhase='terminal';pauseVisualizer();clearVisualizer();setMediaSessionPlaybackState('paused');monetization.analytics.stopListening(reason);qs('#playerStatus').textContent=tr('streamError');qs('#playPause').textContent='▶';const s=findStation(audio.dataset.stationKey||'');if(s)setHealth(s,'fail')};
audio.addEventListener('error',()=>terminalFailure('audio-error'));
audio.addEventListener('ended',()=>terminalFailure('audio-ended'));
audio.addEventListener('abort',()=>terminalFailure('audio-abort'));
audio.addEventListener('emptied',()=>terminalFailure('audio-emptied'));
}
function replaceAudio(){
const old=$audio;try{if(old)old.dataset.playbackPhase='replacing';old?.pause();old?.removeAttribute('src');old?.load()}catch{}
const audio=document.createElement('audio');audio.id='audioPlayer';audio.preload='none';audio.setAttribute('playsinline','');audio.volume=state.volume;old.replaceWith(audio);$audio=audio;bindAudioEvents(audio);startVisualizer();return audio;
}
const PLAYBACK_START_TIMEOUT_MS=9000;
function waitForPlaybackStart(audio,token,timeoutMs=PLAYBACK_START_TIMEOUT_MS){
return new Promise(resolve=>{
let done=false,timer=0;
const finish=(ok,reason)=>{if(done)return;done=true;clearTimeout(timer);audio.removeEventListener('playing',onPlaying);audio.removeEventListener('error',onError);audio.removeEventListener('abort',onAbort);audio.removeEventListener('emptied',onAbort);resolve({ok,reason})};
const onPlaying=()=>finish(token===playbackToken,'playing');
const onError=()=>finish(false,'error');
const onAbort=()=>finish(false,token===playbackToken?'aborted':'cancelled');
audio.addEventListener('playing',onPlaying);audio.addEventListener('error',onError);audio.addEventListener('abort',onAbort);audio.addEventListener('emptied',onAbort);
timer=setTimeout(()=>finish(false,token===playbackToken?'timeout':'cancelled'),timeoutMs);
Promise.resolve(audio.play()).catch(()=>finish(false,'play-rejected'));
});
}
const fallbackCountries=['BG','DE','FR','GB','GR','IT','ES','RO','RS','HR','TR','PL','CZ','AT','NL','BE','PT','SE','NO','DK','FI','HU','UA','US','CA','MX','BR','AR','JP','KR','CN','IN','AU','NZ'];
async function loadCountries(){
let codes=fallbackCountries;
try{
const countries=await api('/json/countrycodes?hidebroken=true&order=stationcount&reverse=true&limit=300',{silent:true,retries:0,totalTimeoutMs:4500});
const rows=Array.isArray(countries)?countries:[];
const apiCodes=rows.map(x=>String(x?.name||'').toUpperCase()).filter(x=>/^[A-Z]{2}$/.test(x));if(apiCodes.length)codes=[...new Set([autoCountry,...apiCodes])];
}catch{}
countryCodes=[...new Set(codes)];fillCountrySelect(countryCodes);updateCatalogCount();
}
function fillCountrySelect(codes){
const select=qs('#countrySelect');if(!select)return;
const opts=[`<option value="ALL">${escapeHTML(tr('allCountries'))}</option>`];
for(const c of [...new Set(codes)].sort((a,b)=>displayCountry(a).localeCompare(displayCountry(b),language)))opts.push(`<option value="${c}">${escapeHTML(displayCountry(c))} (${c})</option>`);
select.innerHTML=opts.join('');select.value=state.worldCountry;if(!select.value)select.value='ALL';
}
function fillLanguageSelect(){
const select=qs('#languageSelect');
select.innerHTML=LANGUAGES.map(([code,name])=>`<option value="${code}">${escapeHTML(name)}</option>`).join('');
select.value=language;
}
function queryKey(){return JSON.stringify({m:state.mode,c:state.mode==='local'?autoCountry:state.worldCountry,q:state.search.trim().toLowerCase(),g:state.genre.trim().toLowerCase(),h:hlsSupported})}
function localCollection(){if(state.mode==='favorites')return state.favorites;if(state.mode==='recent')return state.recent;return null}
async function loadStations({force=false}={}){
if(!isStationMode(state.mode)){stations=[];setCatalogStatus('');syncContentVisibility();return}
const token=++requestToken,local=localCollection();
state.countryCode=autoCountry;updateModeUI();
if(local){stations=monetization.featured.decorateMany(filterLocal(local));renderStations();setCatalogStatus('');return}
const key=queryKey();
const freshCache=cacheGet(state.cache,key);
const staleCache=cacheGet(state.cache,key,Date.now(),CATALOG_STALE_TTL_MS);
const fallbackCache=freshCache||staleCache;
const displayCache=!force?fallbackCache:null;
if(displayCache){stations=monetization.featured.decorateMany(filterPlayable(displayCache));setCatalogStatus('cache');renderStations()}
else if(!stations.length){stations=[];setCatalogStatus('loading');renderStations()}
else setCatalogStatus('loading');
try{
const country=state.mode==='local'?autoCountry:state.worldCountry;
const path=buildStationSearchPath({countrycode:country,name:state.search,tag:state.genre,limit:100});
const data=await api(path,{retries:1,totalTimeoutMs:9000});if(token!==requestToken)return;
const normalized=monetization.featured.decorateMany(filterPlayable(data));
stations=normalized;state.cache=cachePut(state.cache,key,normalized);persist();setCatalogStatus('online');renderStations();
}catch{
if(token!==requestToken)return;
if(fallbackCache){stations=monetization.featured.decorateMany(filterPlayable(fallbackCache));setCatalogStatus('cache');renderStations();return}
stations=[];setCatalogStatus('error');renderStations();
}
}
function filterPlayable(items){return dedupeStations(items).filter(s=>stationPlayable(s,{hlsSupported})&&stationStreamCandidates(s,{secure:secureMediaMode}).length>0)}
function filterLocal(items){
const q=state.search.trim().toLocaleLowerCase(),g=state.genre.trim().toLocaleLowerCase();
return filterPlayable(items).filter(s=>(!q||`${s.name} ${s.country} ${s.state} ${s.tags} ${s.language}`.toLocaleLowerCase().includes(q))&&(!g||s.tags.toLocaleLowerCase().includes(g)));
}
function hasCatalogFilters(){return !!(state.search.trim()||state.genre.trim())}
function catalogCountValue(){return isStationMode(state.mode)?stations.length:0}
function updateCatalogCount(){
const el=qs('#catalogCount');if(!el)return;
el.textContent=tr(hasCatalogFilters()?'resultsCount':'catalogCount',{count:catalogCountValue()});
}
function setCatalogStatus(kind){
catalogKind=kind;const el=qs('#catalogStatus');el.className='catalog-status';
if(kind==='online'){el.textContent=tr('catalogOnline');el.classList.add('online')}
else if(kind==='cache'){el.textContent=tr('catalogCache');el.classList.add('cache')}
else if(kind==='error'){el.textContent=tr('catalogError');el.classList.add('error')}
else if(kind==='loading'){el.textContent=tr('loading')}
else el.textContent='';
}
function syncContentVisibility(){
const active=!!current,stationPage=isStationMode(state.mode),appearance=state.mode==='appearance'&&!active,about=state.mode==='about'&&!active,empty=stationPage&&!stations.length,waiting=empty&&catalogKind==='loading';
document.body.classList.toggle('session-active',active);
document.body.classList.toggle('catalog-loading-state',waiting&&!active);
qs('#activeStationView').classList.toggle('hidden',!active);
qs('#radioSummary').classList.toggle('hidden',active||!stationPage);
qs('#emptyState').classList.toggle('hidden',active||!empty);
$list.classList.toggle('hidden',active||!stationPage||empty);
qs('#appearancePanel').classList.toggle('hidden',!appearance);qs('#aboutPanel').classList.toggle('hidden',!about);
qs('#stationFilters').classList.toggle('hidden',!stationPage);
qs('#refreshStations').classList.toggle('hidden',!stationPage);
updateViewportMetrics();
}
function renderStationInfoTokens(target,raw){
const values=String(raw||'').split(',').map(value=>value.trim()).filter(Boolean);
target.replaceChildren();
if(!values.length){target.textContent='—';target.removeAttribute('title');return}
target.title=values.join(', ');
for(const value of values){
const chip=document.createElement('span');
chip.className='station-info-chip';
chip.textContent=value;
target.append(chip);
}
}
function renderStationInfo(){
const homepage=qs('#infoHomepage');
if(!current){
for(const id of ['infoName','infoCountry','infoRegion','infoLanguage','infoGenre','infoCodec','infoBitrate','infoStreamType','infoRights'])qs(`#${id}`).textContent='—';
qs('#infoLanguage').removeAttribute('title');qs('#infoGenre').removeAttribute('title');
qs('#infoAvatar').textContent='♫';homepage.classList.add('hidden');homepage.removeAttribute('href');return;
}
const rights=stationRightsSummary(current),official=rights.officialUrl||current.homepage;
qs('#infoAvatar').textContent=initials(current.name);qs('#infoName').textContent=current.name;
qs('#infoCountry').textContent=current.countrycode?`${displayCountry(current.countrycode)} (${current.countrycode})`:(current.country||'—');
qs('#infoRegion').textContent=current.state||'—';
renderStationInfoTokens(qs('#infoLanguage'),current.language);
renderStationInfoTokens(qs('#infoGenre'),current.tags);
qs('#infoCodec').textContent=current.codec||'—';qs('#infoBitrate').textContent=current.bitrate?`${current.bitrate} kbps`:'—';
qs('#infoStreamType').textContent=current.hls?'HLS':tr('standardStream');qs('#infoRights').textContent=rightsLabel(rights);
if(official&&official.startsWith('https://')){homepage.href=official;homepage.classList.remove('hidden')}else{homepage.classList.add('hidden');homepage.removeAttribute('href')}
}
function renderStations(){
const key=current?stationKey(current):'';
const favoriteKeys=new Set(dedupeStations(state.favorites).map(stationKey));
$list.innerHTML=stations.map(s=>{
const sk=stationKey(s),fav=favoriteKeys.has(sk),meta=[s.countrycode||'',s.state||'',s.codec||'',s.bitrate?`${s.bitrate} kbps`:'',s.tags?.split(',')[0]||''].filter(Boolean).slice(0,4);
const rights=stationRightsSummary(s),canPlay=rights.allowPlayback===true,official=officialStationUrl(s),rightsText=rightsLabel(rights),encodedKey=encodeURIComponent(sk),encodedOfficial=encodeURIComponent(official);
const favoriteControl=state.mode==='favorites'&&fav
?`<button type="button" class="fav active remove-favorite" data-favorite="${encodedKey}" title="${escapeHTML(tr('remove'))}">${escapeHTML(tr('remove'))}</button>`
:`<button type="button" class="fav ${fav?'active':''}" data-favorite="${encodedKey}" title="${escapeHTML(fav?tr('inFavorites'):tr('addToFavorites'))}">${fav?'★':'☆'}</button>`;
const mainAction=canPlay?`data-play="${encodedKey}"`:(official?`data-official="${encodedOfficial}"`:`data-rights-denied="${encodedKey}"`);
const primaryAction=canPlay
?`<button type="button" data-play="${encodedKey}" title="${escapeHTML(tr('play'))}">▶</button>`
:(official?`<button type="button" data-official="${encodedOfficial}" title="${escapeHTML(tr('rightsOpenOfficial'))}">↗</button>`:`<button type="button" data-rights-denied="${encodedKey}" title="${escapeHTML(rightsText)}">🔒</button>`);
return `<article class="station-card ${sk===key?'is-playing':''}" data-station="${encodedKey}"><div class="station-logo">${escapeHTML(initials(s.name))}</div><span class="health-dot ${statusClass(s)}"></span><button class="station-main" ${mainAction} type="button"><strong class="station-name">${escapeHTML(s.name)}${s._promotion?.sponsored?` <span class="sponsored-badge">${escapeHTML(s._promotion.label||'Sponsored')}</span>`:''} <span class="rights-badge ${rightsClass(rights)}">${escapeHTML(rightsText)}</span></strong><span class="station-meta">${meta.map(x=>`<span>${escapeHTML(x)}</span>`).join('')}</span></button><div class="station-actions">${primaryAction}${favoriteControl}</div></article>`;
}).join('');
updateCatalogCount();
const waiting=catalogKind==='loading'&&!stations.length;
qs('#emptyTitle').textContent=waiting?tr('loading'):tr('noStations');qs('#emptyText').textContent=waiting?tr('catalogLoadingText'):tr('noStationsText');syncContentVisibility();
}
function handleStationListClick(event){
const button=event.target.closest?.('button[data-play],button[data-official],button[data-rights-denied],button[data-favorite]');
if(!button||!$list.contains(button))return;
if(button.hasAttribute('data-play')){const s=findStation(decodeURIComponent(button.dataset.play||''));if(s)playStation(s);return}
if(button.hasAttribute('data-official')){openExternalHttps(decodeURIComponent(button.dataset.official||''));return}
if(button.hasAttribute('data-rights-denied')){toast(tr('rightsPlaybackDenied'));return}
const s=findStation(decodeURIComponent(button.dataset.favorite||''));if(s)toggleStationFavorite(s);
}
function findStation(key){const match=s=>stationKey(s)===key;return stations.find(match)||state.favorites.find(match)||state.recent.find(match)}
function escapeHTML(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
async function playStation(station){
playbackIntent=true;configurePlatformAudioSession();
const token=++playbackToken,target=normalizeStation(station),targetKey=stationKey(target);
const rights=await checkStationRights(target);
if(token!==playbackToken)return;
target._rights={...target._rights,...rights};
if(!rights.allowPlayback){
const existing=stations.findIndex(x=>stationKey(x)===targetKey);if(existing>=0)stations[existing]=target;
renderStations();playbackIntent=false;toast(tr('rightsPlaybackDenied'));return;
}
const rawCandidates=(rights.allowedUrls||[]).filter(x=>stationStreamCandidates(target,{secure:secureMediaMode}).includes(x));
if(!rawCandidates.length){playbackIntent=false;toast(tr('rightsPlaybackDenied'));return}
const candidates=await sandboxStreamCandidates(rawCandidates);
if(token!==playbackToken)return;
if(!candidates.length){playbackIntent=false;toast(tr('streamError'));setHealth(target,'fail');return}
monetization.analytics.stopListening('station-replace');current=target;scrollTo({top:0,left:0,behavior:'auto'});updatePlayer();renderStations();updateViewportMetrics();
qs('#playerStatus').textContent=tr('loading');
if(current.stationuuid)api(`/json/url/${encodeURIComponent(current.stationuuid)}`,{silent:true}).catch(()=>{});
startVisualizer();
for(const stream of candidates){
if(token!==playbackToken||!current||stationKey(current)!==targetKey)return;
qs('#playerStatus').textContent=tr('loading');
const audio=replaceAudio();if(token!==playbackToken)return;
audio.dataset.stationKey=targetKey;audio.dataset.playbackPhase='attempting';audio.src=stream;audio.volume=state.volume;
const result=await waitForPlaybackStart(audio,token);
if(token!==playbackToken)return;
if(result.ok){audio.dataset.playbackPhase='active';rightsLeaseCheckedAt=Date.now();scheduleRightsLease(targetKey);return}
try{audio.pause();audio.removeAttribute('src');audio.load()}catch{}
}
playbackIntent=false;if(current&&stationKey(current)===targetKey){qs('#playerStatus').textContent=tr('streamError');qs('#playPause').textContent='▶';setHealth(target,'fail')}
}
function updatePlayer(){
const name=qs('#playerName'),meta=qs('#playerMeta'),fav=qs('#favoriteCurrent'),favStar=qs('.favorite-current-star'),favLabel=qs('#favoriteCurrentLabel'),avatar=qs('#playerAvatar');
if(!current){name.textContent=tr('chooseStation');meta.textContent='';favStar.textContent='☆';favLabel.textContent=tr('addToFavorites');fav.classList.remove('active');fav.disabled=true;avatar.textContent='♫';renderStationInfo();syncContentVisibility();return}
const favorite=isFavorite(state.favorites,current);name.textContent=current.name;meta.textContent=[current.countrycode&&displayCountry(current.countrycode),current.codec,current.bitrate?`${current.bitrate} kbps`:null].filter(Boolean).join(' · ');favStar.textContent=favorite?'★':'☆';favLabel.textContent=favorite?(state.mode==='favorites'?tr('remove'):tr('inFavorites')):tr('addToFavorites');fav.classList.toggle('active',favorite);fav.disabled=false;avatar.textContent=initials(current.name);renderStationInfo();syncContentVisibility();
}
function stopPlayback({render=true}={}){playbackIntent=false;monetization.analytics.stopListening('stop');playbackToken++;clearRightsLease();detachAudio();delete $audio.dataset.stationKey;stopVisualizer();updateMediaSessionMetadata(null);qs('#playPause').textContent='▶';qs('#playerStatus').textContent=tr('stopped');current=null;updatePlayer();if(render&&isStationMode(state.mode))renderStations();updateViewportMetrics()}
function toggleStationFavorite(station){const before=isFavorite(state.favorites,station);state.favorites=toggleFavorite(state.favorites,station);persist();toast(before?tr('favoriteRemoved'):tr('favoriteAdded'));updatePlayer();if(state.mode==='favorites')stations=monetization.featured.decorateMany(filterLocal(state.favorites));renderStations()}
function updateModeUI(){
qsa('[data-mode]').forEach(b=>{const active=b.dataset.mode===state.mode;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
if(isStationMode(state.mode)){
const map={local:['localHeading','localDesc'],world:['worldHeading','worldDesc'],favorites:['favoritesHeading','favoritesDesc'],recent:['recentHeading','recentDesc']},[h,d]=map[state.mode];
qs('#viewHeading').textContent=tr(h);qs('#viewDescription').textContent=state.mode==='local'?tr(d,{country:displayCountry(autoCountry)}):tr(d);
}
qs('#localCountryField').classList.toggle('hidden',state.mode!=='local');qs('#worldCountryField').classList.toggle('hidden',state.mode!=='world');qs('#localCountryName').textContent=`${displayCountry(autoCountry)} (${autoCountry})`;
qs('#genreFilter').closest('.filter-field').classList.toggle('hidden',!isStationMode(state.mode));fillCountrySelect([...countryCodes,...fallbackCountries,autoCountry,state.worldCountry].filter(x=>x!=='ALL'));
updatePlayer();syncContentVisibility();updateCatalogCount();
}
function applyTranslations(){
document.documentElement.lang=language;fillLanguageSelect();qs('#radioTitle').textContent=tr('title');qs('#stationSearch').setAttribute('aria-label',tr('search'));qsa('[data-t]').forEach(el=>el.textContent=tr(el.dataset.t));
const rightsNote=qs('[data-t="aboutRightsNote"]');
if(rightsNote&&monetization.runtimeConfig?.rights?.mode==='local-open-public-https')rightsNote.textContent=tr('aboutRightsLocalTestNote');
if(rightsNote&&monetization.runtimeConfig?.rights?.mode==='public-https-direct')rightsNote.textContent=tr('aboutRightsPublicDirectNote');
qs('#stationSearch').placeholder=tr('search');qs('#refreshStations').title=tr('refresh');qs('#installApp').title=tr('install');qs('#playPause').title=tr('play');qs('#stopPlayback').title=tr('stop');qs('#sleepTimer').options[0].textContent=tr('off');updateModeUI();updatePlayer();setNetwork();setCatalogStatus(catalogKind);updateCatalogCount();
}
function setNetwork(){const el=qs('#networkState'),online=navigator.onLine;el.classList.toggle('offline',!online);el.title=online?tr('online'):tr('offline')}
function scheduleSearch(){clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadStations(),300)}
async function refreshStationsNow(){
if(refreshInProgress||!isStationMode(state.mode))return;
const button=qs('#refreshStations');refreshInProgress=true;button.disabled=true;button.classList.add('is-refreshing');button.setAttribute('aria-busy','true');
try{
clearTimeout(searchTimer);++requestToken;
if(current)stopPlayback({render:false});
scrollTo({top:0,left:0,behavior:'auto'});
if(state.mode==='local'||state.mode==='world'){
setCatalogStatus('loading');syncContentVisibility();
await catalogClient.refresh().catch(()=>null);
await Promise.allSettled([loadStations({force:true}),loadCountries()]);
}else{
stations=monetization.featured.decorateMany(filterLocal(localCollection()||[]));
setCatalogStatus('');renderStations();
}
}finally{
refreshInProgress=false;button.disabled=false;button.classList.remove('is-refreshing');button.removeAttribute('aria-busy');
}
}
function setSleep(minutes){clearInterval(sleepTick);sleepTick=null;state.sleepMinutes=Number(minutes)||0;persist();sleepDeadline=state.sleepMinutes?Date.now()+state.sleepMinutes*60000:0;if(!sleepDeadline){qs('#sleepStatus').textContent='';return}sleepTick=setInterval(()=>{const left=Math.max(0,sleepDeadline-Date.now());if(!left){clearInterval(sleepTick);sleepTick=null;stopPlayback();qs('#sleepTimer').value='0';state.sleepMinutes=0;persist();qs('#sleepStatus').textContent='';return}const m=Math.floor(left/60000),s=Math.floor((left%60000)/1000);qs('#sleepStatus').textContent=`${m}:${String(s).padStart(2,'0')}`},1000)}
async function navigate(mode){
monetization.analytics.navigation(mode);
if(!['local','world','favorites','recent','appearance','about'].includes(mode))return;
++requestToken;clearTimeout(searchTimer);if(current)stopPlayback({render:false});state.mode=mode;persist();scrollTo({top:0,left:0,behavior:'auto'});updateModeUI();monetization.render({reason:'navigation',mode,language,country:autoCountry});
if(isStationMode(mode))await loadStations();else{stations=[];setCatalogStatus('');syncContentVisibility()}
}
function bind(){
bindAudioEvents($audio);clearVisualizer();$list.addEventListener('click',handleStationListClick);
qsa('[data-mode]').forEach(b=>b.onclick=()=>navigate(b.dataset.mode));
qs('#refreshStations').onclick=refreshStationsNow;
qs('#languageSelect').onchange=e=>{language=normalizeLanguage(e.target.value,'en');state.language=language;persist();applyTranslations();renderStations();monetization.render({reason:'language-change',mode:state.mode,language,country:autoCountry})};
qsa('[data-theme-choice]').forEach(b=>b.onclick=()=>{applyTheme(b.dataset.themeChoice);persist();updateViewportMetrics()});
qs('#stationSearch').value=state.search;qs('#genreFilter').value=state.genre;
qs('#stationSearch').oninput=e=>{state.search=e.target.value;persist();if(localCollection()){stations=monetization.featured.decorateMany(filterLocal(localCollection()));renderStations()}else scheduleSearch()};
qs('#genreFilter').oninput=e=>{state.genre=e.target.value;persist();if(localCollection()){stations=monetization.featured.decorateMany(filterLocal(localCollection()));renderStations()}else scheduleSearch()};
qs('#countrySelect').onchange=e=>{if(state.mode!=='world')return;state.worldCountry=e.target.value==='ALL'?'ALL':normalizeCountryCode(e.target.value,autoCountry);persist();loadStations({force:true})};
qs('#playPause').onclick=async()=>{if(!current&&state.lastStation){await playStation(state.lastStation);return}if(!current)return;if($audio.paused){playbackIntent=true;configurePlatformAudioSession();if(!$audio.getAttribute('src')){await playStation(current);return}try{await $audio.play()}catch{await recoverPlaybackAfterLifecycle('ui-play')}}else pausePlaybackByUser()};
qs('#stopPlayback').onclick=stopPlayback;qs('#favoriteCurrent').onclick=()=>{if(current)toggleStationFavorite(current)};
qs('#volumeControl').value=String(Math.round(state.volume*100));qs('#volumeValue').textContent=`${Math.round(state.volume*100)}%`;qs('#volumeControl').oninput=e=>{state.volume=Number(e.target.value)/100;$audio.volume=state.volume;qs('#volumeValue').textContent=`${e.target.value}%`;persist()};
qs('#sleepTimer').value='0';qs('#sleepTimer').onchange=e=>setSleep(e.target.value);
addEventListener('online',()=>{setNetwork();loadStations({force:true});recoverPlaybackAfterLifecycle('online').catch(()=>{})});addEventListener('offline',setNetwork);addEventListener('monetization:storage-error',()=>{if(!storageWarningShown){storageWarningShown=true;toast(tr('storageError'))}});
addEventListener('resize',updateViewportMetrics);
const checkpointBackground=()=>{monetization.analytics.checkpointListening();pauseVisualizer()};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')checkpointBackground();else if(current){if(!$audio.paused)startVisualizer();recoverPlaybackAfterLifecycle('visible').catch(()=>{});if(!rightsLeaseCheckedAt||Date.now()-rightsLeaseCheckedAt>RIGHTS_LEASE_MS)revalidateRightsLease(stationKey(current))}});
document.addEventListener('freeze',checkpointBackground);
document.addEventListener('resume',()=>recoverPlaybackAfterLifecycle('resume').catch(()=>{}));
addEventListener('pagehide',checkpointBackground);
addEventListener('pageshow',()=>recoverPlaybackAfterLifecycle('pageshow').catch(()=>{}));
}
let installPrompt=null;
addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;qs('#installApp')?.classList.remove('hidden')});
qs('#installApp')?.addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice.catch(()=>null);installPrompt=null;qs('#installApp')?.classList.add('hidden')});
addEventListener('appinstalled',()=>{installPrompt=null;qs('#installApp')?.classList.add('hidden')});
async function init(){
applyTheme(state.theme);applyTranslations();configurePlatformAudioSession();configureMediaSessionControls();bind();setNetwork();updatePlayer();updateViewportMetrics();monetization.render({reason:'radio-init',mode:state.mode,language});
await configureServiceWorker();
const stationsReady=loadStations();loadCountries().catch(()=>{});await stationsReady;
}
init().catch(err=>{console.error(err);setCatalogStatus('error');qs('#emptyState').classList.remove('hidden');$list.classList.add('hidden')});
