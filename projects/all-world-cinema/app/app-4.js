
function renderMovieList(items){
  if(!items.length){disableVirtualList();mediaList.innerHTML=`<div class="empty-list">${esc(t('noItems'))}</div>`;return}
  mountVirtualList('movie',items);
}
function renderSeriesGroups(items,groups=null){
  groups=groups||buildSeriesGroups(items);setLoadedCount(items,groups.length);mountVirtualList('series',groups,items);
}
function renderEpisodeList(group,allFilteredItems){
  disableVirtualList();
  const frag=document.createDocumentFragment(),bar=document.createElement('div');bar.className='series-toolbar';
  bar.innerHTML=`<button class="series-back" type="button">← ${esc(t('allSeries'))}</button><div class="series-heading"><strong>${esc(group.title)}</strong><span>${group.items.length.toLocaleString(currentLang)} ${t('episodes')}</span></div>`;
  bar.querySelector('.series-back').addEventListener('click',()=>renderSeriesGroups(allFilteredItems));frag.appendChild(bar);loadedCount.textContent=`${group.items.length.toLocaleString(currentLang)} ${t('episodes')}`;
  group.items.forEach((item,index)=>{
    const btn=document.createElement('button');btn.className='media-card episode-card';btn.dataset.key=item.key;const code=episodeCode(item);const episodeName=item.episodeTitle||item.title;
    const meta=[code,item.year,item.country!=='Неизвестна'?item.country:'',fmtDuration(item.duration)].filter(Boolean).join(' · ');
    btn.innerHTML=`<span class="dot"></span><div class="episode-index">${esc(code||t('episode'))}</div><div><div class="media-name">${esc(episodeName)}</div><div class="media-meta">${esc(meta||`${t('episode')} ${index+1}`)}</div><div class="media-tags"><span class="tag">${esc(item.genre)}</span></div></div>`;
    btn.addEventListener('click',()=>{if(activeButton)activeButton.classList.remove('active');activeButton=btn;btn.classList.add('active');selectItem(item);setTimeout(()=>setDrawer(false),420)});frag.appendChild(btn);
  });
  mediaList.replaceChildren(frag);mediaList.scrollTop=0;
}
function renderList(items){
  if(!items.length){disableVirtualList();mediaList.innerHTML=`<div class="empty-list">${esc(t('noItems'))}</div>`;return}
  if(currentType==='series')renderSeriesGroups(items);else renderMovieList(items);
}

async function resolveItemDetails(item){
  if(resolvedCache.has(item.key))return mergeEpisodeMeta(resolvedCache.get(item.key),item);
  let details=null;
  if(item.source==='ia')details=await hydrateIA(item,item.type);
  else if(item.source==='commons'){
    const data=await fetchJson(commonsDetailUrl(item.pageTitle),18000);const page=Object.values(data?.query?.pages||{})[0];if(page)details=hydrateCommons(page,item.type,item.category||'');
  }
  if(details){mergeEpisodeMeta(details,item);resolvedCache.set(item.key,details);Object.assign(item,{duration:details.duration||item.duration,genre:details.genre||item.genre,country:details.country||item.country,description:details.description||item.description,poster:details.poster||item.poster})}
  return details;
}
async function selectItem(item){
  setStatus(t('preparingVideo'));loadProgress.textContent=`${t('loadingStreamSubs')} · “${item.title}”`;
  try{
    const details=await resolveItemDetails(item);
    if(!details){item._invalid=true;applyFilters();setStatus(t('noSuitableVideo'),'bad');loadProgress.textContent=t('removed');return}
    loadProgress.textContent=`${t('catalogReady')} · ${t('detailsOnSelect')}`;playResolvedItem(details);
  }catch(e){console.error(e);setStatus(t('videoLoadFail'),'bad');loadProgress.textContent=t('videoLoadFail')}
}


