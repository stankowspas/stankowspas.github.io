const LANGS = [["bg","Български"],["en","English"],["de","Deutsch"],["fr","Français"],["es","Español"],["it","Italiano"],["pt","Português"],["nl","Nederlands"],["pl","Polski"],["ro","Română"],["el","Ελληνικά"],["tr","Türkçe"],["ru","Русский"],["uk","Українська"],["sr","Српски"],["hr","Hrvatski"],["cs","Čeština"],["sk","Slovenčina"],["hu","Magyar"],["sv","Svenska"],["no","Norsk"],["da","Dansk"],["fi","Suomi"],["ar","العربية"],["he","עברית"],["zh-CN","简体中文"],["zh-TW","繁體中文"],["ja","日本語"],["ko","한국어"],["hi","हिन्दी"],["id","Bahasa Indonesia"],["vi","Tiếng Việt"],["th","ไทย"]];
const GENRE_KEY_BY_VALUE = {"Екшън":"action","Приключенски":"adventure","Анимация":"animation","Комедия":"comedy","Криминален":"crime","Документален":"documentary","Драма":"drama","Фентъзи":"fantasy","Ужаси":"horror","Мюзикъл":"musical","Романтичен":"romance","Фантастика":"scifi","Трилър":"thriller","Уестърн":"western","Друг":"other"};
const COUNTRY_CODE_BY_VALUE = {"САЩ":"US","Великобритания":"GB","Франция":"FR","Германия":"DE","Италия":"IT","Испания":"ES","Русия":"RU","Иран":"IR","Индия":"IN","Япония":"JP","Китай":"CN","Канада":"CA","Австралия":"AU","България":"BG"};
let currentLang='en';
function t(key){
  const active=TRANSLATIONS[currentLang]||TRANSLATIONS.en;
  return active.ui[key]??TRANSLATIONS.en.ui[key]??key;
}
function optionLabel(kind,value){
  const active=TRANSLATIONS[currentLang]||TRANSLATIONS.en;
  if(kind==='genre'){
    const key=GENRE_KEY_BY_VALUE[value]||'other';
    return active.genres[key]??TRANSLATIONS.en.genres[key]??String(value||'');
  }
  if(kind==='country'){
    const code=COUNTRY_CODE_BY_VALUE[value];
    if(!code)return String(value||'');
    return active.countries[code]??TRANSLATIONS.en.countries[code]??String(value||'');
  }
  return String(value||'');
}
let lastCountSnapshot={type:'movie',items:0,groups:0,valid:false};
function paintLoadedCount(){
  if(!lastCountSnapshot.valid||lastCountSnapshot.type!==currentType)return;
  if(currentType==='series')loadedCount.textContent=`${lastCountSnapshot.groups.toLocaleString(currentLang)} ${t('series')} · ${lastCountSnapshot.items.toLocaleString(currentLang)} ${t('episodes')}`;
  else loadedCount.textContent=`${lastCountSnapshot.items.toLocaleString(currentLang)} ${t('movies')}`;
}
function setLanguage(lang){
  currentLang=TRANSLATIONS[lang]?lang:'en';
  if(document.documentElement.lang!==currentLang)document.documentElement.lang=currentLang;
  const nextDir=['ar','he'].includes(currentLang)?'rtl':'ltr';
  if(document.documentElement.dir!==nextDir)document.documentElement.dir=nextDir;
  languageEl.value=currentLang;

  menuText.textContent=t('menu');
  welcomeText.textContent=t('welcome');
  drawerTitle.textContent=t('drawer');
  developerLink.textContent=t('developerWebsite');
  movieTypeBtn.textContent=t('movies');
  seriesTypeBtn.textContent=t('series');
  searchEl.placeholder=t('search');
  settingsTitle.textContent=t('subtitles');

  if(genreEl.options.length){
    genreEl.options[0].textContent=t('allGenres');
    for(let i=1;i<genreEl.options.length;i++)genreEl.options[i].textContent=optionLabel('genre',genreEl.options[i].value);
  }
  if(countryEl.options.length){
    countryEl.options[0].textContent=t('allCountries');
    for(let i=1;i<countryEl.options.length;i++)countryEl.options[i].textContent=optionLabel('country',countryEl.options[i].value);
  }

  playBtn.title=t('play'); playBtn.setAttribute('aria-label',t('play'));
  muteBtn.title=t('mute'); muteBtn.setAttribute('aria-label',t('mute'));
  settingsBtn.title=t('settings'); settingsBtn.setAttribute('aria-label',t('settings'));
  fullscreenBtn.title=t('fullscreen'); fullscreenBtn.setAttribute('aria-label',t('fullscreen'));
  volumeRange.setAttribute('aria-label',t('volume'));
  seekRange.setAttribute('aria-label',t('timeline'));
  ccBtn.title=t('subtitles'); ccBtn.setAttribute('aria-label',t('subtitles'));
  if(subtitleSelect.options.length&&subtitleSelect.value==='')subtitleSelect.options[0].textContent=t('off');
  const back=document.querySelector('.series-back');if(back)back.textContent='← '+t('allSeries');
  speedBtn.textContent=`${t('speed')}: ${video.playbackRate||1}×`;
  fitBtn.textContent=`${t('picture')}: ${video.style.objectFit==='cover'?t('cover'):t('contain')}`;
  paintLoadedCount();
}
const IA_SEARCH = 'https://archive.org/advancedsearch.php';
const IA_META = id => `https://archive.org/metadata/${encodeURIComponent(id)}`;
const IA_DOWNLOAD = (id,name) => `https://archive.org/download/${encodeURIComponent(id)}/${name.split('/').map(encodeURIComponent).join('/')}`;
const IA_IMAGE = id => `https://archive.org/services/img/${encodeURIComponent(id)}`;
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const COMMONS_MOVIE_CATEGORY = 'Category:Videos of films in the public domain';
const COMMONS_SERIES_CATEGORIES = ['Category:Videos of The Beverly Hillbillies'];
const CATALOG_URL = 'https://stankowspas.github.io/projects/all-world-cinema/app/catalog.json';
const CATALOG_VERSION = 4;
const PAGE_BUILD = '2026-08-30-cinema-freeze-fix-1';
const LIVE_IA_ROWS = 200;
const LIVE_IA_MAX_PAGES = 5;

