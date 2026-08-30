function guessMime(name=''){if(/\.mp4$/i.test(name))return 'video/mp4';if(/\.webm$/i.test(name))return 'video/webm';if(/\.og[gv]$/i.test(name))return 'video/ogg';return ''}
function guessSubtitleLang(name='',lang=''){const s=`${name} ${safeText(lang)}`.toLowerCase();const m=s.match(/(?:^|[._\- ])(bg|bul|bulgarian|en|eng|english|fr|fra|fre|de|ger|deu|es|spa|it|ita|ru|rus|fa|per|fas)(?:[._\- ]|$)/);const map={bul:'bg',bulgarian:'bg',eng:'en',english:'en',fra:'fr',fre:'fr',ger:'de',deu:'de',spa:'es',ita:'it',rus:'ru',per:'fa',fas:'fa'};return m?(map[m[1]]||m[1]):''}
function guessSubtitleLabel(name='',lang=''){const l=guessSubtitleLang(name,lang);const labels={bg:'Български',en:'English',fr:'Français',de:'Deutsch',es:'Español',it:'Italiano',ru:'Русский',fa:'فارسی'};return labels[l]||safeText(lang)||'Субтитри'}

function commonsDetailUrl(title){
  const p=new URLSearchParams({action:'query',format:'json',origin:'*',titles:title,prop:'videoinfo',viprop:'url|derivatives|timedtext|extmetadata|commonmetadata',viurlwidth:'420',viextmetadatalanguage:'en'});return `${COMMONS_API}?${p}`;
}
function hydrateCommons(page,type,category=''){
  const title=cleanTitle(page.title||'');if(!title||isExcludedTitle(title))return null;
  const vi=page.videoinfo?.[0];if(!vi)return null;
  const derivatives=Array.isArray(vi.derivatives)?vi.derivatives:[];
  const videoChoices=derivatives.filter(d=>d.src&&/^video\//i.test(d.type||''));
  const choice=videoChoices.sort((a,b)=>{const as=(/mp4/i.test(a.type||'')?100:0)+(Number(a.width)||0)/20;const bs=(/mp4/i.test(b.type||'')?100:0)+(Number(b.width)||0)/20;return bs-as})[0];
  const stream=choice?.src||vi.url;if(!stream)return null;
  const cm=vi.commonmetadata||{},ex=vi.extmetadata||{};const duration=secondsFromAny(cm.duration||cm.Duration||metaVal(ex,'Duration'));
  if(type==='movie'&&duration&&duration<2400)return null;if(type==='series'&&duration&&duration<900)return null;
  const timed=Array.isArray(vi.timedtext)?vi.timedtext:[];
  const subtitles=timed.map(t=>{const lang=t.lang||t.language||'';return{lang,label:lang==='bg'?'Български':(t.title||lang||'Субтитри'),name:t.title||lang,url:commonsTimedTextUrl(page.title,lang),format:'vtt'}}).filter(s=>s.lang);
  const categoriesText=metaVal(ex,'Categories'),desc=metaVal(ex,'ImageDescription')||metaVal(ex,'ObjectName');
  const text=textPool(title,desc,categoriesText,metaVal(ex,'Credit'),metaVal(ex,'DateTimeOriginal'),category);
  return {key:`commons:${page.pageid}`,source:'commons',type,title,year:firstYear(metaVal(ex,'DateTimeOriginal')||title),genre:inferGenre(text),country:inferCountry(text),description:desc,poster:vi.thumburl||'',stream,mime:choice?.type||vi.mime||'',duration,subtitles,pageTitle:page.title,pageid:page.pageid,category};
}

function dedupe(items){
  const map=new Map();
  for(const item of items){
    const k=item.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()+`|${item.year||''}`;
    const prev=map.get(k);if(!prev){map.set(k,item);continue}
    const score=x=>(x.duration?2:0)+(x.poster?1:0)+(x.description?1:0)+(x.source==='commons'?1:0);
    if(score(item)>score(prev))map.set(k,item);
  }
  return [...map.values()].sort((a,b)=>(Number(b.year)||0)-(Number(a.year)||0)||a.title.localeCompare(b.title));
}

async function ensureLoaded(type){
  currentType=type;updateTypeButtons();
  if(loadState[type]){refreshControls();applyFilters();return}
  const token=++loadingToken;catalogLoadingActive=true;
  mediaList.innerHTML=`<div class="loading">${esc(t('listLoading'))}</div>`;loadedCount.textContent=t('loading');setStatus(t('catalogLoading'));
  try{
    let items=await loadBundledIndex(type);
    if(token!==loadingToken)return;
    if(items.length){catalogMode[type]='catalog';loadProgress.textContent=`${t('catalogReady')} · ${items.length.toLocaleString(currentLang)} ${t('indexedTitles')} · ${t('detailsOnSelect')}`}
    else{
      const [ia,commons]=await Promise.allSettled([loadLiveLightInternetArchive(type,token),loadLiveLightCommons(type,token)]);
      if(token!==loadingToken)return;
      const iaItems=ia.status==='fulfilled'?ia.value:[],coItems=commons.status==='fulfilled'?commons.value:[];
      items=dedupe([...iaItems,...coItems]);catalogMode[type]='live';
      loadProgress.textContent=`${t('listReady')} · ${items.length.toLocaleString(currentLang)} ${t('titles')} · ${t('detailsOnSelect')}`;
    }
    allMedia[type]=dedupe(items);loadState[type]=true;catalogLoadingActive=false;refreshControls();applyFilters();setStatus(allMedia[type].length?t('ready'):t('noLoaded'),allMedia[type].length?'ok':'bad');
  }catch(e){catalogLoadingActive=false;console.error(e);loadProgress.textContent=t('catalogError');mediaList.innerHTML=`<div class="empty-list">${esc(t('loadFail'))}</div>`;setStatus(t('catalogError'),'bad')}
}
function updateTypeButtons(){document.querySelectorAll('.type-btn').forEach(b=>b.classList.toggle('active',b.dataset.type===currentType))}
document.querySelectorAll('.type-btn').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.type!==currentType)ensureLoaded(b.dataset.type)}));