function destroyHls(){if(hls){hls.destroy();hls=null}}
function clearSubtitleState(){subtitleCues=[];subtitleLayer.innerHTML='';subtitleObjectUrls.forEach(URL.revokeObjectURL);subtitleObjectUrls=[]}
function playResolvedItem(item){
  currentItem=item;destroyHls();clearSubtitleState();video.pause();video.removeAttribute('src');video.load();centerMessage.classList.add('hidden');nowPlaying.classList.remove('hidden');playerControls.classList.remove('hidden');
  nowTitle.textContent=item.type==='series'?(item.episodeTitle||item.title):item.title;nowSub.textContent=item.type==='series'?[item.seriesTitle&&item.seriesTitle!==item.episodeTitle?item.seriesTitle:'',episodeCode(item),item.year,item.genre,item.country!=='Неизвестна'?item.country:'',fmtDuration(item.duration)].filter(Boolean).join(' · '):[t('movie'),item.year,item.genre,item.country!=='Неизвестна'?item.country:'',fmtDuration(item.duration)].filter(Boolean).join(' · ');
  buildSubtitleMenu(item);setStatus(t('connecting'));
  const isHls=/\.m3u8($|\?)/i.test(item.stream)||/mpegurl/i.test(item.mime||'');
  if(isHls&&window.Hls&&Hls.isSupported()){
    hls=new Hls({enableWorker:true,backBufferLength:60});hls.loadSource(item.stream);hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED,()=>startPlayback(item));hls.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal)setStatus(t('streamUnavailable'),'bad')});
  }else{video.src=item.stream;video.addEventListener('loadedmetadata',()=>restorePosition(item),{once:true});video.play().then(()=>setStatus(t('playing'),'ok')).catch(()=>setStatus(t('pressPlay'),'ok'))}
}
function startPlayback(item){restorePosition(item);video.play().then(()=>setStatus(t('playing'),'ok')).catch(()=>setStatus(t('pressPlay'),'ok'))}
function progressKey(item){return `awc:progress:${item.key}`}
function restorePosition(item){try{const t=Number(localStorage.getItem(progressKey(item))||0);if(t>15&&Number.isFinite(video.duration)&&t<video.duration-30)video.currentTime=t}catch(e){}}
let progressTick=0;video.addEventListener('timeupdate',()=>{updateSubtitle();if(!currentItem)return;const now=Date.now();if(now-progressTick>5000&&video.currentTime>5){progressTick=now;try{localStorage.setItem(progressKey(currentItem),String(Math.floor(video.currentTime)))}catch(e){}}});
video.addEventListener('ended',()=>{if(currentItem)try{localStorage.removeItem(progressKey(currentItem))}catch(e){};setStatus(t('end'),'ok')});
video.addEventListener('playing',()=>setStatus(t('playing'),'ok'));video.addEventListener('waiting',()=>setStatus(t('buffering'),'warn'));video.addEventListener('error',()=>setStatus(t('videoError'),'bad'));

function buildSubtitleMenu(item){
  const subs=item.subtitles||[];subtitleSelect.innerHTML=`<option value="">${esc(t('off'))}</option>`+subs.map((s,i)=>`<option value="${i}">${esc(s.label||s.lang||t('subtitles'))}</option>`).join('');
}
subtitleSelect.addEventListener('change',()=>{clearSubtitleState();if(!currentItem||subtitleSelect.value==='')return;const sub=currentItem.subtitles[Number(subtitleSelect.value)];loadSubtitle(sub).catch(e=>{console.warn(e);setStatus(t('subsLoadFail'),'warn')})});
async function loadSubtitle(sub){setStatus(t('subsLoading'));const text=await fetchText(sub.url);subtitleCues=parseSubtitle(text);setStatus(t('subsLoaded'),'ok');updateSubtitle()}
function parseSubtitle(raw=''){
  let text=raw.replace(/^\uFEFF/,'').replace(/\r/g,'').trim();if(!text)return[];text=text.replace(/^WEBVTT[^\n]*\n+/i,'');
  const blocks=text.split(/\n{2,}/);const cues=[];
  for(const b of blocks){const lines=b.split('\n').filter(Boolean);let idx=lines.findIndex(l=>l.includes('-->'));if(idx<0)continue;const timing=lines[idx].match(/([^ ]+)\s+-->\s+([^ ]+)/);if(!timing)continue;const start=parseTimecode(timing[1]),end=parseTimecode(timing[2]);if(!Number.isFinite(start)||!Number.isFinite(end))continue;const cueText=lines.slice(idx+1).join('\n').replace(/<[^>]+>/g,'').trim();if(cueText)cues.push({start,end,text:cueText})
  }
  return cues.sort((a,b)=>a.start-b.start);
}
function parseTimecode(s=''){const p=s.replace(',','.').split(':').map(Number);if(p.some(Number.isNaN))return NaN;if(p.length===3)return p[0]*3600+p[1]*60+p[2];if(p.length===2)return p[0]*60+p[1];return p[0]}
function updateSubtitle(){if(!subtitleCues.length){subtitleLayer.innerHTML='';return}const t=video.currentTime;const cue=subtitleCues.find(c=>t>=c.start&&t<=c.end);subtitleLayer.innerHTML=cue?`<span class="subtitle-text">${esc(cue.text)}</span>`:''}

