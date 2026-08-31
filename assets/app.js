const LANGS={bg:'Български',en:'English',de:'Deutsch',fr:'Français',es:'Español',it:'Italiano',pt:'Português',nl:'Nederlands',pl:'Polski',ro:'Română',el:'Ελληνικά',tr:'Türkçe',ru:'Русский',uk:'Українська',sr:'Српски',hr:'Hrvatski',cs:'Čeština',sk:'Slovenčina',hu:'Magyar',sv:'Svenska',no:'Norsk',da:'Dansk',fi:'Suomi',ar:'العربية',he:'עברית','zh-CN':'简体中文','zh-TW':'繁體中文',ja:'日本語',ko:'한국어',hi:'हिन्दी',id:'Bahasa Indonesia',vi:'Tiếng Việt',th:'ไทย'};
const COPY={bg:['','Софтуерни решения, AI интеграции и интелигентна автоматизация.','Проекти','Избрани разработки и експерименти','Език','Разгледай','Назад към проектите','Проект'],en:['','Software solutions, AI integrations and intelligent automation.','Projects','Selected builds and experiments','Language','Explore','Back to projects','Project'],de:['','Softwarelösungen, KI-Integrationen und intelligente Automatisierung.','Projekte','Ausgewählte Entwicklungen und Experimente','Sprache','Öffnen','Zurück zu Projekten','Projekt'],fr:['','Solutions logicielles, intégrations IA et automatisation intelligente.','Projets','Développements et expérimentations sélectionnés','Langue','Découvrir','Retour aux projets','Projet'],es:['','Soluciones de software, integraciones de IA y automatización inteligente.','Proyectos','Desarrollos y experimentos seleccionados','Idioma','Explorar','Volver a proyectos','Proyecto'],it:['','Soluzioni software, integrazioni AI e automazione intelligente.','Progetti','Sviluppi ed esperimenti selezionati','Lingua','Apri','Torna ai progetti','Progetto'],pt:['','Soluções de software, integrações de IA e automação inteligente.','Projetos','Desenvolvimentos e experiências selecionados','Idioma','Explorar','Voltar aos projetos','Projeto'],nl:['','Softwareoplossingen, AI-integraties en intelligente automatisering.','Projecten','Geselecteerde ontwikkelingen en experimenten','Taal','Bekijken','Terug naar projecten','Project'],pl:['','Rozwiązania programistyczne, integracje AI i inteligentna automatyzacja.','Projekty','Wybrane realizacje i eksperymenty','Język','Zobacz','Powrót do projektów','Projekt'],ro:['','Soluții software, integrări AI și automatizare inteligentă.','Proiecte','Dezvoltări și experimente selectate','Limbă','Explorează','Înapoi la proiecte','Proiect'],el:['','Λύσεις λογισμικού, ενσωματώσεις AI και έξυπνος αυτοματισμός.','Έργα','Επιλεγμένες κατασκευές και πειράματα','Γλώσσα','Προβολή','Πίσω στα έργα','Έργο'],tr:['','Yazılım çözümleri, AI entegrasyonları ve akıllı otomasyon.','Projeler','Seçilmiş geliştirmeler ve deneyler','Dil','İncele','Projelere dön','Proje'],ru:['','Программные решения, AI-интеграции и интеллектуальная автоматизация.','Проекты','Избранные разработки и эксперименты','Язык','Открыть','Назад к проектам','Проект'],uk:['','Програмні рішення, AI-інтеграції та інтелектуальна автоматизація.','Проєкти','Вибрані розробки та експерименти','Мова','Переглянути','Назад до проєктів','Проєкт'],sr:['','Софтверска решења, AI интеграције и интелигентна аутоматизација.','Пројекти','Изабрани развоји и експерименти','Језик','Отвори','Назад на пројекте','Пројекат'],hr:['','Softverska rješenja, AI integracije i inteligentna automatizacija.','Projekti','Odabrani projekti i eksperimenti','Jezik','Otvori','Natrag na projekte','Projekt'],cs:['','Softwarová řešení, AI integrace a inteligentní automatizace.','Projekty','Vybrané realizace a experimenty','Jazyk','Otevřít','Zpět na projekty','Projekt'],sk:['','Softvérové riešenia, AI integrácie a inteligentná automatizácia.','Projekty','Vybrané realizácie a experimenty','Jazyk','Otvoriť','Späť na projekty','Projekt'],hu:['','Szoftvermegoldások, AI-integrációk és intelligens automatizálás.','Projektek','Válogatott fejlesztések és kísérletek','Nyelv','Megnyitás','Vissza a projektekhez','Projekt'],sv:['','Mjukvarulösningar, AI-integrationer och intelligent automatisering.','Projekt','Utvalda byggen och experiment','Språk','Utforska','Tillbaka till projekt','Projekt'],no:['','Programvareløsninger, AI-integrasjoner og intelligent automatisering.','Prosjekter','Utvalgte utviklinger og eksperimenter','Språk','Utforsk','Tilbake til prosjekter','Prosjekt'],da:['','Softwareløsninger, AI-integrationer og intelligent automatisering.','Projekter','Udvalgte udviklinger og eksperimenter','Sprog','Udforsk','Tilbage til projekter','Projekt'],fi:['','Ohjelmistoratkaisut, AI-integraatiot ja älykäs automaatio.','Projektit','Valitut toteutukset ja kokeilut','Kieli','Tutustu','Takaisin projekteihin','Projekti'],ar:['','حلول برمجية وتكاملات ذكاء اصطناعي وأتمتة ذكية.','المشاريع','تطويرات وتجارب مختارة','اللغة','استكشف','العودة إلى المشاريع','مشروع'],he:['','פתרונות תוכנה, שילובי AI ואוטומציה חכמה.','פרויקטים','פיתוחים וניסויים נבחרים','שפה','פתח','חזרה לפרויקטים','פרויקט'],'zh-CN':['','软件解决方案、AI 集成与智能自动化。','项目','精选开发与实验','语言','查看','返回项目','项目'],'zh-TW':['','軟體解決方案、AI 整合與智慧自動化。','專案','精選開發與實驗','語言','查看','返回專案','專案'],ja:['','ソフトウェアソリューション、AI統合、インテリジェント自動化。','プロジェクト','選択した開発と実験','言語','見る','プロジェクトへ戻る','プロジェクト'],ko:['','소프트웨어 솔루션, AI 통합 및 지능형 자동화.','프로젝트','선별된 개발 및 실험','언어','보기','프로젝트로 돌아가기','프로젝트'],hi:['','सॉफ्टवेयर समाधान, AI एकीकरण और बुद्धिमान स्वचालन।','प्रोजेक्ट्स','चयनित निर्माण और प्रयोग','भाषा','देखें','प्रोजेक्ट्स पर वापस','प्रोजेक्ट'],id:['','Solusi perangkat lunak, integrasi AI, dan otomatisasi cerdas.','Proyek','Pengembangan dan eksperimen pilihan','Bahasa','Jelajahi','Kembali ke proyek','Proyek'],vi:['','Giải pháp phần mềm, tích hợp AI và tự động hóa thông minh.','Dự án','Các sản phẩm và thử nghiệm tiêu biểu','Ngôn ngữ','Khám phá','Quay lại dự án','Dự án'],th:['','โซลูชันซอฟต์แวร์ การผสาน AI และระบบอัตโนมัติอัจฉริยะ','โครงการ','ผลงานและการทดลองที่คัดสรร','ภาษา','ดู','กลับไปยังโครงการ','โครงการ']};
const CAROUSEL_COPY={
bg:{apps:'Приложения',choose:'Избери приложение',open:'Отвори приложение'},
en:{apps:'Apps',choose:'Choose an app',open:'Open app'},
de:{apps:'Apps',choose:'App auswählen',open:'App öffnen'},
fr:{apps:'Applications',choose:'Choisir une application',open:'Ouvrir l’application'},
es:{apps:'Aplicaciones',choose:'Elige una aplicación',open:'Abrir aplicación'},
it:{apps:'Applicazioni',choose:'Scegli un’app',open:'Apri app'},
pt:{apps:'Aplicações',choose:'Escolha uma aplicação',open:'Abrir aplicação'},
nl:{apps:'Apps',choose:'Kies een app',open:'App openen'},
pl:{apps:'Aplikacje',choose:'Wybierz aplikację',open:'Otwórz aplikację'},
ro:{apps:'Aplicații',choose:'Alege o aplicație',open:'Deschide aplicația'},
el:{apps:'Εφαρμογές',choose:'Επίλεξε εφαρμογή',open:'Άνοιγμα εφαρμογής'},
tr:{apps:'Uygulamalar',choose:'Bir uygulama seç',open:'Uygulamayı aç'},
ru:{apps:'Приложения',choose:'Выберите приложение',open:'Открыть приложение'},
uk:{apps:'Застосунки',choose:'Виберіть застосунок',open:'Відкрити застосунок'},
sr:{apps:'Апликације',choose:'Изаберите апликацију',open:'Отвори апликацију'},
hr:{apps:'Aplikacije',choose:'Odaberite aplikaciju',open:'Otvori aplikaciju'},
cs:{apps:'Aplikace',choose:'Vyberte aplikaci',open:'Otevřít aplikaci'},
sk:{apps:'Aplikácie',choose:'Vyberte aplikáciu',open:'Otvoriť aplikáciu'},
hu:{apps:'Alkalmazások',choose:'Válassz alkalmazást',open:'Alkalmazás megnyitása'},
sv:{apps:'Appar',choose:'Välj en app',open:'Öppna app'},
no:{apps:'Apper',choose:'Velg en app',open:'Åpne app'},
da:{apps:'Apps',choose:'Vælg en app',open:'Åbn app'},
fi:{apps:'Sovellukset',choose:'Valitse sovellus',open:'Avaa sovellus'},
ar:{apps:'التطبيقات',choose:'اختر تطبيقًا',open:'فتح التطبيق'},
he:{apps:'אפליקציות',choose:'בחר אפליקציה',open:'פתח אפליקציה'},
'zh-CN':{apps:'应用',choose:'选择应用',open:'打开应用'},
'zh-TW':{apps:'應用程式',choose:'選擇應用程式',open:'開啟應用程式'},
ja:{apps:'アプリ',choose:'アプリを選択',open:'アプリを開く'},
ko:{apps:'앱',choose:'앱 선택',open:'앱 열기'},
hi:{apps:'ऐप्स',choose:'ऐप चुनें',open:'ऐप खोलें'},
id:{apps:'Aplikasi',choose:'Pilih aplikasi',open:'Buka aplikasi'},
vi:{apps:'Ứng dụng',choose:'Chọn ứng dụng',open:'Mở ứng dụng'},
th:{apps:'แอป',choose:'เลือกแอป',open:'เปิดแอป'}
};
const PROJECT_COPY={
'all-world-tv':{
bg:'Многоезичен каталог и интерфейс за телевизионни канали по държави.',
en:'A multilingual catalog and interface for television channels by country.',
de:'Mehrsprachiger Katalog und Oberfläche für Fernsehsender nach Ländern.',
fr:'Catalogue multilingue et interface pour les chaînes de télévision par pays.',
es:'Catálogo multilingüe e interfaz para canales de televisión por país.',
it:'Catalogo multilingue e interfaccia per canali televisivi per paese.',
pt:'Catálogo multilíngue e interface para canais de televisão por país.',
nl:'Meertalige catalogus en interface voor televisiezenders per land.',
pl:'Wielojęzyczny katalog i interfejs kanałów telewizyjnych według krajów.',
ro:'Catalog multilingv și interfață pentru canale TV pe țări.',
el:'Πολύγλωσσος κατάλογος και διεπαφή τηλεοπτικών καναλιών ανά χώρα.',
tr:'Ülkelere göre televizyon kanalları için çok dilli katalog ve arayüz.',
ru:'Многоязычный каталог и интерфейс телеканалов по странам.',
uk:'Багатомовний каталог та інтерфейс телеканалів за країнами.',
sr:'Вишејезични каталог и интерфејс ТВ канала по земљама.',
hr:'Višejezični katalog i sučelje TV kanala po državama.',
cs:'Vícejazyčný katalog a rozhraní televizních kanálů podle zemí.',
sk:'Viacjazyčný katalóg a rozhranie televíznych kanálov podľa krajín.',
hu:'Többnyelvű katalógus és felület országok szerinti TV-csatornákhoz.',
sv:'Flerspråkig katalog och gränssnitt för TV-kanaler per land.',
no:'Flerspråklig katalog og grensesnitt for TV-kanaler etter land.',
da:'Flersproget katalog og grænseflade til TV-kanaler efter land.',
fi:'Monikielinen luettelo ja käyttöliittymä TV-kanaville maittain.',
ar:'دليل متعدد اللغات وواجهة لقنوات التلفزيون حسب الدولة.',
he:'קטלוג רב-לשוני וממשק לערוצי טלוויזיה לפי מדינה.',
'zh-CN':'按国家分类的多语言电视频道目录和界面。',
'zh-TW':'依國家分類的多語言電視頻道目錄與介面。',
ja:'国別のテレビチャンネル向け多言語カタログとインターフェース。',
ko:'국가별 TV 채널을 위한 다국어 카탈로그와 인터페이스.',
hi:'देश के अनुसार टीवी चैनलों के लिए बहुभाषी कैटलॉग और इंटरफ़ेस।',
id:'Katalog multibahasa dan antarmuka saluran TV berdasarkan negara.',
vi:'Danh mục đa ngôn ngữ và giao diện kênh truyền hình theo quốc gia.',
th:'แคตตาล็อกหลายภาษาและอินเทอร์เฟซสำหรับช่องทีวีแยกตามประเทศ'
},
'all-world-cinema':{
bg:'Уеб приложение за откриване и достъп до аудиовизуално съдържание от публични външни каталози.',
en:'A web application for discovering and accessing audiovisual material referenced by public external catalogues.',
de:'Webanwendung zum Entdecken und Aufrufen audiovisueller Inhalte aus öffentlichen externen Katalogen.',
fr:'Application web pour découvrir et accéder à des contenus audiovisuels référencés par des catalogues publics externes.',
es:'Aplicación web para descubrir y acceder a material audiovisual referenciado por catálogos públicos externos.',
it:'Applicazione web per scoprire e accedere a contenuti audiovisivi indicizzati da cataloghi pubblici esterni.',
pt:'Aplicação web para descobrir e aceder a conteúdos audiovisuais referenciados por catálogos públicos externos.',
nl:'Webapp om audiovisueel materiaal uit openbare externe catalogi te ontdekken en te openen.',
pl:'Aplikacja internetowa do odkrywania i otwierania materiałów audiowizualnych z publicznych katalogów zewnętrznych.',
ro:'Aplicație web pentru descoperirea și accesarea materialelor audiovizuale din cataloage publice externe.',
el:'Διαδικτυακή εφαρμογή για ανακάλυψη και πρόσβαση σε οπτικοακουστικό υλικό από δημόσιους εξωτερικούς καταλόγους.',
tr:'Herkese açık harici kataloglardaki görsel-işitsel içerikleri keşfetmek ve erişmek için web uygulaması.',
ru:'Веб-приложение для поиска и доступа к аудиовизуальным материалам из публичных внешних каталогов.',
uk:'Вебзастосунок для пошуку та доступу до аудіовізуальних матеріалів із публічних зовнішніх каталогів.',
sr:'Веб апликација за откривање и приступ аудиовизуелном садржају из јавних спољних каталога.',
hr:'Web aplikacija za otkrivanje i pristup audiovizualnom sadržaju iz javnih vanjskih kataloga.',
cs:'Webová aplikace pro objevování a přístup k audiovizuálnímu obsahu z veřejných externích katalogů.',
sk:'Webová aplikácia na objavovanie a prístup k audiovizuálnemu obsahu z verejných externých katalógov.',
hu:'Webalkalmazás nyilvános külső katalógusok audiovizuális tartalmainak felfedezéséhez és eléréséhez.',
sv:'Webbapp för att upptäcka och komma åt audiovisuellt material från offentliga externa kataloger.',
no:'Nettapp for å oppdage og få tilgang til audiovisuelt materiale fra offentlige eksterne kataloger.',
da:'Webapp til at finde og få adgang til audiovisuelt materiale fra offentlige eksterne kataloger.',
fi:'Verkkosovellus julkisissa ulkoisissa luetteloissa viitattujen audiovisuaalisten aineistojen löytämiseen ja käyttöön.',
ar:'تطبيق ويب لاكتشاف والوصول إلى مواد سمعية بصرية من كتالوجات خارجية عامة.',
he:'אפליקציית ווב לגילוי וגישה לתוכן אורקולי מקטלוגים ציבוריים חיצוניים.',
'zh-CN':'用于发现和访问公共外部目录中视听内容的网页应用。',
'zh-TW':'用於探索與存取公共外部目錄中視聽內容的網頁應用。',
ja:'公開外部カタログに掲載された映像・音声コンテンツを見つけてアクセスするWebアプリ。',
ko:'공개 외부 카탈로그의 시청각 자료를 찾고 접근하는 웹 앱.',
hi:'सार्वजनिक बाहरी कैटलॉग में संदर्भित ऑडियो-विज़ुअल सामग्री खोजने और एक्सेस करने के लिए वेब ऐप।',
id:'Aplikasi web untuk menemukan dan mengakses materi audiovisual dari katalog eksternal publik.',
vi:'Ứng dụng web để khám phá và truy cập nội dung nghe nhìn từ các danh mục công khai bên ngoài.',
th:'เว็บแอปสำหรับค้นหาและเข้าถึงสื่อภาพและเสียงจากแคตตาล็อกภายนอกสาธารณะ'
},
'radio':{
bg:'Уеб каталог за интернет радиостанции и директни потоци.',
en:'A web catalog for internet radio stations and direct streams.',
de:'Webkatalog für Internetradiosender und Direktstreams.',
fr:'Catalogue web de radios Internet et de flux directs.',
es:'Catálogo web de emisoras de radio por Internet y transmisiones directas.',
it:'Catalogo web di stazioni radio Internet e flussi diretti.',
pt:'Catálogo web de estações de rádio na Internet e transmissões diretas.',
nl:'Webcatalogus voor internetradiostations en directe streams.',
pl:'Katalog internetowy stacji radiowych i bezpośrednich strumieni.',
ro:'Catalog web pentru posturi radio online și fluxuri directe.',
el:'Διαδικτυακός κατάλογος ραδιοφωνικών σταθμών και άμεσων ροών.',
tr:'İnternet radyo istasyonları ve doğrudan yayınlar için web kataloğu.',
ru:'Веб-каталог интернет-радиостанций и прямых потоков.',
uk:'Вебкаталог інтернет-радіостанцій і прямих потоків.',
sr:'Веб каталог интернет радио станица и директних токова.',
hr:'Web katalog internetskih radijskih postaja i izravnih streamova.',
cs:'Webový katalog internetových rádií a přímých streamů.',
sk:'Webový katalóg internetových rádií a priamych streamov.',
hu:'Webes katalóg internetes rádióállomásokhoz és közvetlen streamekhez.',
sv:'Webbkatalog för internetradiostationer och direktströmmar.',
no:'Nettkatalog for internettradiostasjoner og direktestrømmer.',
da:'Webkatalog til internetradiostationer og direkte streams.',
fi:'Verkkoluettelo internet-radioasemille ja suorille lähetyksille.',
ar:'دليل ويب لمحطات راديو الإنترنت والبث المباشر.',
he:'קטלוג ווב לתחנות רדיו אינטרנטיות ושידורים ישירים.',
'zh-CN':'互联网广播电台和直连流的网页目录。',
'zh-TW':'網路廣播電台與直接串流的網頁目錄。',
ja:'インターネットラジオ局と直接ストリームのWebカタログ。',
ko:'인터넷 라디오 방송국과 직접 스트림을 위한 웹 카탈로그.',
hi:'इंटरनेट रेडियो स्टेशनों और डायरेक्ट स्ट्रीम का वेब कैटलॉग।',
id:'Katalog web untuk stasiun radio internet dan streaming langsung.',
vi:'Danh mục web cho đài phát thanh Internet và luồng trực tiếp.',
th:'แคตตาล็อกเว็บสำหรับสถานีวิทยุอินเทอร์เน็ตและสตรีมโดยตรง'
},
'alpha-2':{
bg:'Изкуствен интелект – олекотен езиков модел.',
en:'Artificial intelligence – lightweight language model.',
de:'Künstliche Intelligenz – leichtgewichtiges Sprachmodell.',
fr:'Intelligence artificielle – modèle linguistique léger.',
es:'Inteligencia artificial – modelo de lenguaje ligero.',
it:'Intelligenza artificiale – modello linguistico leggero.',
pt:'Inteligência artificial – modelo de linguagem leve.',
nl:'Kunstmatige intelligentie – licht taalmodel.',
pl:'Sztuczna inteligencja – lekki model językowy.',
ro:'Inteligență artificială – model lingvistic ușor.',
el:'Τεχνητή νοημοσύνη – ελαφρύ γλωσσικό μοντέλο.',
tr:'Yapay zekâ – hafif dil modeli.',
ru:'Искусственный интеллект — облегчённая языковая модель.',
uk:'Штучний інтелект — полегшена мовна модель.',
sr:'Вештачка интелигенција – лагани језички модел.',
hr:'Umjetna inteligencija – lagani jezični model.',
cs:'Umělá inteligence – odlehčený jazykový model.',
sk:'Umelá inteligencia – ľahký jazykový model.',
hu:'Mesterséges intelligencia – könnyű nyelvi modell.',
sv:'Artificiell intelligens – lätt språkmodell.',
no:'Kunstig intelligens – lett språkmodell.',
da:'Kunstig intelligens – let sprogmodel.',
fi:'Tekoäly – kevyt kielimalli.',
ar:'ذكاء اصطناعي – نموذج لغوي خفيف.',
he:'בינה מלאכותית – מודל שפה קל.',
'zh-CN':'人工智能——轻量级语言模型。',
'zh-TW':'人工智慧——輕量級語言模型。',
ja:'人工知能 – 軽量言語モデル。',
ko:'인공지능 – 경량 언어 모델.',
hi:'कृत्रिम बुद्धिमत्ता – हल्का भाषा मॉडल।',
id:'Kecerdasan buatan – model bahasa ringan.',
vi:'Trí tuệ nhân tạo – mô hình ngôn ngữ nhẹ.',
th:'ปัญญาประดิษฐ์ – โมเดลภาษาขนาดเบา'
}
};
const PROJECTS={
'all-world-tv':{name:'All World IPTV',icon:'▣',bg:'Многоезичен каталог и интерфейс за телевизионни канали по държави.',en:'A multilingual catalog and interface for television channels by country.',tags:['TV','Streaming','Web'],app:'https://stankowspas.github.io/projects/all-world-tv/app/'},
'all-world-cinema':{name:'All-World Cinema',icon:'◫',bg:'Уеб приложение за откриване и достъп до аудиовизуално съдържание от публични външни каталози.',en:'A web application for discovering and accessing audiovisual material referenced by public external catalogues.',tags:['Cinema','Catalog','Web'],app:'https://stankowspas.github.io/projects/all-world-cinema/app/'},
'radio':{name:'SSGPT14 Radio',icon:'◉',bg:'Уеб каталог за интернет радиостанции и директни потоци.',en:'A web catalog for internet radio stations and direct streams.',tags:['Radio','Streaming','Catalog'],app:'https://stankowspas.github.io/projects/radio/'},
'alpha-2':{name:'Alpha Chat 2.0',icon:'α',bg:'Изкуствен интелект – олекотен езиков модел.',en:'Artificial intelligence – lightweight language model.',tags:['AI','Language Model','Lightweight'],repo:'https://github.com/stankowspas/Alpha-2',app:'https://stankowspas.github.io/Alpha-2/'}
};
const pathParts=location.pathname.split('/').filter(Boolean);const isProject=pathParts[0]==='projects';const queryLang=new URLSearchParams(location.search).get('lang');const pathLang=!isProject&&LANGS[pathParts[0]]?pathParts[0]:null;const code=queryLang&&LANGS[queryLang]?queryLang:(pathLang||localStorage.getItem('siteLang')||'en');const c=COPY[code]||COPY.en;localStorage.setItem('siteLang',code);document.documentElement.lang=code;document.documentElement.dir=['ar','he'].includes(code)?'rtl':'ltr';
function renderHome(){
 const eyebrow=document.querySelector('#eyebrow'),intro=document.querySelector('#intro');
 if(eyebrow){eyebrow.textContent='';eyebrow.style.display='none'} if(intro)intro.textContent=c[1];
 const panel=document.querySelector('.panel');if(panel)panel.remove();
 const hero=document.querySelector('.hero'),section=document.createElement('section');
 section.className='app-showcase fade-in';
 const cc=CAROUSEL_COPY[code]||CAROUSEL_COPY.en;section.innerHTML=`<div class="section-head carousel-heading"><div><div class="eyebrow">${cc.apps}</div><h2>${cc.choose}</h2></div><p>${Object.keys(PROJECTS).length}</p></div><div class="app-carousel" aria-label="${cc.apps}"><button class="carousel-arrow prev" type="button" aria-label="Previous">‹</button><div class="carousel-stage" id="carouselStage"></div><button class="carousel-arrow next" type="button" aria-label="Next">›</button></div><div class="carousel-dots" id="carouselDots"></div>`;
 hero.insertAdjacentElement('afterend',section);
 const stage=section.querySelector('#carouselStage'),dots=section.querySelector('#carouselDots'),entries=Object.entries(PROJECTS);
 let active=0,startX=0,dragging=false,moved=false;
 entries.forEach(([slug,p],i)=>{
  const desc=(PROJECT_COPY[slug]&&PROJECT_COPY[slug][code])||p.en,target=p.app||`/projects/${slug}/?lang=${encodeURIComponent(code)}`,card=document.createElement('a');
  card.className='carousel-card';card.dataset.index=i;card.href=target;card.innerHTML=`<div class="project-icon">${p.icon}</div><h3>${p.name}</h3><p>${desc}</p><span class="card-link">${cc.open} <span>→</span></span>`;
  card.addEventListener('click',e=>{if(moved){e.preventDefault();moved=false;return}if(i!==active){e.preventDefault();active=i;update()}});
  stage.appendChild(card);
  const dot=document.createElement('button');dot.type='button';dot.setAttribute('aria-label',p.name);dot.addEventListener('click',()=>{active=i;update()});dots.appendChild(dot);
 });
 const cards=[...stage.children],dotEls=[...dots.children];
 function update(){
  cards.forEach((card,i)=>{
   let d=i-active;if(d>entries.length/2)d-=entries.length;if(d<-entries.length/2)d+=entries.length;
   card.style.setProperty('--offset',d);card.classList.toggle('active',d===0);card.classList.toggle('far',Math.abs(d)>1);
   card.setAttribute('aria-current',d===0?'true':'false');
  });dotEls.forEach((d,i)=>d.classList.toggle('active',i===active));
 }
 const go=n=>{active=(active+n+entries.length)%entries.length;update()};
 section.querySelector('.prev').addEventListener('click',()=>go(-1));section.querySelector('.next').addEventListener('click',()=>go(1));
 stage.addEventListener('pointerdown',e=>{dragging=true;moved=false;startX=e.clientX});
 stage.addEventListener('pointermove',e=>{if(dragging&&Math.abs(e.clientX-startX)>12)moved=true});
 stage.addEventListener('pointerup',e=>{if(!dragging)return;const dx=e.clientX-startX;dragging=false;if(Math.abs(dx)>45)go(dx<0?1:-1)});
 stage.addEventListener('wheel',e=>{if(Math.abs(e.deltaX)>Math.abs(e.deltaY)||Math.abs(e.deltaY)>20){e.preventDefault();go((e.deltaX||e.deltaY)>0?1:-1)}},{passive:false});
 document.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')go(-1);if(e.key==='ArrowRight')go(1)});
 update();
}
function renderProject(){const slug=pathParts[1];const p=PROJECTS[slug];const hero=document.querySelector('.hero');if(!p){hero.innerHTML='<h1>Project</h1><p>Not found.</p>';return}document.title=p.name+' · Spas Stankov';const desc=code==='bg'?p.bg:p.en;hero.innerHTML=`<a class="back" href="/${code}/">← ${c[6]}</a><div class="project-view glass fade-in"><div class="eyebrow">${c[7]}</div><h2>${p.name}</h2><p>${desc}</p><div class="project-meta">${p.tags.map(t=>`<span class="chip">${t}</span>`).join('')}</div>${slug==='all-world-tv'?`<div class="embedded-demo"><div class="embedded-demo-bar"><span>Live demo</span><button class="demo-fullscreen" type="button" title="Full screen">⛶</button></div><iframe id="tvDemo" src="/projects/all-world-tv/app/?lang=${encodeURIComponent(code)}&v=3" title="All-World TV interactive demo" allow="autoplay; fullscreen" allowfullscreen></iframe></div>`:''}<div class="action-row">${p.app?`<a class="btn" href="${p.app}" target="_blank" rel="noopener">Open ${p.name} ↗</a>`:''}${p.repo?`<a class="btn" href="${p.repo}" target="_blank" rel="noopener">GitHub ↗</a>`:''}<a class="btn" href="/${code}/">${c[6]}</a></div></div>`;if(slug==='all-world-tv'){const frame=document.querySelector('#tvDemo');const fs=document.querySelector('.demo-fullscreen');if(fs&&frame)fs.addEventListener('click',()=>{if(frame.requestFullscreen)frame.requestFullscreen()})}}
if(isProject)renderProject();else renderHome();
const CONTACT_COPY={
bg:{button:'Контакт',title:'Свържете се с мен',subtitle:'Изпратете съобщение директно през формата.',name:'Име',email:'Вашият email',subject:'Тема',message:'Съобщение',send:'Изпрати съобщение',sending:'Изпращане…',success:'Съобщението е изпратено успешно.',error:'Неуспешно изпращане. Опитайте отново.',pending:'Формата очаква активиране на защитения канал за изпращане.'},
en:{button:'Contact',title:'Contact me',subtitle:'Send a message directly through the form.',name:'Name',email:'Your email',subject:'Subject',message:'Message',send:'Send message',sending:'Sending…',success:'Message sent successfully.',error:'Sending failed. Please try again.',pending:'The form is awaiting activation of the secure delivery channel.'}
};
function setupContact(){
 const t=CONTACT_COPY[code]||CONTACT_COPY.en;const footer=document.querySelector('footer');if(!footer)return;
 const link=document.createElement('button');link.type='button';link.className='footer-contact';link.textContent=t.button;footer.appendChild(document.createTextNode(' · '));footer.appendChild(link);
 const modal=document.createElement('div');modal.className='contact-modal';modal.setAttribute('aria-hidden','true');
 modal.innerHTML=`<div class="contact-backdrop"></div><section class="contact-dialog glass" role="dialog" aria-modal="true" aria-labelledby="contactTitle"><button class="contact-close" type="button" aria-label="Close">×</button><div class="eyebrow">${t.button}</div><h2 id="contactTitle">${t.title}</h2><p class="contact-subtitle">${t.subtitle}</p><form id="contactForm"><div class="contact-grid"><label><span>${t.name}</span><input name="name" autocomplete="name" required></label><label><span>${t.email}</span><input name="email" type="email" autocomplete="email" required></label></div><label><span>${t.subject}</span><input name="subject" required></label><label><span>${t.message}</span><textarea name="message" rows="6" required></textarea></label><input class="contact-hp" name="_gotcha" tabindex="-1" autocomplete="off"><button class="contact-send" type="submit">${t.send}</button><div class="contact-status" aria-live="polite"></div></form></section>`;
 document.body.appendChild(modal);
 const close=()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open')};
 const open=()=>{modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');setTimeout(()=>modal.querySelector('input')?.focus(),180)};
 link.addEventListener('click',open);modal.querySelector('.contact-close').addEventListener('click',close);modal.querySelector('.contact-backdrop').addEventListener('click',close);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))close()});
 modal.querySelector('#contactForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const form=e.currentTarget,status=modal.querySelector('.contact-status'),button=modal.querySelector('.contact-send');
  if(form._gotcha&&form._gotcha.value)return;
  const payload=Object.fromEntries(new FormData(form).entries());
  payload._subject='Portfolio contact · '+(payload.subject||'Message');
  payload._template='table';
  payload._url=location.href;
  button.disabled=true;button.textContent=t.sending;status.textContent='';
  try{
    const target=['s.stankow','protonmail.com'].join('@');
    const r=await fetch('https://formsubmit.co/ajax/'+encodeURIComponent(target),{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify(payload)
    });
    const data=await r.json().catch(()=>({}));
    if(r.ok&&data.success!==false){
      form.reset();status.textContent=t.success;status.className='contact-status success';
    }else{
      status.textContent=(data.message||t.error);status.className='contact-status error';
    }
  }catch(err){
    status.textContent=t.error;status.className='contact-status error';
  }finally{
    button.disabled=false;button.textContent=t.send;
  }
});
}
setupContact();