function refreshControls(){
  const items=allMedia[currentType];
  const genres=[...new Set(items.map(x=>x.genre).filter(x=>x&&x!=='Друг'))].sort((a,b)=>String(a).localeCompare(String(b),'bg'));
  const countries=[...new Set(items.map(x=>x.country).filter(x=>x&&x!=='Неизвестна'))].sort((a,b)=>String(a).localeCompare(String(b),'bg'));
  const g=genreEl.value,c=countryEl.value;
  genreEl.innerHTML=`<option value="">${esc(t('allGenres'))}</option>`+genres.map(x=>`<option value="${esc(x)}">${esc(optionLabel('genre',x))}</option>`).join('');
  countryEl.innerHTML=`<option value="">${esc(t('allCountries'))}</option>`+countries.map(x=>`<option value="${esc(x)}">${esc(optionLabel('country',x))}</option>`).join('');
  if(genres.includes(g))genreEl.value=g;if(countries.includes(c))countryEl.value=c;
}
function getFilteredItems(type=currentType){
  const q=searchEl.value.trim().toLowerCase(),g=genreEl.value,c=countryEl.value;
  return allMedia[type].filter(x=>{const hay=`${x.title||''} ${x.seriesTitle||''} ${x.episodeTitle||''}`.toLowerCase();return !x._invalid&&(!q||hay.includes(q))&&(!g||x.genre===g)&&(!c||x.country===c)});
}
function setLoadedCount(items,groupsCount=0){
  lastCountSnapshot={type:currentType,items:items.length,groups:groupsCount,valid:true};
  paintLoadedCount();
}

const VIRTUAL_ROW_HEIGHT=86;
const VIRTUAL_BUFFER=6;
let virtualRows=[];
let virtualKind='';
let virtualSourceItems=null;
let virtualFrame=0;