function fmtClock(sec){sec=Math.max(0,Math.floor(Number(sec)||0));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),ss=sec%60;return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`}
function syncPlayerUi(){playBtn.textContent=video.paused?'▶':'❚❚';muteBtn.textContent=(video.muted||video.volume===0)?'🔇':'🔊';volumeRange.value=video.muted?0:video.volume;const d=Number.isFinite(video.duration)?video.duration:0;seekRange.value=d?Math.round((video.currentTime/d)*1000):0;timeText.textContent=`${fmtClock(video.currentTime)} / ${fmtClock(d)}`}
playBtn.addEventListener('click',()=>video.paused?video.play().catch(()=>{}):video.pause());
muteBtn.addEventListener('click',()=>{video.muted=!video.muted;syncPlayerUi()});
volumeRange.addEventListener('input',()=>{video.muted=false;video.volume=Number(volumeRange.value);syncPlayerUi()});
seekRange.addEventListener('input',()=>{if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=(Number(seekRange.value)/1000)*video.duration});
ccBtn.addEventListener('click',()=>{if(!currentItem?.subtitles?.length){setStatus(t('noSubtitles'),'warn');return}settingsMenu.classList.add('open');subtitleSelect.focus()});
settingsBtn.addEventListener('click',()=>settingsMenu.classList.toggle('open'));
let speedIndex=0;const speeds=[1,1.25,1.5,1.75,2,.75];speedBtn.addEventListener('click',()=>{speedIndex=(speedIndex+1)%speeds.length;video.playbackRate=speeds[speedIndex];speedBtn.textContent=`${t('speed')}: ${speeds[speedIndex]}×`});
let fitMode=0;fitBtn.addEventListener('click',()=>{fitMode=(fitMode+1)%2;video.style.objectFit=fitMode?'cover':'contain';fitBtn.textContent=`${t('picture')}: ${fitMode?t('cover'):t('contain')}`});
fullscreenBtn.addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch(e){}});
video.addEventListener('play',syncPlayerUi);video.addEventListener('pause',syncPlayerUi);video.addEventListener('durationchange',syncPlayerUi);video.addEventListener('volumechange',syncPlayerUi);video.addEventListener('timeupdate',syncPlayerUi);
document.addEventListener('click',e=>{if(!settingsMenu.contains(e.target)&&e.target!==settingsBtn)settingsMenu.classList.remove('open')});
document.addEventListener('fullscreenchange',()=>fullscreenBtn.classList.toggle('active',!!document.fullscreenElement));
window.addEventListener('resize',()=>{});


languageEl.innerHTML=LANGS.map(([code,name])=>`<option value="${code}">${name}</option>`).join('');
currentLang='en';
languageEl.value='en';
languageEl.addEventListener('change',()=>{setLanguage(languageEl.value)});
setLanguage(currentLang);

function startCinema(){setLanguage('en');legalGate.classList.add('hidden');appRoot.classList.remove('prestart');playerControls.classList.add('hidden');setDrawer(true);ensureLoaded('movie')}
acceptLegal.addEventListener('click',()=>{startCinema();legalGate.remove()});
declineLegal.addEventListener('click',()=>{appRoot.classList.add('prestart');legalGate.innerHTML=`<div class="legal-declined"><h2>All-World Cinema</h2><p>${esc(t('declined'))}</p></div>`});