const appRoot = document.getElementById('appRoot');
const video = document.getElementById('video');
const languageEl = document.getElementById('language');
const menuText = document.getElementById('menuText');
const welcomeText = document.getElementById('welcomeText');
const drawerTitle = document.getElementById('drawerTitle');
const developerLink = document.getElementById('developerLink');
const movieTypeBtn = document.getElementById('movieTypeBtn');
const seriesTypeBtn = document.getElementById('seriesTypeBtn');
const settingsTitle = document.getElementById('settingsTitle');
const drawer = document.getElementById('drawer');
const scrim = document.getElementById('scrim');
const menuToggle = document.getElementById('menuToggle');
const genreEl = document.getElementById('genre');
const countryEl = document.getElementById('country');
const searchEl = document.getElementById('search');
const mediaList = document.getElementById('mediaList');
const loadedCount = document.getElementById('loadedCount');
const loadProgress = document.getElementById('loadProgress');
const centerMessage = document.getElementById('centerMessage');
const nowPlaying = document.getElementById('nowPlaying');
const nowTitle = document.getElementById('nowTitle');
const nowSub = document.getElementById('nowSub');
const statusEl = document.getElementById('status');
const backdrop = document.getElementById('backdrop');
const subtitleSelect = document.getElementById('subtitleSelect');
const subtitleLayer = document.getElementById('subtitleLayer');
const playerControls = document.getElementById('playerControls');
const playBtn = document.getElementById('playBtn');
const muteBtn = document.getElementById('muteBtn');
const volumeRange = document.getElementById('volumeRange');
const seekRange = document.getElementById('seekRange');
const timeText = document.getElementById('timeText');
const ccBtn = document.getElementById('ccBtn');
const settingsBtn = document.getElementById('settingsBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const settingsMenu = document.getElementById('settingsMenu');
const speedBtn = document.getElementById('speedBtn');
const fitBtn = document.getElementById('fitBtn');
const legalGate = document.getElementById('legalGate');
const acceptLegal = document.getElementById('acceptLegal');
const declineLegal = document.getElementById('declineLegal');

let currentType = 'movie';
let allMedia = {movie:[],series:[]};
let loadState = {movie:false,series:false};
let catalogMode = {movie:'',series:''};
let activeButton = null;
let hls = null;
let currentItem = null;
let subtitleCues = [];
let subtitleObjectUrls = [];
let loadingToken = 0;
let catalogLoadingActive = false;
let bundledCatalogPromise = null;
const resolvedCache = new Map();

const EXCLUDE_RE = /\b(trailer|teaser|preview|promo|clip|excerpt|segment|commercial|advertisement)\b|трейл|тийзър|реклама|откъс/i;
const VIDEO_RE = /\.(mp4|m4v|webm|ogv|ogg)(\?.*)?$/i;
const SUB_RE = /\.(vtt|srt)$/i;
const GENRES = [
  ['Екшън',/\b(action|martial arts|war film)\b|екшън/i],['Приключенски',/\b(adventure)\b|приключ/i],['Анимация',/\b(animation|animated|cartoon)\b|анимац/i],['Комедия',/\b(comedy|comedies)\b|комеди/i],['Криминален',/\b(crime|detective|gangster)\b|кримин/i],['Документален',/\b(documentary|nonfiction)\b|документ/i],['Драма',/\b(drama|melodrama)\b|драма/i],['Фентъзи',/\b(fantasy)\b|фентъзи/i],['Ужаси',/\b(horror)\b|ужас/i],['Мюзикъл',/\b(musical)\b|мюзик/i],['Романтичен',/\b(romance|romantic)\b|романтич/i],['Фантастика',/\b(science fiction|sci[- ]?fi)\b|фантаст/i],['Трилър',/\b(thriller|suspense)\b|трилър/i],['Уестърн',/\b(western)\b|уестърн/i]
];
const COUNTRIES = [
  ['САЩ',/\b(united states|u\.s\.a\.?|usa|american film|films of the united states)\b/i],['Великобритания',/\b(united kingdom|british|england|films of the united kingdom)\b/i],['Франция',/\b(france|french|films of france)\b/i],['Германия',/\b(germany|german|films of germany)\b/i],['Италия',/\b(italy|italian|films of italy)\b/i],['Испания',/\b(spain|spanish|films of spain)\b/i],['Русия',/\b(russia|russian|soviet union|ussr|soviet film)\b/i],['Иран',/\b(iran|iranian|persian film)\b/i],['Индия',/\b(india|indian film|bollywood)\b/i],['Япония',/\b(japan|japanese film)\b/i],['Китай',/\b(china|chinese film)\b/i],['Канада',/\b(canada|canadian film)\b/i],['Австралия',/\b(australia|australian film)\b/i],['България',/\b(bulgaria|bulgarian film)\b|българ/i]
];

function setDrawer(open){drawer.classList.toggle('closed',!open);scrim.classList.toggle('hidden',!open)}
menuToggle.addEventListener('click',()=>setDrawer(drawer.classList.contains('closed')));
scrim.addEventListener('click',()=>setDrawer(false));