function disableVirtualList(){
  virtualRows=[];virtualKind='';virtualSourceItems=null;
  if(virtualFrame){cancelAnimationFrame(virtualFrame);virtualFrame=0}
}
function virtualSpacer(height){
  const el=document.createElement('div');el.className='virtual-spacer';el.style.height=`${Math.max(0,height)}px`;return el;
}
function createMovieCard(item){
  const btn=document.createElement('button');btn.className='media-card';btn.dataset.key=item.key;
  const poster=item.poster?`<img class="poster" src="${esc(item.poster)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;poster-fallback&quot;>AW</div>'">`:'<div class="poster-fallback">AW</div>';
  const meta=[item.year,item.country!=='Неизвестна'?item.country:'',fmtDuration(item.duration)].filter(Boolean).join(' · ');
  btn.innerHTML=`<span class="dot"></span>${poster}<div><div class="media-name">${esc(item.title)}</div><div class="media-meta">${esc(meta||item.genre)}</div><div class="media-tags"><span class="tag">${esc(item.genre)}</span></div></div>`;
  btn.addEventListener('click',()=>{if(activeButton)activeButton.classList.remove('active');activeButton=btn;btn.classList.add('active');selectItem(item);setTimeout(()=>setDrawer(false),420)});
  return btn;
}
function createSeriesCard(group){
  const sample=group.items.find(x=>x.poster)||group.items[0],btn=document.createElement('button');btn.className='media-card series-card';
  const poster=sample?.poster?`<img class="poster" src="${esc(sample.poster)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;poster-fallback&quot;>TV</div>'">`:'<div class="poster-fallback">TV</div>';
  const years=group.items.map(x=>Number(x.year)||0).filter(Boolean).sort((a,b)=>a-b),yearText=years.length?(years[0]===years[years.length-1]?String(years[0]):`${years[0]}–${years[years.length-1]}`):'';
  const genres=[...new Set(group.items.map(x=>x.genre).filter(Boolean))];
  btn.innerHTML=`<span class="dot"></span>${poster}<div><div class="media-name">${esc(group.title)}</div><div class="media-meta"><span class="series-count">${group.items.length.toLocaleString(currentLang)} ${t('episodes')}</span>${yearText?` · ${esc(yearText)}`:''}</div><div class="media-tags">${genres[0]?`<span class="tag">${esc(genres[0])}</span>`:''}</div></div>`;
  btn.addEventListener('click',()=>renderEpisodeList(group,virtualSourceItems||[]));
  return btn;
}
function renderVirtualWindow(){
  if(!virtualRows.length)return;
  const keepTop=mediaList.scrollTop;
  const viewport=Math.max(300,mediaList.clientHeight||600);
  const start=Math.max(0,Math.floor(keepTop/VIRTUAL_ROW_HEIGHT)-VIRTUAL_BUFFER);
  const end=Math.min(virtualRows.length,Math.ceil((keepTop+viewport)/VIRTUAL_ROW_HEIGHT)+VIRTUAL_BUFFER);
  const frag=document.createDocumentFragment();
  if(start)frag.appendChild(virtualSpacer(start*VIRTUAL_ROW_HEIGHT));
  for(let i=start;i<end;i++)frag.appendChild(virtualKind==='series'?createSeriesCard(virtualRows[i]):createMovieCard(virtualRows[i]));
  if(end<virtualRows.length)frag.appendChild(virtualSpacer((virtualRows.length-end)*VIRTUAL_ROW_HEIGHT));
  mediaList.replaceChildren(frag);
  mediaList.scrollTop=keepTop;
}
function mountVirtualList(kind,rows,sourceItems=null){
  virtualKind=kind;virtualRows=rows;virtualSourceItems=sourceItems;mediaList.scrollTop=0;renderVirtualWindow();
}
function queueVirtualWindow(){
  if(!virtualRows.length||virtualFrame)return;
  virtualFrame=requestAnimationFrame(()=>{virtualFrame=0;renderVirtualWindow()});
}
mediaList.addEventListener('scroll',queueVirtualWindow,{passive:true});
window.addEventListener('resize',queueVirtualWindow,{passive:true});

function applyFilters(){
  const items=getFilteredItems(currentType);
  if(!items.length){disableVirtualList();setLoadedCount(items,0);mediaList.innerHTML=`<div class="empty-list">${esc(t('noItems'))}</div>`;return}
  if(currentType==='series'){
    const groups=buildSeriesGroups(items);setLoadedCount(items,groups.length);mountVirtualList('series',groups,items);
  }else{setLoadedCount(items,0);mountVirtualList('movie',items)}
}
genreEl.addEventListener('change',applyFilters);
countryEl.addEventListener('change',applyFilters);
searchEl.addEventListener('input',applyFilters);
