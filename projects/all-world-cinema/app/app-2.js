function setStatus(text,type=''){statusEl.textContent=text;statusEl.className='status'+(type?' '+type:'')}
function safeText(v){if(Array.isArray(v)) return v.join(' · '); return v==null?'':String(v)}
function stripHtml(v=''){const d=document.createElement('div');d.innerHTML=String(v);return (d.textContent||'').replace(/\s+/g,' ').trim()}
function cleanTitle(t=''){return String(t).replace(/^File:/i,'').replace(/\.(webm|ogv|ogg|mp4)$/i,'').replace(/_/g,' ').trim()}
function firstYear(v=''){const m=String(v).match(/\b(18|19|20)\d{2}\b/);return m?m[0]:''}
function normalizeArray(v){return Array.isArray(v)?v:(v?[v]:[])}
function textPool(...parts){return parts.flatMap(normalizeArray).map(stripHtml).join(' · ')}
function inferGenre(text){for(const [name,re] of GENRES) if(re.test(text)) return name;return 'Друг'}
function inferCountry(text){for(const [name,re] of COUNTRIES) if(re.test(text)) return name;return 'Неизвестна'}
function isExcludedTitle(title){return EXCLUDE_RE.test(String(title||''))}
function secondsFromAny(v){if(v==null)return 0;if(typeof v==='number')return v;const s=String(v).trim();if(/^\d+(\.\d+)?$/.test(s))return Number(s);const p=s.split(':').map(Number);if(p.some(Number.isNaN))return 0;return p.reduce((a,n)=>a*60+n,0)}
function fmtDuration(sec){sec=Math.round(Number(sec)||0);if(!sec)return '';const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60);return h?`${h}h ${m}m`:`${m}m`}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function tidyName(v=''){return String(v||'').replace(/[_]+/g,' ').replace(/\s+/g,' ').replace(/^[\s:|–—-]+|[\s:|–—-]+$/g,'').trim()}
function isGenericSeriesName(v=''){return /^(classic\s*tv|television|tv|tv series|television series|series|episodes?|без име на сериал)$/i.test(tidyName(v))}
function episodeCode(item){const s=Number(item?.season)||0,e=Number(item?.episode)||0;if(s&&e)return `S${String(s).padStart(2,'0')}E${String(e).padStart(2,'0')}`;if(e)return `E${String(e).padStart(2,'0')}`;if(s)return `S${String(s).padStart(2,'0')}`;return ''}
function deriveEpisodeMeta(item){
  const title=tidyName(item.title),category=tidyName(item.category),explicit=tidyName(item.seriesTitle||item.series);
  let seriesTitle=!isGenericSeriesName(explicit)?explicit:'',episodeTitle=tidyName(item.episodeTitle),season=Number(item.season)||0,episode=Number(item.episode)||0;
  if(!seriesTitle&&category){const m=category.match(/^Category:\s*Videos of (.+)$/i);if(m&&!isGenericSeriesName(m[1]))seriesTitle=tidyName(m[1])}
  const patterns=[
    /^(.*?)\s*(?:[-–—:|]\s*)?S(?:eason)?\s*0*(\d{1,2})\s*E(?:p(?:isode)?)?\s*0*(\d{1,3})\b[\s:._|–—-]*(.*)$/i,
    /^(.*?)\s*(?:[-–—:|]\s*)?0*(\d{1,2})x0*(\d{1,3})\b[\s:._|–—-]*(.*)$/i,
    /^(.*?)\s*(?:[-–—:|]\s*)?Season\s*0*(\d{1,2})\s*[,.:_-]*\s*(?:Episode|Ep\.?)\s*#?0*(\d{1,3})\b[\s:._|–—-]*(.*)$/i
  ];
  for(const re of patterns){const m=title.match(re);if(!m)continue;if(!seriesTitle&&tidyName(m[1]))seriesTitle=tidyName(m[1]);if(!season)season=Number(m[2])||0;if(!episode)episode=Number(m[3])||0;if(!episodeTitle&&tidyName(m[4]))episodeTitle=tidyName(m[4]);break}
  if(!seriesTitle){const m=title.match(/^(.{2,90}?)\s+(?:[-–—|]|:)\s+(.+)$/);if(m&&!isGenericSeriesName(m[1])){seriesTitle=tidyName(m[1]);if(!episodeTitle)episodeTitle=tidyName(m[2])}}
  if(seriesTitle&&!episodeTitle){let rest=title;if(rest.toLowerCase().startsWith(seriesTitle.toLowerCase()))rest=tidyName(rest.slice(seriesTitle.length));const m=rest.match(/^(?:Episode|Ep\.?)?\s*#?0*(\d{1,3})\s*(?:[-–—:|.]\s*)?(.+)?$/i);if(m&&m[1]){if(!episode)episode=Number(m[1])||0;if(m[2])episodeTitle=tidyName(m[2])}else if(rest&&rest!==title)episodeTitle=rest}
  if(!episodeTitle)episodeTitle=title;
  if(!seriesTitle)seriesTitle=title;
  return {seriesTitle,episodeTitle,season,episode};
}
function seriesGroupKey(item){return tidyName(item.seriesTitle||item.title).toLocaleLowerCase()}
function buildSeriesGroups(items){
  const map=new Map();
  for(const item of items){const key=seriesGroupKey(item);let g=map.get(key);if(!g){g={key,title:item.seriesTitle||item.title,items:[]};map.set(key,g)}g.items.push(item)}
  const groups=[...map.values()];
  for(const g of groups)g.items.sort((a,b)=>(Number(a.season)||999)-(Number(b.season)||999)||(Number(a.episode)||9999)-(Number(b.episode)||9999)||(Number(a.year)||0)-(Number(b.year)||0)||String(a.episodeTitle||a.title).localeCompare(String(b.episodeTitle||b.title)));
  return groups.sort((a,b)=>a.title.localeCompare(b.title,'bg'));
}
function mergeEpisodeMeta(details,item){if(!details||item?.type!=='series')return details;details.seriesTitle=item.seriesTitle||details.seriesTitle||item.title;details.episodeTitle=item.episodeTitle||details.episodeTitle||details.title;details.season=Number(item.season||details.season)||0;details.episode=Number(item.episode||details.episode)||0;return details}

async function fetchJson(url,timeout=16000){const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),timeout);try{const r=await fetch(url,{cache:'no-store',signal:ctrl.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(timer)}}
async function fetchText(url,timeout=14000){const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),timeout);try{const r=await fetch(url,{cache:'no-store',signal:ctrl.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.text()}finally{clearTimeout(timer)}}

function normalizeIndexItem(raw,type){
  if(!raw||!raw.title||!raw.source)return null;
  const item={...raw,type:raw.type||type};
  item.key=item.key||(item.source==='ia'?`ia:${item.identifier}`:`commons:${item.pageid||item.pageTitle||item.title}`);
  item.title=cleanTitle(item.title);
  item.year=item.year?String(item.year):'';
  item.genre=item.genre||'Друг';
  item.country=item.country||'Неизвестна';
  item.duration=Number(item.duration)||0;
  item.poster=item.poster||'';
  item.description=item.description||'';
  if(!item.title||isExcludedTitle(item.title))return null;
  if(item.type==='series')Object.assign(item,deriveEpisodeMeta(item));
  return item;
}

async function getBundledCatalog(){
  if(!bundledCatalogPromise)bundledCatalogPromise=fetchJson(`${CATALOG_URL}?v=${CATALOG_VERSION}&build=${encodeURIComponent(PAGE_BUILD)}&t=${Date.now()}`,30000).catch(()=>null);
  return bundledCatalogPromise;
}
async function loadBundledIndex(type){
  const data=await getBundledCatalog();if(!data||Number(data.version||0)<CATALOG_VERSION)return [];
  const source=Array.isArray(data[type])?data[type]:(Array.isArray(data.items)?data.items.filter(x=>(x.type||'movie')===type):[]);
  return source.map(x=>normalizeIndexItem(x,type)).filter(Boolean);
}

function iaSearchUrl(type,page=1,rows=LIVE_IA_ROWS){
  const collection=type==='movie'?'feature_films':'classic_tv';
  const q=`mediatype:movies AND collection:${collection}`;
  const p=new URLSearchParams({q,rows:String(rows),page:String(page),output:'json',sort:'downloads desc'});
  ['identifier','title','date','year','subject','description','creator','language','collection','coverage','runtime','duration'].forEach(f=>p.append('fl[]',f));
  return `${IA_SEARCH}?${p}`;
}
function lightIAFromDoc(doc,type){
  const title=safeText(doc.title);if(!doc.identifier||!title||isExcludedTitle(title))return null;
  const duration=secondsFromAny(doc.runtime||doc.duration);
  if(type==='movie'&&duration&&duration<2400)return null;
  if(type==='series'&&duration&&duration<900)return null;
  const text=textPool(doc.subject,doc.description,doc.creator,doc.language,doc.coverage,doc.collection);
  return normalizeIndexItem({key:`ia:${doc.identifier}`,source:'ia',type,title,identifier:doc.identifier,year:firstYear(doc.date||doc.year||title),genre:inferGenre(text),country:inferCountry(text),duration,poster:IA_IMAGE(doc.identifier)},type);
}
async function loadLiveLightInternetArchive(type,token){
  const first=await fetchJson(iaSearchUrl(type,1),18000);if(token!==loadingToken)return [];
  const docs=[...(first?.response?.docs||[])];
  const numFound=Number(first?.response?.numFound)||docs.length;
  const pages=Math.max(1,Math.min(LIVE_IA_MAX_PAGES,Math.ceil(numFound/LIVE_IA_ROWS)));
  loadProgress.textContent=`${t('listLoading')} · 1/${pages}`;
  if(pages>1){
    const rest=await Promise.allSettled(Array.from({length:pages-1},(_,i)=>fetchJson(iaSearchUrl(type,i+2),18000)));
    if(token!==loadingToken)return [];
    rest.forEach((r,i)=>{if(r.status==='fulfilled')docs.push(...(r.value?.response?.docs||[]));loadProgress.textContent=`${t('listLoading')} · ${i+2}/${pages}`});
  }
  return docs.map(d=>lightIAFromDoc(d,type)).filter(Boolean);
}

function commonsIndexUrl(category,continuation={}){
  const p=new URLSearchParams({action:'query',format:'json',origin:'*',generator:'categorymembers',gcmtitle:category,gcmtype:'file',gcmlimit:'500',prop:'videoinfo',viprop:'url|timedtext|extmetadata|commonmetadata',viurlwidth:'240',viextmetadatalanguage:'en'});
  Object.entries(continuation||{}).forEach(([k,v])=>{if(v!=null)p.set(k,String(v))});
  return `${COMMONS_API}?${p}`;
}
function metaVal(obj,key){return stripHtml(obj?.[key]?.value||'')}
function commonsTimedTextUrl(title,lang){const p=new URLSearchParams({action:'timedtext',title,lang,trackformat:'vtt',origin:'*'});return `${COMMONS_API}?${p}`}
function lightCommonsFromPage(page,type,category){
  const title=cleanTitle(page.title||'');if(!title||isExcludedTitle(title))return null;
  const vi=page.videoinfo?.[0];if(!vi)return null;
  const cm=vi.commonmetadata||{},ex=vi.extmetadata||{};
  const duration=secondsFromAny(cm.duration||cm.Duration||metaVal(ex,'Duration'));
  if(type==='movie'&&duration&&duration<2400)return null;
  if(type==='series'&&duration&&duration<900)return null;
  const timed=Array.isArray(vi.timedtext)?vi.timedtext:[];
  const subtitles=timed.map(t=>{const lang=t.lang||t.language||'';return{lang,label:lang==='bg'?'Български':(t.title||lang||'Субтитри'),name:t.title||lang,url:commonsTimedTextUrl(page.title,lang),format:'vtt'}}).filter(s=>s.lang);
  const categoriesText=metaVal(ex,'Categories');
  const desc=metaVal(ex,'ImageDescription')||metaVal(ex,'ObjectName');
  const text=textPool(title,desc,categoriesText,metaVal(ex,'Credit'),metaVal(ex,'DateTimeOriginal'),category);
  return normalizeIndexItem({key:`commons:${page.pageid}`,source:'commons',type,pageid:page.pageid,pageTitle:page.title,category,title,year:firstYear(metaVal(ex,'DateTimeOriginal')||title),genre:inferGenre(text),country:inferCountry(text),description:desc,duration,poster:vi.thumburl||'',subtitles},type);
}
async function loadLiveLightCommons(type,token){
  const categories=type==='movie'?[COMMONS_MOVIE_CATEGORY]:COMMONS_SERIES_CATEGORIES;
  const out=[];
  for(const category of categories){
    let continuation={};let pageNo=0;
    do{
      if(token!==loadingToken)return out;
      const data=await fetchJson(commonsIndexUrl(category,continuation),18000);pageNo++;
      const pages=Object.values(data?.query?.pages||{});for(const p of pages){const item=lightCommonsFromPage(p,type,category);if(item)out.push(item)}
      continuation=data?.continue||null;
      loadProgress.textContent=`${t('listLoading')} · ${pageNo}`;
    }while(continuation&&pageNo<20);
  }
  return out;
}

async function hydrateIA(doc,type){
  const meta=await fetchJson(IA_META(doc.identifier),16000);
  const m=meta?.metadata||{};const files=Array.isArray(meta?.files)?meta.files:[];
  const title=safeText(m.title||doc.title);if(!title||isExcludedTitle(title))return null;
  const videoFiles=files.filter(f=>VIDEO_RE.test(f.name||'')&&!isExcludedTitle(f.name||'')&&Number(f.size||0)>5_000_000);
  if(!videoFiles.length)return null;
  const ranked=videoFiles.map(f=>({f,score:(/\.ia\.mp4$/i.test(f.name)?70:0)+(/h\.264|mpeg4|512kb/i.test(`${f.format||''} ${f.name||''}`)?50:0)+(/\.mp4$/i.test(f.name)?40:0)+(Number(f.height||0)||0)/100})).sort((a,b)=>b.score-a.score);
  const vf=ranked[0].f;
  let duration=secondsFromAny(vf.length||m.runtime||m.duration);if(!duration){for(const x of videoFiles)duration=Math.max(duration,secondsFromAny(x.length))}
  if(type==='movie'&&duration&&duration<2400)return null;if(type==='series'&&duration&&duration<900)return null;
  const subs=files.filter(f=>SUB_RE.test(f.name||'')).map(f=>({lang:guessSubtitleLang(f.name,f.language),label:guessSubtitleLabel(f.name,f.language),name:f.name,url:IA_DOWNLOAD(doc.identifier,f.name),format:(f.name.toLowerCase().endsWith('.srt')?'srt':'vtt')}));
  const text=textPool(m.subject,doc.subject,m.description,doc.description,m.creator,doc.creator,m.language,doc.language,m.coverage,doc.coverage,m.collection);
  return {key:`ia:${doc.identifier}`,source:'ia',type,title,year:firstYear(m.date||m.year||doc.date||doc.year||title),genre:inferGenre(text),country:inferCountry(text),description:stripHtml(safeText(m.description||doc.description)),poster:IA_IMAGE(doc.identifier),stream:IA_DOWNLOAD(doc.identifier,vf.name),mime:guessMime(vf.name),duration,subtitles:subs,identifier:doc.identifier};
}
