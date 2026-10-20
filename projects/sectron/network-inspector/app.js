'use strict';
const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
const icon=(id)=>`<svg width="20" height="20" aria-hidden="true"><use href="#i-${id}"></use></svg>`;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtTime=x=>x?new Date(x).toLocaleString('bg-BG'):'—';
const demoData=()=>({scan:{id:'SAMPLE',cidr:'192.168.10.0/24',started:new Date().toISOString(),completed:new Date().toISOString(),warnings:['DEMO: примерните устройства не са открити чрез мрежово сканиране.','Доказателства за физически портови връзки липсват.'],devices:[
  ['192.168.10.1','Gateway / Router',[80,443],1.2],['192.168.10.2','Core Switch',[80,443,22],1.5],['192.168.10.10','Office-PC-01',[445,3389],2.4],['192.168.10.11','Office-PC-02',[445],2.6],['192.168.10.20','NAS Storage',[80,443],2.0],['192.168.10.30','Camera Entrance',[80],4.5],['192.168.10.31','Camera Parking',[80],5.7],['192.168.10.40','Wi-Fi AP Lobby',[80,443],2.9],['192.168.10.45','Printer-Laser',[80],2.0]
].map(([ip,name,ports,rtt])=>({id:ip,ip,name,mac:null,ping:true,rttMs:rtt,openPorts:ports,source:'DEMO',at:new Date().toISOString()}))},wifi:{at:new Date().toISOString(),warnings:['DEMO: примерни безжични мрежи, не са измерени.'],networks:[
 {ssid:'Office-Secure',bssid:'00:11:22:33:44:55',rssiDbm:-48,signalPercent:82,channel:36,frequencyBand:'5 GHz',interface:'Wi-Fi adapter'},
 {ssid:'Office-Guest',bssid:'00:11:22:33:44:66',rssiDbm:-67,signalPercent:60,channel:6,frequencyBand:'2.4 GHz',interface:'Wi-Fi adapter'},
 {ssid:'Meeting-Room',bssid:'00:11:22:33:44:77',rssiDbm:-72,signalPercent:47,channel:44,frequencyBand:'5 GHz',interface:'Wi-Fi adapter'},
 {ssid:'Neighbor-WLAN',bssid:'00:11:22:33:44:88',rssiDbm:-85,signalPercent:19,channel:11,frequencyBand:'2.4 GHz',interface:'Wi-Fi adapter'}]},tests:[
 {id:'d1',type:'PING',target:'192.168.10.1',status:'PASS',at:new Date().toISOString(),summary:'DEMO · RTT 1.2 ms · loss 0%'},
 {id:'d2',type:'TCP',target:'192.168.10.20:443',status:'PASS',at:new Date().toISOString(),summary:'DEMO · connected'},
 {id:'d3',type:'DNS',target:'example.org',status:'PASS',at:new Date().toISOString(),summary:'DEMO · name resolution'}]});
const loadTheme=()=>{try{return localStorage.getItem('netpro-theme')||'dark'}catch{return 'dark'}};
const savedAgentToken=()=>{try{return sessionStorage.getItem('netpro-agent-token')||localStorage.getItem('ni-v2-agent-token')}catch{return null}};
const state={view:'dashboard',connected:false,agentAvailable:false,token:savedAgentToken(),snapshot:{scan:null,wifi:null,tests:[]},adapters:[],demo:false,theme:loadTheme(),selectedDevice:null,ethernetAdapters:[],ethernetJob:null,ethernetDestination:'172.17.206.14',activeTest:'ping',snmpTarget:'192.168.1.1',lastSnmp:null,topologyEvidence:null,profileTarget:'127.0.0.1',profilePort:443,profileUrl:'',lastProfile:null,lastMonitor:null,monitorTarget:'127.0.0.1',monitorCount:6,monitorInterval:1000,monitorLoss:1,monitorRtt:100,busy:false,scanCidr:'',autoScopes:null,lastTest:null,scale:1,selectedCidrs:[],selectionTouched:false};
const titles={dashboard:'Преглед на мрежата',scanner:'Мрежово сканиране',tests:'Център за тестове',topology:'Мрежова топология',wifi:'Wi-Fi анализатор',reports:'Технически отчети',toolkit:'Windows Network Toolkit',settings:'Настройки и агент'};
let controller=null;
function toast(msg,error=false){const node=document.createElement('div');node.className='toast'+(error?' error':'');node.textContent=msg;$('#toasts').append(node);setTimeout(()=>node.remove(),5000)}
function setBusy(b){state.busy=b;render()}
// PWA v2: localhost agent is independent of the HTTPS-hosted interface.
const AGENT_ORIGIN='http://127.0.0.1:5188';
function agentApi(path){return AGENT_ORIGIN+path;}
async function api(path,method='GET',payload){
  const url=agentApi('/api'+path);
  const headers={'Accept':'application/json'};
  if(path!=='/status' && path!=='/pair' && state.token)headers['X-Agent-Token']=state.token;
  if(method!=='GET')headers['Content-Type']='application/json';
  const res=await fetch(url,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload),signal:controller?.signal,cache:'no-store'});
  const type=res.headers.get('content-type')||'';
  const data=type.includes('json')?await res.json():await res.text();
  if(!res.ok)throw new Error(data?.error||`HTTP ${res.status}`);
  return data;
}
async function checkAgent(){
  if(state.demo)return;
  try{
    const status=await api('/status');
    if(!String(status?.version||'').startsWith('2.')){
      state.agentAvailable=false;state.connected=false;
      toast('????? ? Network Agent v2. ?????? ?????? ????? ? ??????????? Start_Agent.bat ?? ?????? 2.',true);
      render();return;
    }
    state.agentAvailable=true;
    if(!state.token){state.connected=false;render();return;}
    const coreRequests=Promise.all([api('/adapters'),api('/snapshot'),api('/topology'),api('/scan/scopes')]);
    const [[adapters,snapshot,topology,autoScopes],[localComputer,infrastructure,universalInventory,infrastructureFrontier]]=await Promise.all([coreRequests,Promise.all([api("/local-computer"),api("/infrastructure").catch(()=>null),api("/discovery/universal").catch(()=>null),api("/discovery/frontier").catch(()=>null)])]);state.localComputer=localComputer;state.adapters=adapters;state.snapshot=snapshot;state.topologyEvidence=topology;state.autoScopes=autoScopes;state.infrastructure=infrastructure;state.universalInventory=universalInventory;state.infrastructureFrontier=infrastructureFrontier;state.connected=true;
    const selectableCidrs=new Set(autoScopes.scopes.filter(s=>s.selectable).map(s=>s.cidr));
    if(!state.selectionTouched)state.selectedCidrs=autoScopes.scopes.filter(s=>s.source==='adapter'&&s.selectable).map(s=>s.cidr);
    else state.selectedCidrs=state.selectedCidrs.filter(c=>selectableCidrs.has(c));
    if(autoScopes.scopes?.length && !state.userCidr)state.scanCidr=autoScopes.scopes[0].cidr;
  }catch(e){
    state.connected=false;
    if(String(e.message).includes('401')||String(e.message).includes('Pair with')){
      state.token=null;try{sessionStorage.removeItem('netpro-agent-token');localStorage.removeItem('ni-v2-agent-token')}catch{}
    }else state.agentAvailable=false;
  }
  render();
}
async function pairAgent(){
  if(state.demo){toast('Излез от демонстрационния режим преди сдвояване.',true);return;}
  const code=$('#pair-code')?.value.trim()||'';
  if(!/^[A-Fa-f0-9-]{16,19}$/.test(code)){toast('Въведи 16-символния код от прозореца на агента.',true);return;}
  const result=await api('/pair','POST',{code});
  if(!/^[A-F0-9]{64}$/.test(result.token||''))throw new Error('Невалиден отговор при сдвояване.');
  state.token=result.token;
  try{sessionStorage.setItem('netpro-agent-token',state.token);localStorage.setItem('ni-v2-agent-token',state.token)}catch{}
  await checkAgent();
  toast(state.connected?'Агентът е сдвоен успешно.':'Агентът не можа да се свърже.',!state.connected);
}
function demoEvidence(){return {generatedAt:new Date().toISOString(),nodes:[
{id:'device:192.168.10.2',label:'DEMO Core Switch',ip:'192.168.10.2',kind:'INSPECTED',chassisId:'DEMO-CHASSIS-CORE'},
{id:'neighbor:192.168.10.2:1',label:'DEMO Access Switch',ip:null,kind:'ADVERTISED_NEIGHBOR',chassisId:'DEMO-CHASSIS-ACCESS'}],
edges:[{id:'demo-edge',sourceId:'device:192.168.10.2',targetId:'neighbor:192.168.10.2:1',sourceIp:'192.168.10.2',localPortIndex:'12',remotePortId:'Gi1/0/24',remoteName:'DEMO Access Switch',remoteChassisId:'DEMO-CHASSIS-ACCESS',confidence:'ADVERTISED',evidence:'DEMO simulated LLDP observation — not measured',observedAt:new Date().toISOString()}],
warnings:['DEMO: всички данни са примерни. Няма измерена физическа връзка.']}}
function setDemo(v){state.demo=v;state.selectedDevice=null;if(v){state.snapshot=demoData();state.topologyEvidence=demoEvidence();state.autoScopes=null;state.connected=false;}else{state.snapshot={scan:null,wifi:null,tests:[]};state.topologyEvidence=null;checkAgent()}render();toast(v?'Демонстрационен режим — всички стойности са примерни.':'Демонстрационните данни са изключени.')}
function nav(view){if(!state.connected && view!=='settings' && view!=='dashboard'){state.view='settings';render();toast('За работа с диагностиките първо стартирайте и сдвоете Network Agent v2.',true);return;}state.view=view;if(view==='toolkit'&&state.connected&&!state.toolkitCatalog){api('/toolkit/catalog').then(v=>{state.toolkitCatalog=v;state.toolkitSelected=v[0]?.id;render()}).catch(e=>toast(e.message,true));}$('.sidebar').classList.remove('open');render();}
function renderLocalComputer(){
 const info=state.connected&&!state.demo?state.localComputer:null;
 const items=info?.adapters||[];
 const getIPv4=a=>a?(Object.entries(a).find(([key,value])=>key.toLowerCase()==='ipv4'&&Array.isArray(value))?.[1]||[]):[];
 const eligible=items.filter(a=>a.status==='Up'&&getIPv4(a).length&&a.mac&&a.mac!=='00:00:00:00:00:00'&&!/filter|scheduler|virtual wifi|kernel debugger/i.test(a.name||''));
 const main=eligible.find(a=>(a.gateway||[]).length)||eligible[0];
 const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value||'—'};
 set('local-name',info?.name||'—');
 set('local-ip',getIPv4(main)[0]?.split('/')[0]||'-');
 set('local-mac',main?.mac||'—');
 set('local-link',info?(main?main.name+(main.speedMbps?' \u00b7 '+main.speedMbps+' Mbps':''):'\u041d\u044f\u043c\u0430\u0020\u0430\u043a\u0442\u0438\u0432\u0435\u043d\u0020\u0049\u0050\u0076\u0034\u0020\u0430\u0434\u0430\u043f\u0442\u0435\u0440'):'\u041d\u044f\u043c\u0430\u0020\u0432\u0440\u044a\u0437\u043a\u0430\u0020\u0441\u0020\u0430\u0433\u0435\u043d\u0442\u0430');
}
function updateLayout(){renderLocalComputer();document.body.classList.toggle('theme-light',state.theme==='light');$('#page-title').textContent=titles[state.view];$('#breadcrumb').textContent=state.demo?'DEMONSTRATION · НЕ СА РЕАЛНИ ДАННИ':'NETWORK CONTROL CENTER';
  $$('.nav-button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));
  $('#agent-led').className='led '+(state.connected?'online':'offline');
  $('#agent-label').textContent=state.demo?'Демо режим':state.connected?'Агентът е свързан':state.agentAvailable?'Очаква сдвояване':'Агентът не е стартиран';
  $('#agent-detail').textContent=state.demo?'Примерни, не измерени данни':state.connected?'127.0.0.1:5188 · online':state.agentAvailable?'Настройки → Въведи код':'Стартирай Start_Agent.bat';
  $('#footer-message').textContent=state.demo?'DEMO · НЕ СА РЕАЛНИ ИЗМЕРВАНИЯ':state.connected?'Локален Network Engine · онлайн':state.agentAvailable?'Сдвои агента чрез код от конзолата':'PWA интерфейс · очаква Windows агент';}
function btn(text,action='none',css=''){return `<button class="button ${css}" data-action="${action}">${text}</button>`;}
function section(title,sub='',actions=''){return `<div class="section-heading"><div><h2>${title}</h2>${sub?`<div class="subtitle">${sub}</div>`:''}</div><div class="card-actions">${actions}</div></div>`}
function unavailable(){return state.demo?`<div class="notice warn">Демонстрационен режим: действията не изпълняват реални мрежови тестове.</div>`:!state.connected?`<div class="notice warn">Локалният агент не е свързан. За реално сканиране стартирай Windows Start_Agent.bat. Можеш да разгледаш интерфейса с „Демо данни“.</div>`:''}
const count=()=>state.snapshot.scan?.devices?.length||0;
function dashboard(){const s=state.snapshot,ds=s.scan?.devices||[],wf=s.wifi?.networks||[],tests=s.tests||[];
return `${state.demo?'<div class="notice warn gap-bottom">Демонстрация на дизайна: няма реално извършени измервания.</div>':(!state.connected?`<div class="callout-banner"><div><strong>Готов за свързване с Windows Network Agent</strong><p>Изтегли и стартирай портативния компонент, за да използваш мрежовите инструменти.</p></div>${btn(`${icon('settings')} Настройки на агента`,'settings','primary')}</div>`:'')}
<div class="grid kpi-grid">
${kpi('Открити устройства',count(),'monitor',s.scan?'Последно сканиране: '+fmtTime(s.scan.completed):'Няма проведено сканиране')}
${kpi('Wi-Fi мрежи',wf.length,'wifi',s.wifi?'RSSI / канали / BSSID':'Не е извършено Wi-Fi сканиране')}
${kpi('Диагностични тестове',tests.length,'pulse',tests.length?'Отчетени в текущата сесия':'Няма проведени тестове')}
${kpi('IP обхват',s.scan?.cidr||'—','globe','LAN / MAN / WAN')}
</div>
<div class="grid two-columns gap-bottom"><section class="card">${section('Мрежова карта',s.scan?`Логически изглед · ${ds.length} устройства`:'Топологията ще се покаже след сканиране',btn('Отвори ↗','topology','small ghost'))}${topologySvg(false)}<div class="legend"><span><i class="legend-line"></i>Логическа принадлежност към подмрежа</span><span>Физическите връзки не са доказани</span></div></section>
<section class="card">${section('Бързи действия','Най-използваните инструменти')}<div class="flex-col">
${actionRow('search','Сканиране на LAN','Устройства, адреси, услуги','scanner')}
${actionRow('pulse','Проверка на връзка','Ping, TCP, DNS, HTTP, Trace','tests')}
${actionRow('wifi','Wi-Fi анализ','Сигнал, канали, BSSID','wifi')}
${actionRow('file','Генериране на отчет','XLSX, DRAWIO, SVG, JSON','reports')}
</div></section></div>
<section class="card">${section('Последно открити устройства','Актуални записи от последното сканиране',btn('Всички устройства ↗','scanner','small ghost'))}${devicesTable(ds.slice(0,7))}</section>`;}
function kpi(label,value,ic,footer){return `<div class="card kpi"><div class="kpi-top"><span>${esc(label)}</span><span class="kpi-icon">${icon(ic)}</span></div><div class="kpi-number">${esc(value)}</div><div class="kpi-foot">${esc(footer)}</div></div>`}
function actionRow(ic,title,sub,to){return `<button class="action-tile" data-nav="${to}">${icon(ic)}<span><strong>${title}</strong><small>${sub}</small></span><span style="margin-left:auto;color:#8bbfff">→</span></button>`}
function devicesTable(ds){if(!ds?.length)return `<div class="empty">${icon('monitor')}Няма открити устройства.<br>Изпълни сканиране на разрешен IP обхват.</div>`;
return `<div class="table-wrap"><table><thead><tr><th>УСТРОЙСТВО</th><th>IP АДРЕС</th><th>MAC АДРЕС</th><th>ICMP</th><th>RTT</th><th>ОТВОРЕНИ TCP ПОРТОВЕ</th><th>ИЗТОЧНИК</th></tr></thead><tbody>${ds.map(d=>`<tr data-device="${esc(d.id)}"><td class="table-name">${esc(d.name||'Неидентифицирано')}</td><td class="mono">${esc(d.ip)}</td><td class="mono">${esc(d.mac||'—')}</td><td>${d.ping?'<span class="pill good">ОТГОВАРЯ</span>':'<span class="pill warn">БЛОКИРАН / НЕИЗВЕСТЕН</span>'}</td><td>${d.rttMs===null?'—':esc(d.rttMs)+' ms'}</td><td class="mono">${esc((d.openPorts||[]).join(', ')||'—')}</td><td>${esc(d.source)}</td></tr>`).join('')}</tbody></table></div>`}
function scanner(){const ds=state.snapshot.scan?.devices||[],discovery=state.autoScopes||{scopes:[],warnings:[],totalHosts:0};
const scopePreview=`<div class="notice" style="margin-top:15px"><strong>Открити мрежи: ${discovery.scopes.length} · до ${discovery.totalHosts} адреса в избираеми обхвати</strong>
<div style="margin:10px 0">${discovery.scopes.length?discovery.scopes.map(s=>`<label style="display:flex;align-items:start;gap:10px;margin:7px 0;line-height:1.5"><input type="checkbox" class="scope-choice" value="${esc(s.cidr)}" ${!s.selectable?'disabled':''} ${state.selectedCidrs.includes(s.cidr)&&s.selectable?'checked':''} style="margin-top:4px"><span><strong class="mono">${esc(s.cidr)}</strong> · ${esc(s.source==='route'?'Маршрут Windows':s.source==='snmp'?'SNMP маршрутизатор':'Локален адаптер')} · ${esc(s.adapter)} ${s.via?' · през '+esc(s.via):''} ${s.limitedTo24?' · ограничено до /24':''}${!s.selectable?' · голям обхват: избери конкретен /24 ръчно':''}</span></label>`).join(''):'Няма открити обхвати'}</div>
<small>${(discovery.warnings||[]).map(esc).join(' · ')}</small>
<details style="margin-top:14px"><summary>Допълнително откриване през SNMP маршрутизатор (по желание)</summary>
<div class="form-grid" style="margin-top:10px"><div class="field"><label for="route-host">IPv4 на маршрутизатор</label><input id="route-host" class="input mono" placeholder="172.17.206.1"></div>
<div class="field"><label for="route-community">SNMPv2c community</label><input id="route-community" class="input" type="password" autocomplete="off"></div>
<div class="field"><label for="route-port">UDP порт</label><input id="route-port" class="input" type="number" min="1" max="65535" value="161"></div></div>
<div class="checks" style="margin:10px 0"><input id="route-authorized" type="checkbox"><label for="route-authorized">Имам разрешение за SNMP справка на този маршрутизатор.</label></div>
${btn('Прочети маршрути чрез SNMP','routes-snmp','small ghost')}
<p class="note">Само четене. Поддържа legacy ipRouteTable, ако устройството я предоставя. Резултатите са временни (15 минути).</p></details></div>`;

return `<div class="view-header"><h2>Откриване на LAN / MAN / WAN устройства</h2><p>Активно ICMP откриване с ограничени TCP проверки в избран IPv4 обхват. Връзките по портове не се извеждат автоматично.</p></div>${unavailable()}
<section class="card gap-bottom">${section('Ново сканиране','Изисква мрежов достъп и разрешение за проверявания адресен обхват')}
<div class="form-grid"><div class="field"><label for="cidr">Ръчен IPv4 обхват (CIDR)</label><input id="cidr" class="input mono" value="${esc(state.scanCidr)}" placeholder="172.17.206.0/24"/></div><div class="field"><label for="timeout">Timeout / устройство</label><select class="input" id="timeout"><option value="400">400 ms</option><option value="600" selected>600 ms</option><option value="1200">1200 ms</option></select></div><div class="field"><label>Метод</label><div class="input">ICMP + TCP fallback</div></div></div>
${scopePreview}<div style="margin:18px 0 15px" class="checks"><input type="checkbox" id="authorized"><label for="authorized">Потвърждавам, че имам разрешение за избрания ръчен CIDR или за ВСИЧКИ маркирани обхвати при автоматично сканиране.</label></div>
<div class="toolbar-row"><div class="card-actions">${btn(`${icon('play')} Сканирай избраните мрежи`,'scan-auto','primary')}${btn('Сканирай един CIDR','scan','ghost')}${state.busy?btn('Прекрати','abort','ghost'):''}</div><small class="muted">До 16 избрани обхвата /24–/32 · последователно · 12 едновременни хоста · Без ICMP отговор ≠ изключено устройство</small></div>${state.busy?'<div class="progress" style="margin-top:15px"></div>':''}</section>
<section class="card">${section(`Устройства (${ds.length})`,state.snapshot.scan?'Последно сканиране: '+fmtTime(state.snapshot.scan.completed):'Очакват се резултати',btn(`${icon('download')} XLSX`,'xlsx','small'))}${state.snapshot.scan?.scannedRanges?.length?`<p class="note">Проверени CIDR: ${state.snapshot.scan.scannedRanges.map(esc).join(' · ')}</p>`:''}${devicesTable(ds)}${state.snapshot.scan?.warnings?.length?`<p class="note">${state.snapshot.scan.warnings.map(esc).join(' · ')}</p>`:''}</section>`;}
function speedtestPanel(){
 const v=state.lastSpeedtest, running=!!state.speedtestRunning;
 const fmt=n=>Number.isFinite(n)?n.toFixed(1):'—';
 const values=v&&!running?'<div class="toolbar-row"><strong>↓ '+fmt(v.downloadMbps)+' Mbps</strong><strong>↑ '+fmt(v.uploadMbps)+' Mbps</strong><strong>Latency '+fmt(v.latencyMs)+' ms</strong></div>':'';
 const runningUi=running?'<span class="speed-live"><span class="speed-wheel"></span> Измерване…</span><div class="speed-progress"><span></span></div>':'';
 const start=running?'':btn('▶ START SPEEDTEST','speedtest-start','small');
 return '<section class="card gap-bottom speedtest-card">'+section('SPEEDTEST · Интернет скорост','Cloudflare · приблизително измерване')+'<p class="note">Download 5 MB · Upload 2 MB · Latency. Измерването започва само ръчно.</p><div class="toolbar-row">'+start+runningUi+'</div>'+values+'<p class="note">'+(running?'Анимацията показва изпълнение; не симулира скорост.':'Резултатите не показват максималния капацитет.')+'</p></section>';
}
async function runSpeedtest(){
 if(!state.connected){toast('Свържи агента преди Speedtest.',true);return;}
 state.speedtestRunning=true;state.lastSpeedtest=null;setBusy(true);
 try{state.lastSpeedtest=await api('/speedtest','POST',{});toast('Speedtest завърши.');}
 finally{state.speedtestRunning=false;setBusy(false);}
}
let ethernetTimer=null;
async function ethernetRefresh(){
 try {state.ethernetJob=await api('/ethernet-test');if(state.activeTest==='ethernet'&&state.view==='tests')render();
  if(state.ethernetJob&&state.ethernetJob.status!=='RUNNING'){if(ethernetTimer)clearInterval(ethernetTimer);ethernetTimer=null;state.snapshot.tests=(await api('/snapshot')).tests;}
 }catch(e){if(ethernetTimer)clearInterval(ethernetTimer);ethernetTimer=null;}
}
async function ethernetSetup(){
 try{state.ethernetAdapters=await api('/ethernet-test/adapters');await ethernetRefresh();if(state.ethernetJob?.status==='RUNNING')ethernetWatch();}
 catch(e){toast(e.message,true);}
 render();
}
function ethernetWatch(){if(ethernetTimer)clearInterval(ethernetTimer);ethernetTimer=setInterval(ethernetRefresh,1000);}
async function ethernetStart(){
 if(!state.connected||state.demo){toast('Local Network Engine required',true);return;}
 const id=document.querySelector('#ethernet-adapter')?.value;if(!id){toast('Select Ethernet adapter',true);return;}
 const destination=document.querySelector('#ethernet-destination')?.value.trim();if(!destination){toast('Enter a destination IP or hostname',true);return;}state.ethernetDestination=destination;
 try{state.ethernetJob=await api('/ethernet-test','POST',{adapterId:id,destination});render();ethernetWatch();}catch(e){toast(e.message,true);}
}
function ethernetPanel(){
 const j=state.ethernetJob,ss=j?.samples||[],first=ss[0],last=ss[ss.length-1];
 const delta=k=>first&&last?Math.max(0,last[k]-first[k]):0;
 const opts=(state.ethernetAdapters||[]).map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name+' ? '+a.description+' ('+a.status+')')+'</option>').join('');
 const bar=j?'<div style="height:8px;background:#263c58;border-radius:8px;overflow:hidden;margin:12px 0"><div style="background:#459579;height:100%;width:'+Math.min(100,j.elapsed/60*100)+'%"></div></div>':'';
 const colored=ss.map(s=>'<span title="Second '+s.second+': '+esc(s.link)+'" style="height:20px;flex:1;background:'+(s.link==='Up'?'#459579':'#d97746')+'"></span>').join('');
 return '<div class="notice">60-second software Ethernet monitoring. No cable certification or TDR.</div>'+
 '<div class="form-grid"><div class="field"><label for="ethernet-adapter">&#1050;&#1072;&#1073;&#1077;&#1083;&#1077;&#1085; &#1084;&#1088;&#1077;&#1078;&#1086;&#1074; &#1072;&#1076;&#1072;&#1087;&#1090;&#1077;&#1088;</label>'+(state.ethernetAdapters?.length===1?'<p class="note">'+esc(state.ethernetAdapters[0].name+' ? '+state.ethernetAdapters[0].description)+'</p><input type="hidden" id="ethernet-adapter" value="'+esc(state.ethernetAdapters[0].id)+'" />':state.ethernetAdapters?.length>1?'<select id="ethernet-adapter" class="input">'+opts+'</select>':'<p class="note">???? ?????? ??????? ??????? ???????.</p>')+'</div><div class="field"><label for="ethernet-destination">Destination IP / hostname</label><input id="ethernet-destination" class="input mono" value="'+esc(state.ethernetDestination||'')+'" placeholder="172.17.206.14" /></div></div>'+
 (j?'<section class="profile-result" style="margin-top:12px"><strong>'+esc(j.adapter)+'</strong> ? <span class="pill '+(j.status==='PASS'?'good':j.status==='FAIL'?'warn':'off')+'">'+esc(j.status)+'</span><p>'+j.elapsed+'/60 sec ? '+ss.length+' samples</p>'+bar+
 '<div class="grid kpi-grid">'+kpi('Link',last?.link||'-','pulse','Current sample')+kpi('Speed',(last?.mbps??'-')+' Mbps','pulse','Current rate')+kpi('New errors',delta('rxErrors')+delta('txErrors'),'pulse','RX + TX')+kpi('Drops',delta('rxDropped')+delta('txDropped'),'pulse','RX + TX')+'</div>'+
 '<div class="notice" style="margin-top:12px"><strong>ICMP: '+esc(j.destination||'-')+'</strong> · '+esc(j.destinationStatus||'RUNNING')+' · '+(j.pings||[]).filter(p=>p.success).length+'/'+(j.pings||[]).length+' replies · Loss '+((j.pings||[]).length?(100*(j.pings||[]).filter(p=>!p.success).length/(j.pings||[]).length).toFixed(1)+'%':'-')+' · Avg RTT '+((j.pings||[]).filter(p=>p.success).length?(j.pings.filter(p=>p.success).reduce((a,p)=>a+p.rttMs,0)/j.pings.filter(p=>p.success).length).toFixed(1)+' ms':'-')+'</div>'+
 '<div style="display:flex;gap:2px;margin:12px 0">'+colored+'</div><p class="note">'+(j.notes||[]).map(esc).join(' ? ')+'</p></section>':'');
}
function testsView(){const types=[['ping','PING','ICMP, RTT и загуби'],['tcp','TCP','Проверка на порт'],['udp','UDP','UDP datagram check'],['dns','DNS','Разрешаване на име'],['traceroute','TRACE','IPv4 маршрут (ICMP)'],['http','HTTP','HTTP/TLS достъпност'],['profile','ПРОФИЛ','Автоматизиран набор от проверки'],['monitor','МОНИТОР','RTT / загуби / p95 — ограничена серия'],['ethernet','ETHERNET','60-second wired link test'],['speedtest','SPEEDTEST','Internet speed'],['snmp','SNMP','Управляемо устройство, LLDP, FDB и VLAN']];const t=state.activeTest;
return `<div class="view-header"><h2>Център за диагностика</h2><p>Действителни проверки към посочен хост. Измерванията се запазват локално за последващ анализ; няма автоматично доказателство за физическа връзка.</p></div>${unavailable()}
<section class="card gap-bottom">${section('Стартиране на тест','Избери диагностична операция')}
<div class="switchers gap-bottom">${types.map(x=>btn(x[1],'testtype-'+x[0],`small ${t===x[0]?'selected':'ghost'}`)).join('')}</div>
${t==="speedtest"?speedtestPanel():""}${t==="ethernet"?ethernetPanel():""}
${t==='monitor'?`<div class="notice">Ограничен тест за стабилност: серия ICMP измервания с реални времеви маркери и избрани от теб прагове. Не е постоянен SLA мониторинг.</div>
<div class="form-grid"><div class="field"><label for="monitor-target">Целеви IP адрес или хост</label><input id="monitor-target" class="input mono" value="${esc(state.monitorTarget)}" placeholder="192.168.1.1"/></div>
<div class="field"><label for="monitor-count">Брой проби (2–30)</label><input id="monitor-count" type="number" min="2" max="30" class="input" value="${esc(state.monitorCount)}"/></div>
<div class="field"><label for="monitor-interval">Интервал между пробите</label><select id="monitor-interval" class="input"><option value="500" ${state.monitorInterval===500?'selected':''}>0.5 сек</option><option value="1000" ${state.monitorInterval===1000?'selected':''}>1 сек</option><option value="2000" ${state.monitorInterval===2000?'selected':''}>2 сек</option><option value="5000" ${state.monitorInterval===5000?'selected':''}>5 сек</option></select></div>
<div class="field"><label for="monitor-loss">Макс. загуби (%)</label><input id="monitor-loss" class="input" type="number" step="0.1" min="0" max="100" value="${esc(state.monitorLoss)}"/></div>
<div class="field"><label for="monitor-rtt">Макс. средно RTT (ms)</label><input id="monitor-rtt" class="input" type="number" min="1" max="5000" value="${esc(state.monitorRtt)}"/></div></div>
<div class="checks" style="margin-top:12px"><input type="checkbox" id="monitor-authorized"><label for="monitor-authorized">Потвърждавам, че имам разрешение за тест на тази цел.</label></div>`:''}
${t==='snmp'?`<div class="notice">SNMPv2c (UDP, само четене): sysName/sysDescr, LLDP съседи, BRIDGE-MIB MAC/FDB и Q-BRIDGE-MIB VLAN имена. LLDP данните са рекламирани от оборудването и не доказват физическо окабеляване. SNMPv2c паролата се предава некриптирано.</div>
<div class="form-grid"><div class="field"><label for="snmp-target">IPv4 адрес на управляемото устройство</label><input id="snmp-target" class="input mono" value="${esc(state.snmpTarget)}" placeholder="192.168.1.2" /></div>
<div class="field"><label for="snmp-community">SNMPv2c community (не се записва)</label><input id="snmp-community" type="password" class="input" autocomplete="off" placeholder="Въведи community" /></div>
<div class="field"><label for="snmp-port">UDP порт</label><input id="snmp-port" type="number" min="1" max="65535" class="input" value="161" /></div>
<div class="field"><label for="snmp-rows">Максимум записи / таблица</label><select id="snmp-rows" class="input"><option value="5">5</option><option value="8" selected>8</option><option value="15">15</option></select></div></div>
<div class="checks" style="margin-top:12px"><input type="checkbox" id="snmp-authorized"><label for="snmp-authorized">Имам разрешение за SNMP проверки на това конкретно устройство в доверена мрежа.</label></div>`:''}
${(t==='ethernet'||t==='monitor'||t==='snmp')?'':t==='profile'?`<div class="notice">Комбиниран диагностичен профил: ICMP, TCP и избрани DNS, HTTP, Traceroute проверки. Не доказва физическа топология или SLA.</div>
<div class="form-grid"><div class="field"><label for="profile-target">Целеви IP адрес или хост</label><input class="input mono" id="profile-target" value="${esc(state.profileTarget)}" placeholder="192.168.1.1"/></div>
<div class="field"><label for="profile-port">TCP порт за проверка</label><input class="input" type="number" min="1" max="65535" id="profile-port" value="${esc(state.profilePort)}"/></div>
<div class="field"><label for="profile-url">HTTP/HTTPS URL (незадължително)</label><input class="input mono" id="profile-url" value="${esc(state.profileUrl)}" placeholder="https://router.local/"/></div></div>
<div class="checks"><input type="checkbox" id="profile-dns"><label for="profile-dns">Провери DNS разрешаване (само при име на хост)</label></div>
<div class="checks"><input type="checkbox" id="profile-trace"><label for="profile-trace">Включи Traceroute (до 12 хопа; може да отнеме време)</label></div>
<div class="checks" style="margin-top:12px"><input type="checkbox" id="profile-authorized"><label for="profile-authorized">Потвърждавам, че имам разрешение да тествам тази крайна точка и услуги.</label></div>`:
`<div class="form-grid"><div class="field"><label for="testhost">${t==='dns'?'Домейн или хост':t==='http'?'HTTP / HTTPS адрес':'Целеви IP адрес или име'}</label><input class="input mono" id="testhost" value="${esc(state.testHost|| (t==='dns'?'localhost':t==='http'?'https://example.com':'127.0.0.1'))}"/></div>
${(t==='tcp'||t==='udp')?'<div class="field"><label for="port">TCP порт</label><input class="input" type="number" min="1" max="65535" id="port" value="443"></div>':t==='ping'?'<div class="field"><label for="pingcount">Брой ICMP проби</label><select class="input" id="pingcount"><option>4</option><option>10</option><option>20</option><option>100</option><option>500</option><option>1000</option></select></div><div class="field"><label for="pinginterval">Интервал между пробите</label><select class="input" id="pinginterval"><option value="250">250 ms</option><option value="500">500 ms</option><option value="1000" selected>1000 ms</option></select></div><div class="field"><label for="pingtimeout">Време за изчакване</label><select class="input" id="pingtimeout"><option value="500">500 ms</option><option value="1200" selected>1200 ms</option><option value="2000">2000 ms</option><option value="5000">5000 ms</option></select></div>':t==='traceroute'?'<div class="field"><label for="hops">Максимален брой хопове</label><select class="input" id="hops"><option>12</option><option selected>20</option><option>32</option></select></div>':''}</div>`}
<div style="margin-top:18px" class="card-actions">${t==='speedtest'?'':btn(`${icon('play')} ${t==='profile'?'Стартирай диагностичен профил':t==='monitor'?'Стартирай мониторингов тест':t==='snmp'?'Прочети SNMP данните':'Изпълни '+t.toUpperCase()+' тест'}`,'run-test','primary')}${state.busy?btn('Прекрати','abort','ghost'):''}</div>${state.busy?'<div class="progress" style="margin-top:15px"></div>':''}
${t==='profile'?profileResultView():t==='monitor'?monitorResultView():t==='snmp'?snmpResultView():state.lastTest?`<div class="result-pre" style="margin-top:15px">${esc(JSON.stringify(state.lastTest,null,2))}</div>`:''}</section>
<section class="card">${section('История на тестовете',`${state.snapshot.tests?.length||0} записа`)}${testsTable(state.snapshot.tests)}</section>`;}
function profileResultView(){
  const profile=state.lastProfile||state.snapshot.tests?.slice().reverse().find(t=>t.type==='PROFILE')?.data;
  if(!profile?.checks?.length)return '<p class="muted" style="margin-top:18px">Няма резултат от диагностичен профил.</p>';
  const css=v=>v==='PASS'?'good':v==='FAIL'?'warn':'off';
  return `<section class="profile-result"><div class="profile-result-title"><strong>Резултат от диагностичен профил</strong><span class="pill ${css(profile.status)}">${esc(profile.status)}</span></div>
  <p class="muted">${esc(profile.host)} · ${esc(fmtTime(profile.completed))} · Статусът описва само изпълнените проверки.</p>
  <div class="table-wrap"><table><thead><tr><th>ПРОВЕРКА</th><th>ЦЕЛ</th><th>СТАТУС</th><th>ИЗМЕРВАНЕ / ОСНОВАНИЕ</th></tr></thead><tbody>${profile.checks.map(c=>`<tr><td>${esc(c.name)}</td><td class="mono">${esc(c.target)}</td><td><span class="pill ${css(c.status)}">${esc(c.status)}</span></td><td>${esc(c.detail)}</td></tr>`).join('')}</tbody></table></div>
  <p class="note">${(profile.warnings||[]).map(esc).join(' · ')}</p></section>`;}
function monitorResultView(){
  const mon=state.lastMonitor||state.snapshot.tests?.slice().reverse().find(t=>t.type==='MONITOR')?.data;
  if(!mon?.samples?.length)return '<p class="muted" style="margin-top:18px">Няма серия от мониторингови измервания.</p>';
  const f=v=>v==null?'—':Number(v).toFixed(2);
  const cls=mon.status==='PASS'?'good':mon.status==='FAIL'?'warn':'off';
  return `<section class="profile-result"><div class="profile-result-title"><strong>Проверка на стабилността — ${esc(mon.host)}</strong><span class="pill ${cls}">${esc(mon.status)}</span></div>
  <p class="muted">${esc(fmtTime(mon.started))} → ${esc(fmtTime(mon.completed))} · Временна ICMP проба, не дългосрочно SLA измерване.</p>
  <div class="grid kpi-grid" style="margin:12px 0">${kpi('Загуби',f(mon.lossPct)+' %','pulse','Праг: '+f(mon.maxLossPct)+' %')}${kpi('Средно RTT',f(mon.avgRttMs)+' ms','pulse','Праг: '+f(mon.maxAvgRttMs)+' ms')}${kpi('RTT p95',f(mon.p95RttMs)+' ms','pulse','Само успешни отговори')}${kpi('Проби',mon.samples.length,'grid','Всяка проба е архивирана')}</div>
  <div class="table-wrap"><table><thead><tr><th>№</th><th>ВРЕМЕ</th><th>СТАТУС</th><th>RTT ms</th><th>ОТГОВОР</th></tr></thead><tbody>${mon.samples.map(s=>`<tr><td>${esc(s.sequence)}</td><td>${esc(fmtTime(s.at))}</td><td><span class="pill ${s.success?'good':'off'}">${s.success?'REPLY':'NO REPLY'}</span></td><td>${esc(f(s.rttMs))}</td><td>${esc(s.error||'ICMP echo')}</td></tr>`).join('')}</tbody></table></div>
  <p class="note">${(mon.warnings||[]).map(esc).join(' · ')}</p></section>`;
}
function snmpResultView(){
  const data=state.lastSnmp||state.snapshot.tests?.slice().reverse().find(x=>x.type==='SNMP')?.data;
  if(!data)return '<p class="muted" style="margin-top:18px">Няма извършено SNMP измерване.</p>';
  const block=(name,heads,rows)=>`<h3 style="margin-top:20px">${esc(name)} (${rows.length})</h3><div class="table-wrap"><table><thead><tr>${heads.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `<section class="profile-result"><div class="profile-result-title"><strong>SNMP инспекция — ${esc(data.host)}</strong><span class="pill ${data.status==='PASS'?'good':'off'}">${esc(data.status)}</span></div>
  <p class="note">Временна SNMPv2c заявка. Community не се записва. Физическата топология остава недоказана.</p>
  ${block('Системни OID',['OID','ПОЛЕ','СТОЙНОСТ'],(data.system||[]).map(x=>[x.oid,x.name,x.value]))}
  ${block('LLDP съседи — рекламирани данни',['ЛОКАЛЕН ПОРТ','СЪСЕД','ОТДАЛЕЧЕН ПОРТ','CHASSIS ID'],(data.lldpNeighbors||[]).map(x=>[x.localPortIndex,x.remoteName,x.remotePortId,x.remoteChassisId]))}
  ${block('SNMP интерфейси / IF-MIB',['ifIndex','ИМЕ','ОПИСАНИЕ','СТАТУС','СКОРОСТ b/s','RX octets','TX octets','RX грешки','TX грешки'],(data.interfaces||[]).map(x=>[x.ifIndex,x.name,x.description,x.operationalStatus,x.speedBps,x.inOctets,x.outOctets,x.inErrors,x.outErrors]))}
  ${block('LLDP локални портове → IF-MIB',['LLDP ПОРТ','PORT ID','ОПИСАНИЕ','ifIndex (ако е потвърден)','ifName'],(data.localPorts||[]).map(x=>[x.lldpPortNumber,x.portId,x.description,x.ifIndex||'НЕПОТВЪРДЕН',x.ifName||'—']))}
  ${block('BRIDGE-MIB bridgePort → ifIndex',['BRIDGE ПОРТ','ifIndex','PVID'],(data.bridgePorts||[]).map(x=>[x.bridgePort,x.ifIndex,x.pvid||'—']))}
  ${block('MAC/FDB — научени адреси',['MAC','BRIDGE ПОРТ','ИЗТОЧНИК'],(data.fdb||[]).map(x=>[x.mac,x.bridgePort,x.evidence]))}
  ${block('VLAN имена — без доказано членство',['VLAN ID','ИМЕ'],(data.vlans||[]).map(x=>[x.vlanId,x.name]))}
  <p class="note">${(data.warnings||[]).map(esc).join(' · ')}</p></section>`;
}
function testsTable(tests){if(!tests?.length)return `<div class="empty">${icon('pulse')}Все още няма извършени тестове.</div>`;
return `<div class="table-wrap"><table><thead><tr><th>ТЕСТ</th><th>ЦЕЛ</th><th>РЕЗУЛТАТ</th><th>ВРЕМЕ</th><th>РЕЗЮМЕ</th></tr></thead><tbody>${tests.slice().reverse().map(t=>`<tr><td>${esc(t.type)}</td><td class="mono">${esc(t.target)}</td><td><span class="pill ${t.status==='PASS'?'good':t.status==='FAIL'?'warn':'off'}">${esc(t.status)}</span></td><td>${fmtTime(t.at)}</td><td>${esc(t.summary)}</td></tr>`).join('')}</tbody></table></div>`;}
function wifiAdapterPanel(){
 const a=state.wifiAdapters||[];
 if(!a.length)return '<section class="card gap-bottom"><p class="note">Няма достъпни Wi-Fi адаптери или данните още не са заредени.</p></section>';
 return '<section class="card gap-bottom">'+section('Wi-Fi адаптер · резервен режим','Информация за интерфейса без сканиране на околните мрежи')+
 a.map(x=>'<div class="notice"><strong>'+esc(x.name)+'</strong> · '+esc(x.status)+
 '<p>Адаптер: '+esc(x.description)+'</p><p>IPv4: '+esc((x.ipv4||x.ipV4||[]).join(', ')||'—')+
 ' · Gateway: '+esc((x.gateways||[]).join(', ')||'—')+'</p><p>DNS: '+esc((x.dnsServers||[]).join(', ')||'—')+
 ' · Номинална скорост: '+esc(String(x.linkSpeedMbps))+' Mbps</p></div>').join('')+
 '<p class="note">Този режим не открива SSID, BSSID, канали или други Wi-Fi мрежи.</p></section>';
}
function wifiView(){const wf=state.snapshot.wifi?.networks||[];const denied=(state.snapshot.wifi?.warnings||[]).some(x=>x.includes('error 5'));
return `<div class="view-header"><h2>Wi-Fi спектър и достъпни мрежи</h2><p>RSSI, SSID, BSSID, честотен диапазон и канал от Windows Native Wi-Fi API. Това не е радиоспектрален анализ.</p></div>${denied?'<p class="note">Windows отказва BSSID сканиране (код 5). Нулите не означават липса на мрежи.</p>':''}${wifiAdapterPanel()}${unavailable()}
<div class="grid kpi-grid">${kpi('Точки в обхват',wf.length,'wifi','BSSID записи')}${kpi('2.4 GHz',wf.filter(x=>x.frequencyBand==='2.4 GHz').length,'pulse','Достъпни мрежи')}${kpi('5 GHz',wf.filter(x=>x.frequencyBand==='5 GHz').length,'pulse','Достъпни мрежи')}${kpi('6 GHz',wf.filter(x=>x.frequencyBand==='6 GHz').length,'pulse','Достъпни мрежи')}</div>
<section class="card">${section('Безжични мрежи',state.snapshot.wifi?`Последно измерване: ${fmtTime(state.snapshot.wifi.at)}`:'Изисква Wi-Fi адаптер и Windows разрешение за местоположение',btn(`${icon('refresh')} Сканирай Wi-Fi`,'scan-wifi','small primary'))}
${wf.length?`<div class="table-wrap"><table><thead><tr><th>SSID</th><th>BSSID</th><th>RSSI</th><th>СИГНАЛ</th><th>КАНАЛ</th><th>ДИАПАЗОН</th></tr></thead><tbody>${wf.map(w=>`<tr><td class="table-name">${esc(w.ssid)}</td><td class="mono">${esc(w.bssid)}</td><td>${w.rssiDbm??'—'} dBm</td><td><span class="signal-bar"><i style="width:${Math.max(0,Math.min(100,Number(w.signalPercent)||0))}%"></i></span>${w.signalPercent??'—'}%</td><td>${esc(w.channel??'—')}</td><td>${esc(w.frequencyBand||'—')}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">${icon('wifi')}Няма измерени Wi-Fi мрежи. Използвай бутона „Сканирай Wi-Fi“.</div>`}
${state.snapshot.wifi?.warnings?.length?`<p class="note">${state.snapshot.wifi.warnings.map(esc).join(' · ')}</p>`:''}</section>`;}
function evidenceGraph(){
 const topo=state.topologyEvidence||{nodes:[],edges:[],warnings:[]};
 const edges=(topo.edges||[]).slice(0,50),nodes=new Map((topo.nodes||[]).map(n=>[n.id,n]));
 if(!edges.length)return '<div class="empty">Няма съхранени SNMP LLDP наблюдения. Извърши разрешена SNMP инспекция от „Център за тестове“.</div>';
 const width=940,height=Math.max(220,edges.length*85+45);
 const body=edges.map((e,i)=>{
   const y=26+i*85,src=nodes.get(e.sourceId),dst=nodes.get(e.targetId);
   const a=(src?.label||e.sourceIp).slice(0,27),b=(dst?.label||e.remoteName||'Непознат съсед').slice(0,27);
   const verified=e.confidence==='RECIPROCAL_LLDP'||e.confidence==='PORT_PAIR_MATCH';
   const color=verified?'#54dab8':'#d4b46d';
   return `<line x1="304" y1="${y+22}" x2="626" y2="${y+22}" stroke="${color}" stroke-width="2" ${verified?'':'stroke-dasharray="7 6"'}/>
    <rect x="26" y="${y}" rx="8" width="278" height="48" fill="#183952" stroke="#5484a8"/>
    <text class="topology-label" x="39" y="${y+19}">${esc(a)}</text><text class="topology-sub" x="39" y="${y+36}">${esc(e.sourceIp)} · порт ${esc(e.localPortId||e.localPortIndex)}${e.localIfName?` / ${esc(e.localIfName)}`:""}</text>
    <rect x="626" y="${y}" rx="8" width="282" height="48" fill="#283c46" stroke="${color}"/>
    <text class="topology-label" x="639" y="${y+19}">${esc(b)}</text><text class="topology-sub" x="639" y="${y+36}">${esc(e.remotePortId||'Порт неизвестен')}</text>
    <text class="topology-sub" x="465" y="${y+14}" text-anchor="middle">${esc(e.confidence)}</text>`;
 }).join('');
 return `<div class="topology-stage topology-full" id="lldp-evidence-canvas" style="height:${Math.max(250,Math.min(670,edges.length*85+90))}px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="LLDP наблюдения — не потвърдени кабелни трасета">${body}</svg></div>${(topo.edges||[]).length>50?'<p class="note">На схемата са показани първите 50 LLDP записа; пълният списък е в таблицата и експорта.</p>':''}`;
}
function evidenceTable(){const topo=state.topologyEvidence||{edges:[],warnings:[]};if(!(topo.edges||[]).length)return '';
 return `<div class="table-wrap"><table><thead><tr><th>ИЗТОЧНИК</th><th>ЛОК. ПОРТ</th><th>РЕКЛАМИРАН СЪСЕД</th><th>ОТДАЛ. ПОРТ</th><th>ДОКАЗАТЕЛСТВА</th><th>ВРЕМЕ</th></tr></thead><tbody>${topo.edges.map(e=>`<tr><td class="mono">${esc(e.sourceIp)}</td><td>${esc(e.localPortId||e.localPortIndex)}${e.localIfName?` · ${esc(e.localIfName)}`:''}</td><td>${esc(e.remoteName||e.remoteChassisId||'Неидентифициран')}</td><td>${esc(e.remotePortId||'—')}</td><td>${esc(e.confidence)}</td><td>${esc(fmtTime(e.observedAt))}</td></tr>`).join('')}</tbody></table></div>`;
}
function universalInventoryPanel(){
 const u=state.universalInventory;
 if(!u)return '<section class="card gap-bottom"><h3>Универсален инвентар</h3><p class="note">Няма заредени данни от агента.</p></section>';
 const nets=(u.prefixes||[]).map(n=>`<tr><td class="mono">${esc(n.cidr)}</td><td>${esc(n.addressFamily)}</td><td>${esc(n.namespace)}</td><td>${esc(n.source)}</td><td>${n.scanEligible?'Разрешим обхват':'Само инвентар'}</td></tr>`).join('');
 const ips=(u.addresses||[]).slice(0,250).map(a=>`<tr><td class="mono">${esc(a.ip)}</td><td>${esc(a.label||'-')}</td><td>${esc(a.source)}</td><td>${esc(a.status)}</td></tr>`).join('');
 return `<section class="card gap-bottom"><div class="toolbar-row">${section('Универсален мрежов инвентар',`${u.prefixes.length} CIDR · ${u.addresses.length} известни IP · ${u.links.length} връзки`)}</div><p class="note">Регистрирана мрежа не означава достъпна мрежа. Известен IP не означава активно устройство. Показани са до 250 IP записи.</p><div class="table-wrap"><table><thead><tr><th>CIDR</th><th>Протокол</th><th>Адресно пространство</th><th>Източник</th><th>Статус</th></tr></thead><tbody>${nets}</tbody></table></div><h3>Известни IP адреси</h3><div class="table-wrap"><table><thead><tr><th>IP</th><th>Описание</th><th>Източник</th><th>Статус</th></tr></thead><tbody>${ips}</tbody></table></div></section>`;
}

function infrastructureFrontierPanel(){
 const f=state.infrastructureFrontier;
 if(!f)return '';
 const rows=(f.candidates||[]).map(c=>`<tr><td class="mono">${esc(c.ip)}</td><td>${esc(c.kind)}</td><td>${esc(c.source)}</td><td>${esc(c.state)}</td></tr>`).join('');
 return `<section class="card gap-bottom"><div class="toolbar-row">${section('Инфраструктурни кандидати',`${(f.candidates||[]).length} известни IP адреса за последваща проверка`)}</div><p class="note">Пасивен списък от gateway и next-hop данни. Не доказва тип устройство или връзка. Не се изпращат автоматични заявки.</p><div class="table-wrap"><table><thead><tr><th>IP</th><th>Тип</th><th>Източник</th><th>Статус</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
function infrastructurePanel(){
 const i=state.infrastructure;
 if(!i)return '<section class="card gap-bottom"><h3>L2 / L3 инвентар</h3><p>Зареждане на инвентара при следващо свързване.</p></section>';
 const rows=(i.networks||[]).map(n=>`<tr><td class="mono">${esc(n.cidr)}</td><td>${esc(n.source)}</td><td>${esc(n.via||'-')}</td><td>${n.scanEligible?'Да':'Само информация'}</td></tr>`).join('');
 const edges=(i.links||[]).map(e=>`<tr><td>${esc(e.from)}</td><td>${esc(e.to)}</td><td>${esc(e.kind)}</td><td>${esc(e.confidence)}</td><td>${esc([e.localPort,e.remotePort].filter(Boolean).join(' → ')||'-')}</td></tr>`).join('');
 return `<section class="card gap-bottom"><h3>Инвентар L2 / L3 — ${i.networks.length} мрежи, ${i.devices.length} възела, ${i.links.length} връзки</h3><p class="note">Маршрути ≠ физически кабели. LLDP връзките са наблюдавани записи, не кабелен тест.</p><div class="table-wrap"><table><thead><tr><th>CIDR</th><th>Източник</th><th>Next hop</th><th>Сканиране</th></tr></thead><tbody>${rows}</tbody></table></div><h3>Връзки между възли</h3><div class="table-wrap"><table><thead><tr><th>От</th><th>Към</th><th>Тип</th><th>Достоверност</th><th>Портове</th></tr></thead><tbody>${edges}</tbody></table></div></section>`;
}
function networkMapSvg(){
 const inv=state.universalInventory||{prefixes:[],addresses:[]},scan=state.snapshot.scan;
 const prefixes=(inv.prefixes||[]).filter(p=>p.addressFamily==='IPv4');
 const scanned=(scan?.devices||[]).map(d=>({ip:d.ip,label:d.name||d.ip,source:'CIDR SCAN',status:'OBSERVED'}));
 const discovered=(state.discoveryResult?.devices||[]).map(d=>({ip:d.ip,label:d.name||d.ip,source:'NETWORK DISCOVERY',status:'OBSERVED'}));
 const candidates=[...scanned,...discovered,...(inv.addresses||[])];

 const ipnum=ip=>{const p=ip.split('.').map(Number);return p.length===4&&p.every(n=>Number.isInteger(n)&&n>=0&&n<=255)?p.reduce((v,n)=>((v<<8)>>>0)+n,0)>>>0:null};
 const seen=new Set(),addresses=candidates.filter(a=>{if(!a.ip||ipnum(a.ip)===null||seen.has(a.ip))return false;seen.add(a.ip);return true});
 const belongs=(ip,cidr)=>{const [base,bits]=cidr.split('/'),p=ipnum(ip),b=ipnum(base),n=Number(bits);return p!==null&&b!==null&&n>=0&&n<=32&&((p&(n===0?0:(0xffffffff<<(32-n))>>>0))>>>0)===((b&(n===0?0:(0xffffffff<<(32-n))>>>0))>>>0)};
 const groups=prefixes.map(p=>({name:p.cidr,origin:p.source,items:addresses.filter(a=>belongs(a.ip,p.cidr))})).filter(g=>g.items.length>0);
 const assigned=new Set(groups.flatMap(g=>g.items.map(a=>a.ip)));
 const other=addresses.filter(a=>!assigned.has(a.ip));
 if(other.length)groups.push({name:'Други наблюдавани адреси',origin:'unassigned',items:other});
 if(!groups.length)return '<div class="notice">Няма събрани мрежови адреси. Стартирай Discovery или прегледай локалните интерфейси.</div>';
 const w=980,col=2,cellW=472,pad=14;
 const sizes=groups.map(g=>90+Math.max(1,Math.ceil(g.items.length/3))*34);
 const positions=[];let y=18;
 for(let i=0;i<groups.length;i+=2){positions[i]={x:12,y};if(groups[i+1])positions[i+1]={x:496,y};y+=Math.max(sizes[i],sizes[i+1]||0)+16}
 let body=''; const positionMap=new Map();
 groups.forEach((g,i)=>{const {x,y:gy}=positions[i],h=sizes[i];
 body+='<rect x="'+x+'" y="'+gy+'" width="'+cellW+'" height="'+h+'" rx="12" fill="#15243b" stroke="#3b5879"/>'+
 '<text x="'+(x+16)+'" y="'+(gy+27)+'" fill="#8fa7c1" font-size="10" font-weight="500">'+esc(g.name)+'</text>'+
 '<text x="'+(x+16)+'" y="'+(gy+47)+'" fill="#758da8" font-size="8">'+esc(g.origin||'')+' · '+g.items.length+' IP адреса</text>';
 g.items.forEach((a,j)=>{const x2=x+16+(j%3)*150,y2=gy+66+Math.floor(j/3)*34;positionMap.set(a.ip,{x:x2+71,y:y2+12});
 body+='<rect x="'+x2+'" y="'+y2+'" width="142" height="25" rx="5" fill="#263c58" stroke="#486581"/>'+
 '<text x="'+(x2+7)+'" y="'+(y2+17)+'" fill="#8ba2bb" font-size="9">'+esc(a.ip)+'</text>';
 });
 });
 const evidence=state.topologyEvidence||{nodes:[],edges:[]};
 const identified=new Map((evidence.nodes||[]).map(n=>[n.id,n]));
 const links=(evidence.edges||[]).filter(e=>{
   const dest=identified.get(e.targetId)?.ip,age=Date.now()-Date.parse(e.observedAt);
   return dest&&positionMap.has(e.sourceIp)&&positionMap.has(dest)&&e.confidence!=='STALE'&&Number.isFinite(age)&&age>=-120000&&age<=1800000;
 }).slice(0,60);
 const lines=links.map(e=>{
   const src=positionMap.get(e.sourceIp),dst=positionMap.get(identified.get(e.targetId).ip);
   const strong=['RECIPROCAL_LLDP','PORT_PAIR_MATCH'].includes(e.confidence);
   return '<line x1='+src.x+' y1='+src.y+' x2='+dst.x+' y2='+dst.y+' stroke='+(strong?'#54dab8':'#d4b46d')+' stroke-width=2 '+(strong?'':'stroke-dasharray=6,5')+'/>';
 }).join('');
 body=lines+body;
 return '<div class="notice">Логическо групиране по CIDR. Правоъгълниците са наблюдавани IP адреси, не потвърдени физически устройства. Линии между тях умишлено не се чертаят без LLDP доказателства.</div>'+
 '<div style="overflow:auto"><svg id="network-map-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+(y+15)+'" role="img" aria-label="Логическа карта на наблюдавани IP адреси по мрежи" style="width:980px;max-width:none;min-width:980px;height:auto;background:#0b1728;border-radius:12px">'+body+'</svg></div>';
}
function exportNetworkMap(){
 const svg=document.getElementById('network-map-svg');
 if(!svg){toast('Няма карта за експортиране.',true);return;}
 const textData=new XMLSerializer().serializeToString(svg);
 const url=URL.createObjectURL(new Blob([textData],{type:'image/svg+xml;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='Network_Logical_Map.svg';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function snmpEvidencePanel(){
 const recent=(state.snapshot?.tests||[]).filter(t=>t.type==='SNMP').slice().reverse();
 const hosts=new Set();
 const inspections=recent.filter(t=>{if(hosts.has(t.target))return false;hosts.add(t.target);return true}).slice(0,20);
 const rows=inspections.map(t=>{
  const d=t.data||{},f=d.fdb||[],v=d.vlans||[],ports=d.bridgePorts||[];
  const ok=t.status==='PASS';
  return '<tr><td>'+esc(t.target)+'</td><td>'+esc(t.status)+'</td><td>'+f.length+'</td><td>'+v.length+'</td><td>'+ports.length+'</td><td>'+fmtTime(t.at)+'</td></tr>';
 }).join('');
 return '<section class="card gap-bottom">'+section('SNMP: MAC/FDB и VLAN','Последна инспекция за всяко устройство')+
 '<p class="note">FDB показва научени MAC адреси по мостови портове. VLAN показва конфигурационни записи. Тези данни сами по себе си не доказват директно физическо окабеляване.</p>'+
 '<div class="table-wrap"><table><thead><tr><th>IP</th><th>SNMP</th><th>MAC/FDB</th><th>VLAN</th><th>Bridge ports</th><th>Проверка</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
 (rows?'':'<p class="note">Няма записани SNMP инспекции. Използвай разрешена SNMP проверка от Тестове.</p>')+'</section>';
}
function topologyView(){const topo=state.topologyEvidence||{nodes:[],edges:[],warnings:[]};
 return `<div class="view-header"><h2>Мрежова топология и LLDP доказателства</h2><p>Отделни изгледи за рекламирани LLDP съседства и логическа IP подмрежа. Не се твърди сертифицирано физическо окабеляване.</p></div>${unavailable()}<section class="card gap-bottom"><div class="toolbar-row">${section('Discovery · CIDR','ICMP + TCP + съществуващи LLDP доказателства')}</div><div class="form-grid"><div class="field"><label for="discovery-cidr">Разрешена IPv4 мрежа (/24–/32)</label><input id="discovery-cidr" class="input mono" value="${esc(state.discoveryCidr||state.scanCidr||'192.168.20.0/24')}" /></div></div><div class="checks"><input type="checkbox" id="discovery-authorized"><label for="discovery-authorized">Имам разрешение за сканиране на тази мрежа</label></div><div class="card-actions">${btn('▶ DISCOVER NETWORK','discovery-run','primary')}</div>${state.discoveryResult?`<p class="note">${state.discoveryResult.devices.length} отговарящи устройства · ${state.discoveryResult.topology.edges.length} LLDP връзки от налични SNMP данни</p>`:''}</section><section class="card gap-bottom">${section('Логическа карта по CIDR','Автоматично групиране на наличните IP наблюдения',btn('Експорт SVG','network-map-export','small'))}${networkMapSvg()}</section>${snmpEvidencePanel()}${universalInventoryPanel()}${infrastructureFrontierPanel()}${infrastructurePanel()}
<section class="card gap-bottom"><div class="toolbar-row">${section('SNMP / LLDP наблюдения',`${topo.edges.length} рекламирани съседства · ${topo.nodes.length} възела`)}<div class="card-actions">${btn('Обнови','topology-refresh','small ghost')}${btn('LLDP SVG','evidence-svg','small')}${btn('LLDP DRAWIO','evidence-drawio','small')}</div></div>
<div class="notice">Статуси: ADVERTISED = едностранно съобщен съсед; CHASSIS_MATCH = уникален chassis ID от две инспекции; RECIPROCAL_LLDP = двустранно chassis съседство; PORT_PAIR_MATCH = съвпадение и на рекламираните два порта; STALE = данни над 30 минути. Нито един не доказва сертифициран физически кабел. FDB и VLAN не създават линии.</div>
${evidenceGraph()}${evidenceTable()}${(topo.warnings||[]).length?`<p class="note">${topo.warnings.map(esc).join(' · ')}</p>`:''}</section>
<section class="card"><div class="toolbar-row">${section('Логическа IP карта',`${count()} устройства · ${state.snapshot.scan?.cidr||'Няма обхват'}`)}<div class="card-actions">${btn('−','zoom-out','small ghost')}${btn('+','zoom-in','small ghost')}${btn(`${icon('download')} SVG`,'svg','small')}${btn('DRAWIO','drawio','small')}</div></div>${topologySvg(true)}<div class="legend"><span><i class="legend-line"></i>Логическа подмрежа</span><span>Неизвестни физически връзки · не се добавят автоматично</span></div>${inspector()}</section>`;
}
function inspector(){const found=state.snapshot.scan?.devices?.find(x=>x.id===state.selectedDevice);
return `<div class="inspector"><div class="split"><strong>Инспектор на устройство</strong><span class="pill">${found?'ИЗБРАНО':'НЯМА ИЗБОР'}</span></div>
${found?`<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:20px;margin-top:12px"><div class="kv"><span>Име</span><strong>${esc(found.name||'Неизвестно')}</strong></div><div class="kv"><span>IP</span><strong class="mono">${esc(found.ip)}</strong></div><div class="kv"><span>MAC</span><strong class="mono">${esc(found.mac||"-")}</strong></div><div class="kv"><span>RTT</span><strong>${found.rttMs??'—'} ms</strong></div><div class="kv"><span>Доказателство</span><strong>${esc(found.source)}</strong></div></div>`:`<p class="muted" style="margin-bottom:0">Избери устройство с клик върху възел от схемата.</p>`}</div>`;}
function topologySvg(full){
 const ds=state.snapshot.scan?.devices||[];
 if((state.snapshot.scan?.scannedRanges?.length||0)>1) return `<div class="notice">Открити са устройства в няколко IP подмрежи (${state.snapshot.scan.scannedRanges.map(esc).join(', ')}). Не се чертае фиктивна обща подсистема или физическа връзка между тях. Виж пълния списък на устройствата и LLDP наблюденията.</div>`;
 const countAll=ds.length, n=countAll, w=880, h=full?Math.max(480,380+Math.max(0,Math.ceil((n-5)/5)-1)*88):340;
 const cx=w/2,cy=full?235:165,layout=[];
 if(n<=10){const first=Math.ceil(n/2);const last=n-first;
   for(let i=0;i<first;i++)layout.push({d:ds[i],x:(i+1)*w/(first+1),y:full?85:65});
   for(let i=0;i<last;i++)layout.push({d:ds[i+first],x:(i+1)*w/(last+1),y:full?385:275});
 }else{
   for(let i=0;i<n;i++){
     const x=(i%5+1)*w/6,y=i<5?(full?80:60):(full?370:255)+Math.floor((i-5)/5)*88;
     layout.push({d:ds[i],x,y});
   }
 }
 let lines='',nodes='';
 for(const {d,x,y} of layout){
   lines+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#52728e" stroke-opacity=".58" stroke-width="1.5" stroke-dasharray="5 7"/>`;
   nodes+=`<g class="topology-node" data-node="${esc(d.id)}" tabindex="0" role="button" aria-label="Устройство ${esc(d.ip)}"><rect x="${x-67}" y="${y-23}" width="134" height="46" rx="10" fill="${state.selectedDevice===d.id?'#214f76':'#173149'}" stroke="${state.selectedDevice===d.id?'#8bd2ff':'#3b6988'}" stroke-width="${state.selectedDevice===d.id?'2.8':'1.3'}"/><circle cx="${x-51}" cy="${y-1}" r="4" fill="${d.ping?'#48dab1':'#f8c36c'}"/><text class="topology-label" x="${x+3}" y="${y-4}" text-anchor="middle">${esc((d.name||d.ip).slice(0,18))}</text><text class="topology-sub" x="${x+3}" y="${y+12}" text-anchor="middle">${esc(d.ip)}</text></g>`;
 }
 const network=esc(state.snapshot.scan?.cidr||'IP мрежа');
 const all=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" aria-label="Логическа мрежова схема" role="img"><g transform="translate(${cx*(1-state.scale)} ${cy*(1-state.scale)}) scale(${state.scale})">${lines}<rect x="${cx-95}" y="${cy-34}" width="190" height="68" rx="16" fill="#24547e" stroke="#6aa8db" stroke-width="2"/><text class="topology-label" x="${cx}" y="${cy-4}" text-anchor="middle">ЛОГИЧЕСКА ПОДМРЕЖА</text><text class="topology-sub" x="${cx}" y="${cy+16}" text-anchor="middle">${network}</text>${nodes}</g></svg>`;
 return `<div class="topology-stage ${full?'topology-full':''}" id="topology-canvas">${all}</div>${countAll>n?`<p class="note">Показани са първите ${n} от общо ${countAll} устройства; пълният списък е в табличния отчет.</p>`:''}`;
}
function reportCard(ic,name,desc,action,disabled=false){return `<div class="report-card"><div style="display:flex;align-items:center;gap:12px">${icon(ic)}<div><div class="report-name">${name}</div><div class="report-desc">${desc}</div></div></div>${btn(`${icon('download')} Експорт` ,action,`small ${disabled?'ghost':''}`)}</div>`;}
function exportToolkit(format){
 const ids=new Set(Array.from(document.querySelectorAll('.toolkit-report-check:checked')).map(x=>x.value));
 const rows=(state.snapshot?.tests||[]).filter(x=>(x.type==='TOOLKIT'||x.type==='ETHERNET')&&ids.has(x.id));
 if(!rows.length){toast('Избери поне един запис.',true);return;}
 const payload=rows.map(t=>({id:t.id,at:t.at,command:t.type==='ETHERNET'?(t.data?.destination||t.target):t.target,type:t.type,adapter:t.type==='ETHERNET'?t.target:undefined,status:t.status,summary:t.summary,details:t.data}));
 const content=format==='json'?JSON.stringify({generatedAt:new Date().toISOString(),records:payload},null,2):'<!doctype html><html lang="bg"><head><meta charset="utf-8"><title>Windows Toolkit отчет</title><style>body{font:14px Arial;max-width:1100px;margin:32px auto}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f4f8;padding:12px}article{border-bottom:1px solid #ccc;padding:18px 0}small{color:#555}</style></head><body><h1>NETWORK INSPECTOR — Windows Toolkit</h1><p>Отчет, съставен от записани диагностични резултати. Интерпретациите не доказват физическа топология.</p>'+payload.map(t=>'<article><h2>'+esc(t.command)+'</h2><small>'+esc(t.at)+' · '+esc(t.status)+'</small><p>'+esc(t.summary)+'</p><pre>'+esc(t.details?.output||JSON.stringify(t.details,null,2))+'</pre></article>').join('')+'</body></html>';
 const blob=new Blob([content],{type:format==='json'?'application/json;charset=utf-8':'text/html;charset=utf-8'});
 const url=URL.createObjectURL(blob),el=document.createElement('a');el.href=url;el.download='NetworkToolkit_Report_'+new Date().toISOString().slice(0,10)+'.'+format;document.body.appendChild(el);el.click();el.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function reports(){const toolkitRecords=(state.snapshot?.tests||[]).filter(x=>x.type==='TOOLKIT'||x.type==='ETHERNET');return `<div class="view-header"><h2>Експорт на резултати</h2><p>Технически файлове за отчетност, обмен и архивиране. Без фалшиви топологични връзки или измислени измервания.</p></div>${unavailable()}
<section class="card gap-bottom">
${section('Windows Toolkit — отчет','Избери записаните диагностични изпълнения')}
<div class="toolbar-row" style="flex-wrap:wrap">
${toolkitRecords.slice(-40).reverse().map(t=>`<label style="display:block;padding:7px"><input type="checkbox" class="toolkit-report-check" value="${esc(t.id)}" checked> ${esc(t.type==='ETHERNET'?'ETHERNET: '+(t.data?.destination||t.target):t.target)} · ${esc(t.status)} · ${fmtTime(t.at)}</label>`).join('')||'<p>Няма записани Windows Toolkit изпълнения.</p>'}
</div>
<div class="toolbar-row">${btn('Изтегли HTML отчет','toolkit-export-html','primary')}${btn('Изтегли JSON отчет','toolkit-export-json','small ghost')}</div>
<p class="note">Отчетът включва реални запазени резултати и диагностични разяснения; останалите формати по-долу са непроменени.</p>
</section>
<section class="card gap-bottom">${section('Формати за експортиране','Всички файлове се генерират от текущите данни')}
<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
${reportCard('file','Пълен ZIP отчет','JSON · XLSX · LLDP · CSV · описание','bundle')}
${reportCard('file','XLSX / Excel','Устройства · Wi-Fi · Тестове · Контрол','xlsx')}
${reportCard('nodes','DRAWIO','Редактируема логическа IP диаграма','drawio')}
${reportCard('nodes','LLDP DRAWIO','Рекламирани съседства с източник и статус','evidence-drawio')}
${reportCard('file','LLDP SVG','LLDP наблюдения, без твърдение за кабел','evidence-svg')}
${reportCard('file','SVG','Мащабируема векторна топология','svg')}
${reportCard('file','JSON','RAW данни · инвентар · измервания','json')}
${reportCard('file','HTML','Самостоятелен отчет за преглед и печат в PDF','html')}
${reportCard('file','CSV','Табличен списък с открити IP устройства','csv')}
</div><p class="note">За PDF използвай HTML отчета → „Печат“ → „Запази като PDF“. XLSX се генерира от локалния .NET агент и е недостъпен в демонстрация.</p></section>
<section class="card">${section('Съдържание на текущата сесия')}
<div class="grid kpi-grid" style="margin:0">${kpi('Устройства',count(),'monitor','')}${kpi('Wi-Fi',state.snapshot.wifi?.networks?.length||0,'wifi','')}${kpi('Тестове',state.snapshot.tests?.length||0,'pulse','')}${kpi('Измерен обхват',state.snapshot.scan?.cidr||'—','globe','')}</div></section>`;}
function adaptersTable(){
 const entries=state.adapters||[];
 if(!entries.length)return '<div class="empty">Няма прочетени адаптери. За реална диагностика свържи Windows агента.</div>';
 const val=x=>x==null?'—':x;
 return `<div class="table-wrap"><table><thead><tr><th>АДАПТЕР</th><th>СЪСТОЯНИЕ</th><th>IP / DNS</th><th>ЛИНК / MTU</th><th>БРОЯЧИ</th></tr></thead><tbody>${entries.map(a=>`<tr>
  <td><strong>${esc(a.name)}</strong><div class="muted">${esc(a.type)} · ${esc(a.mac||'MAC неизвестен')}</div></td>
  <td>${esc(a.status)}</td>
  <td class="mono">${esc((a.iPv4||a.ipV4||a.ipv4||[]).join(', ')||'—')}<div class="muted">DNS: ${esc((a.dns||[]).join(', ')||'—')}</div></td>
  <td>${esc(val(a.speedMbps))} Mbps <div class="muted">MTU ${esc(val(a.mtu))}</div></td>
  <td>RX ${esc(val(a.bytesReceived))} B · TX ${esc(val(a.bytesSent))} B
  <div class="muted">Грешки RX/TX ${esc(val(a.inErrors))}/${esc(val(a.outErrors))} · Drop RX/TX ${esc(val(a.inDiscards))}/${esc(val(a.outDiscards))}</div></td>
 </tr>`).join('')}</tbody></table></div>`;
}
function settings(){return `<div class="view-header"><h2>Локален Windows Network Agent</h2><p>Приложението е PWA, а измервателният двигател е преносим .NET процес без задължителен инсталатор.</p></div>
<section class="card gap-bottom">${section('Състояние на агента','Комуникация само през loopback интерфейса')}
<div class="grid form-grid"><div class="field"><label>Адрес</label><div class="input mono">http://127.0.0.1:5188</div></div><div class="field"><label>Режим</label><div class="input">${state.demo?'Демонстрация':state.connected?'Активен':state.agentAvailable?'Очаква код':'Не е стартиран'}</div></div><div class="field"><label>Достъп</label><div class="input">Стандартен Windows акаунт</div></div></div>
${!state.demo&&!state.connected?`<div class="notice warn" style="margin-top:17px">Стартирай Start_Agent.bat. В неговия прозорец ще видиш временен код. Въведи го тук; кодът никога не се извлича от публичния API.</div><div class="grid" style="margin-top:15px;max-width:460px;gap:9px"><label for="pair-code">Код за сдвояване</label><input id="pair-code" class="input mono" maxlength="19" autocomplete="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" aria-label="Код за сдвояване">${btn(`${icon('check')} Свържи агента`,'pair-agent','primary')}</div>`:''}
<div class="card-actions" style="margin-top:17px">${btn(`${icon('refresh')} Провери връзката`,'check-agent','primary')}${btn(`Превключи тема`,'theme','ghost')}</div></section>
<section class="card gap-bottom">${section('Диагностика на мрежовите интерфейси','Статистики от Windows. Скоростта на връзката не е измерен throughput.')}${adaptersTable()}<p class="note">Броячите са моментни абсолютни стойности от операционната система; процент на грешки и скорост на трафика изискват две измервания във времето.</p></section>
<section class="card gap-bottom">${section('Как да стартираш приложението')}<div class="flex-col" style="line-height:1.8;color:var(--muted)"><div><strong style="color:var(--text)">1.</strong> Компилирай пакета на Windows с .NET 10 SDK чрез <code>build-windows.ps1</code>.</div><div><strong style="color:var(--text)">2.</strong> Стартирай получения <code>Start_Agent.bat</code> (без инсталация).</div><div><strong style="color:var(--text)">3.</strong> Отвори <code>http://127.0.0.1:5188</code> и инсталирай PWA през менюто на Edge / Chrome.</div><div><strong style="color:var(--text)">4.</strong> Изпълнявай измерванията само в разрешени мрежи.</div></div></section>
<section class="card">${section('Статус на модулите')}<div class="table-wrap"><table><thead><tr><th>МОДУЛ</th><th>СТАТУС В v0.10</th></tr></thead><tbody>
${[['LAN discovery, ICMP, TCP, DNS, TRACE, HTTP','Преминали локални Windows тестове; необходима проверка в реална мрежа'],['Wi-Fi SSID/BSSID/RSSI/канал','WLAN API код; изисква Windows проверка и разрешения'],['Топология (логическа)','Реализирана в браузъра'],['Excel, JSON, DRAWIO, SVG, HTML, CSV','Реализирани експортери; необходима приемателна проверка'],['SNMPv2c, IF-MIB, LLDP портове, bridge mapping','Реализирани с read-only SNMP; изисква проверки на истински суич'],['Серия ICMP проби, RTT p95, прагове и RAW история','Реализиран код; нужен е реален Windows тест'],['iperf2/throughput, непрекъснат SLA','Предстои'],['Облачен API и публикуване','След приемателни тестове']].map(x=>`<tr><td>${esc(x[0])}</td><td>${esc(x[1])}</td></tr>`).join('')}
</tbody></table></div></section>`;}
const toolkitExpert={
 ipconfig:['IPv4/IPv6 адрес, PrefixLength, Default Gateway, DNS и DHCP lease','Сравни адреса и маската с очакваната VLAN; провери шлюз и DNS','169.254.x.x често показва APIPA; липсата на шлюз не винаги е дефект'],
 adapters:['Status, LinkSpeed, MacAddress, InterfaceDescription','Провери физически и виртуални адаптери поотделно; Down не доказва повреда','Линковата скорост не е реално измерена пропускателност'],
 routes:['Destination, Netmask, Gateway, Interface, Metric','Провери default route, по-специфични маршрути и метрики','Маршрут е L3 избор, а не директна физическа връзка'],
 neighbors:['Internet Address, Physical Address, Type','Съпостави IP-MAC кеша с конкретния интерфейс и VLAN','ARP е локален кеш, може да е остарял и да съдържа gateway MAC'],
 dns:['Entry, Name, Type, Data, TTL','Провери име, тип A/AAAA/CNAME и оставащ TTL','Кешираният запис не доказва актуална DNS резолюция'],
 connections:['Proto, Local Address, Foreign Address, State, PID','Изолирай LISTENING от ESTABLISHED; съпостави PID с процеса','Свързан TCP порт не гарантира коректна приложна услуга'],
 wifi:['SSID, BSSID, State, Signal, Radio type, Channel','Сравни BSSID, качество на сигнала и честотна лента','Windows може да ограничава BSSID заради разрешения за местоположение'],
 stats:['TCP Retransmissions, Segments, UDP Datagrams, Errors','Търси нарастващи грешки при повторно измерване, не абсолютна стойност','Статистиката е натрупана и може да включва много интерфейси'],
 services:['Name, Status, StartType','Провери услугата заедно с права, драйвер и състояние на адаптера','Работещ WlanSvc не дава автоматично достъп до Wi-Fi сканиране'],
 ipaddresses:['IPAddress, PrefixLength, InterfaceIndex, AddressState','Провери дублирани и временни IP адреси и коректен префикс','IPv6 link-local адресът не е глобално маршрутизируем'],
 interfaces:['InterfaceIndex, NlMtu, InterfaceMetric, ConnectionState','Съпостави интерфейсен индекс с маршрута и предпочитаното семейство IP','По-ниската метрика може да промени избора на маршрут'],
 iproutes:['DestinationPrefix, NextHop, RouteMetric, InterfaceIndex','Съпостави NextHop и интерфейс с Get-NetIPInterface','Запис в таблицата не потвърждава достъпен next-hop'],
 ipneighbors:['IPAddress, LinkLayerAddress, State, InterfaceIndex','Различавай Reachable, Stale, Delay и Unreachable','Състоянието се изменя и не потвърждава кабел'],
 dnsservers:['InterfaceAlias, AddressFamily, ServerAddresses','Провери подредбата на DNS сървърите и използвания интерфейс','Конфигуриран DNS сървър може да не отговаря'],
 tcpconnections:['LocalPort, RemoteAddress, State, OwningProcess','Провери LISTEN, Established и процесите за подозрителни портове','TCP състоянието е моментна снимка'],
 udpendpoints:['LocalAddress, LocalPort, OwningProcess','Провери дали услугата слуша на правилен адрес и порт','UDP няма еквивалент на установена TCP връзка'],
 adapterstats:['ReceivedBytes, SentBytes, Errors, Discards','Направи две измервания през интервал, за да откриеш промяна','Единична стойност на брояч не измерва скорост'],
 firewall:['Name, Enabled, DefaultInboundAction, DefaultOutboundAction','Съпостави активния профил с правилата и тестовете','Профилът не показва кое конкретно правило блокира пакета'],
 profiles:['Name, InterfaceAlias, NetworkCategory, IPv4Connectivity','Провери дали интерфейсът е Public, Private или DomainAuthenticated','Категорията Windows не означава публичен IPv4 адрес']
};
function toolkitExpertPanel(x){
 const v=toolkitExpert[x.id]||[x.description,x.usage,x.interpretation];
 return '<div class="card" style="margin:14px 0;padding:16px"><h3>Експертен анализ</h3><p><strong>Полетата и тяхното значение:</strong> '+esc(v[0])+'</p><p><strong>Диагностичен подход:</strong> '+esc(v[1])+'</p><p><strong>Ограничения:</strong> '+esc(v[2])+'</p><p><strong>Права и безопасност:</strong> '+esc(x.risk)+'. Някои полета изискват допълнителни Windows права или работеща услуга.</p><p class="note">За физическа топология са необходими потвърждаващи данни от LLDP/SNMP и таблиците на управляемите комутатори.</p></div>';
}
const targetHelp={
 ping:['Проверява достижимост чрез ICMP Echo.','Синтаксис: ping -n 4 <адрес>. Анализирай получените отговори, времена RTT и загуба на пакети.','TTL отговорът и вариациите на RTT могат да помогнат при диагностика. Липсата на отговор не доказва, че хостът е изключен: защитна стена може да блокира ICMP. PING не доказва физическа връзка.'],
 tracert:['Показва междинните IP маршрутизатори до целта.','Синтаксис: tracert -d -w 800 <адрес>. Следи хоповете и времето за отговор.','Използва TTL и ICMP отговори. Звездички може да означават филтриране или timeout. Различните пакети могат да използват различни маршрути; хоповете не са физическа кабелна схема.'],
 pathping:['Анализира маршрута и приблизителните загуби по хопове.','Синтаксис: pathping -n -q 3 <адрес>. Проверката отнема повече време от PING.','Измерванията зависят от ICMP политиките на междинните маршрутизатори. Ограничаването на ICMP може да създаде привидни загуби; резултатите не доказват повреден линк.'],
 nslookup:['Проверява DNS резолюцията на име или адрес.','Синтаксис: nslookup <домейн или IPv4>. Анализирай DNS сървъра и получените A/PTR записи.','NXDOMAIN означава, че търсеното име не съществува според отговорилия DNS сървър. DNS кеш, split DNS и различни сървъри могат да дадат различни отговори. Не проверява TCP достижимост.'],
 'test-netconnection':['Проверява достъпността до хост и при зададен порт — TCP свързаност.','Синтаксис: Test-NetConnection -ComputerName <адрес> -Port <1..65535>. Без порт дава подробна мрежова диагностика.','TcpTestSucceeded=True означава успешна TCP връзка към конкретния порт, но не гарантира, че приложният протокол работи. При False провери маршрути, DNS, локална и отдалечена защитна стена и слушаща услуга.']
};
function targetToolkitHelp(id){
 const h=targetHelp[id],level=state.targetToolkitLevel||'brief';
 return '<div class="toolkit-target-help"><div class="toolbar-row">'+
 [['brief','Кратко'],['detail','Подробно'],['expert','Експертно']].map(v=>'<button type="button" class="toolkit-help-level'+(level===v[0]?' active':'')+'" data-action="target-level-'+v[0]+'">'+v[1]+'</button>').join('')+
 '</div><p><strong>Описание:</strong> '+esc(h[0])+'</p>'+
 (level!=='brief'?'<p><strong>Синтаксис и анализ:</strong> '+esc(h[1])+'</p>':'')+
 (level==='expert'?'<p><strong>Експертно тълкуване и ограничения:</strong> '+esc(h[2])+'</p>':'')+'</div>';
}
function targetToolkitPanel(){
 const opts=[['ping','PING'],['tracert','TRACERT'],['pathping','PATHPING'],['nslookup','NSLOOKUP'],['test-netconnection','Test-NetConnection']];
 const selected=state.targetToolkitCommand||'ping';
 return '<section class="card gap-bottom"><h3>Диагностика по IP адрес или домейн</h3><div class="toolkit-command-grid">'+opts.map(v=>'<button class="toolkit-command-button'+(selected===v[0]?' active':'')+'" data-action="target-select-'+v[0]+'">'+v[1]+'</button>').join('')+'</div>'+
 '<div class="form-grid"><div class="field"><label for="target-host">IP адрес / домейн</label><input id="target-host" class="input mono" placeholder="192.168.1.1 или example.com"></div>'+
 (selected==='test-netconnection'?'<div class="field"><label for="target-port">TCP порт (по избор)</label><input id="target-port" class="input mono" type="number" min="1" max="65535"></div>':'')+
 '</div>'+targetToolkitHelp(selected)+btn('Изпълни проверката','target-run','primary')+'</section>';
}
async function toolkitTargetRun(){
 const host=document.getElementById('target-host')?.value.trim()||'';
 const raw=document.getElementById('target-port')?.value.trim()||'';
 if(!host){toast('Въведи адрес.',true);return}
 if(raw&&(!/^\d+$/.test(raw)||Number(raw)<1||Number(raw)>65535)){toast('Невалиден TCP порт.',true);return}
 setBusy(true);
 try{
  state.toolkitResult=await api('/toolkit/target/'+(state.targetToolkitCommand||'ping'),'POST',{host,...(raw?{port:Number(raw)}:{})});
  state.snapshot=await api('/snapshot');toast('Резултатът е записан в журнала.');
 }catch(e){toast(e.message,true)}finally{setBusy(false)}
}
function toolkitView(){
 const a=state.toolkitCatalog||[],id=state.toolkitSelected||a[0]?.id,x=a.find(v=>v.id===id),v=state.toolkitResult;
 const level=state.toolkitLevel||'brief';
 return '<div class="view-header"><h2>Windows Network Toolkit</h2><p>Команди, разяснения и общ журнал на измерванията.</p></div>'+unavailable()+targetToolkitPanel()+
 '<section class="card gap-bottom">'+section('Мрежови инструменти','Предварително разрешени команди само за четене')+'<div class="toolbar-row">'+['brief','detail','expert'].map(v=>btn(v==='brief'?'Кратко':v==='detail'?'Подробно':'Експертно','toolkit-level-'+v,'small ghost')).join('')+'</div>'+
 '<div class="toolkit-groups">'+[
  ['IP конфигурация и адаптери',['ipconfig','ipaddresses','interfaces','adapters']],
  ['Маршрутизация и съседи',['routes','iproutes','neighbors','ipneighbors']],
  ['DNS диагностика',['dns','dnsservers']],
  ['TCP / UDP',['connections','tcpconnections','udpendpoints','stats']],
  ['Wi-Fi, статистика и сигурност',['wifi','adapterstats','firewall','profiles','services']]
 ].map(g=>'<div class="toolkit-group"><h3>'+esc(g[0])+'</h3><div class="toolkit-command-grid">'+g[1].map(key=>a.find(z=>z.id===key)).filter(Boolean).map(y=>'<button type="button" class="toolkit-command-button'+(id===y.id?' active':'')+'" data-action="toolkit-select-'+esc(y.id)+'" title="'+esc(y.command)+'">'+esc(y.command)+'</button>').join('')+'</div></div>').join('')+'</div>'+  
 (x?'<h3>'+esc(x.command)+'</h3><p>'+esc(x.description)+'</p>'+(level==='brief'?'':'<p><strong>Кога:</strong> '+esc(x.usage)+'</p><p><strong>Тълкуване:</strong> '+esc(x.interpretation)+'</p>')+(level==='expert'?toolkitExpertPanel(x):'')+btn('ИЗПЪЛНИ','toolkit-run','primary'):'Зареждане...')+
 '</section>'+(v?'<section class="card"><h3>Резултат · '+esc(v.status)+'</h3><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:450px;overflow:auto">'+esc(v.output)+'</pre><p>Записано в Отчети → история (TOOLKIT).</p></section>':'');
}
async function toolkitRun(){setBusy(true);try{state.toolkitResult=await api('/toolkit/run/'+(state.toolkitSelected||state.toolkitCatalog[0].id),'POST',{});state.snapshot=await api('/snapshot');toast('Резултатът е записан в отчета.')}catch(e){toast(e.message,true)}finally{setBusy(false)}}
function render(){
  if(!state.connected && state.view!=='settings' && state.view!=='dashboard')state.view='settings';
  updateLayout();
  const p={dashboard,scanner,tests:testsView,topology:topologyView,wifi:wifiView,reports,settings,toolkit:toolkitView};
  if(!state.connected && state.view==='dashboard'){
    $('#page-content').innerHTML='<section class="card"><h2>NETWORK INSPECTOR v2 — активиране</h2><p>Приложението е заредено. За да отключите мрежовите диагностики, изтеглете и разархивирайте Windows агента, стартирайте Start_Agent.bat и направете сдвояване с кода от прозореца на агента.</p><p><a class="button primary" href="./downloads/NetworkAgent-win-x64.zip" download="NetworkAgent-win-x64.zip">1. Изтегли Network Agent v2</a></p><p>2. Стартирайте Start_Agent.bat. 3. Отворете „Настройки и агент“ и въведете кода за сдвояване.</p><button class="button" type="button" data-action="open-activation-settings">Отвори настройките за активиране</button></section>';
    document.querySelector('[data-action="open-activation-settings"]').addEventListener('click',()=>nav('settings'));
    return;
  }
  $('#page-content').innerHTML=p[state.view]();
}
async function runAutoScan(){
 if(state.demo||!state.connected){toast('Нужен е свързан Windows агент.',true);return;}
 if(!$('#authorized')?.checked){toast('Потвърди разрешението за всички показани локални мрежи.',true);return;}
 const selected=[...document.querySelectorAll('.scope-choice:checked')].map(x=>x.value);
 if(!selected.length||selected.length>16){toast('Избери от 1 до 16 открити мрежи.',true);return;}
 const timeoutMs=Number($('#timeout')?.value||600);
 state.selectedCidrs=selected;state.selectionTouched=true;
 controller=new AbortController();setBusy(true);
 try{
   const res=await api('/scan/auto','POST',{timeoutMs,tcpFallback:true,authorized:true,confirmedCidrs:selected});
   state.snapshot.scan=res;state.selectedDevice=null;
   toast(`Сканирани ${res.scannedRanges?.length||0} локални обхвата: ${res.devices.length} открити устройства.`);
 }catch(e){toast(e.name==='AbortError'?'Автоматичното сканиране е прекратено.':'Автоматично сканиране: '+e.message,e.name!=='AbortError')}
 finally{controller=null;setBusy(false)}
}
async function discoverSnmpRoutes(){
 if(!state.connected||state.demo){toast('Необходим е свързан Windows агент.',true);return;}
 if(!$('#route-authorized')?.checked){toast('Потвърди разрешението за SNMP.',true);return;}
 const host=$('#route-host')?.value.trim()||'',community=$('#route-community')?.value||'',port=Number($('#route-port')?.value);
 if(!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)||!community||port<1||port>65535){toast('Въведи IP, community и валиден SNMP порт.',true);return;}
 setBusy(true);
 try{
   const result=await api('/scan/routes/snmp','POST',{host,community,port,timeoutMs:700,maxRows:15,authorized:true});
   state.autoScopes=result.discovery;
   state.selectedCidrs=state.selectedCidrs.filter(c=>state.autoScopes.scopes.some(s=>s.cidr===c&&s.selectable));
   toast(result.learned?('SNMP откри '+result.learned+' маршрута. Избери разрешените обхвати.'):result.warning,!result.learned);
 }catch(e){toast('SNMP откриване: '+e.message,true)}
 finally{setBusy(false)}
}
async function runNetworkDiscovery(){
 if(!state.connected){toast('Свържи агента.',true);return;}
 if(!$('#discovery-authorized')?.checked){toast('Потвърди разрешението за сканиране.',true);return;}
 const cidr=$('#discovery-cidr')?.value.trim()||'';
 state.discoveryCidr=cidr;
 setBusy(true);
 try {
  state.discoveryResult=await api('/discovery/network','POST',{cidr,authorized:true,tcpFallback:true,timeoutMs:600});
  state.topologyEvidence=state.discoveryResult.topology;
  state.universalInventory=state.discoveryResult.inventory;
  state.snapshot=await api('/snapshot');
  toast('Откриването завърши: '+state.discoveryResult.devices.length+' устройства.');
 } catch(e){toast('Discovery: '+e.message,true)}
 finally{setBusy(false)}
}
async function runScan(){if(state.demo){toast('Демо режимът не изпълнява мрежови сканирания.',true);return;}if(!state.connected){toast('Първо стартирай локалния агент.',true);return;}
 if(!$('#authorized')?.checked){toast('Потвърди разрешението за сканиране.',true);return;}
 const cidr=$('#cidr').value.trim();if(!/^\d{1,3}(\.\d{1,3}){3}\/(2[4-9]|3[0-2])$/.test(cidr)){toast('Разрешени са IPv4 мрежи /24 до /32.',true);return;}
 state.userCidr=true;state.scanCidr=cidr;const timeoutMs=Number($('#timeout').value);controller=new AbortController();setBusy(true);
 try{const res=await api('/scan','POST',{cidr,timeoutMs,tcpFallback:true,authorized:true});state.snapshot.scan=res;state.selectedDevice=null;toast(`Сканирането приключи: ${res.devices.length} открити устройства.`);}catch(e){toast('Сканиране: '+e.message,true)}finally{controller=null;setBusy(false)}}
async function runProfile(){
  if(state.demo||!state.connected){toast('Необходим е работещ Windows агент.',true);return;}
  const host=$('#profile-target')?.value.trim()||'',port=Number($('#profile-port')?.value);
  const url=$('#profile-url')?.value.trim()||'';
  if(!$('#profile-authorized')?.checked){toast('Потвърди разрешението за диагностика.',true);return;}
  if(!host || !Number.isInteger(port) || port<1 || port>65535){toast('Въведи валидна цел и TCP порт.',true);return;}
  state.profileTarget=host;state.profilePort=port;state.profileUrl=url;
  const request={host,port,url:url||null,checkDns:!!$('#profile-dns')?.checked,trace:!!$('#profile-trace')?.checked,authorized:true};
  controller=new AbortController();setBusy(true);
  try{
    state.lastProfile=await api('/profile','POST',request);
    const updated=await api('/snapshot');state.snapshot.tests=updated.tests;
    toast('Диагностичният профил приключи: '+state.lastProfile.status);
  }catch(e){if(e.name==='AbortError')toast('Профилът е прекратен.');else toast('Профил: '+e.message,true)}
  finally{controller=null;setBusy(false);}
}
async function runMonitor(){
 if(state.demo||!state.connected){toast('За теста е необходим работещ Windows агент.',true);return;}
 if(!$('#monitor-authorized')?.checked){toast('Потвърди разрешението за измерване.',true);return;}
 const host=$('#monitor-target')?.value.trim()||'',count=Number($('#monitor-count')?.value),intervalMs=Number($('#monitor-interval')?.value),
 maxLossPct=Number($('#monitor-loss')?.value),maxAvgRttMs=Number($('#monitor-rtt')?.value);
 if(!host||!Number.isInteger(count)||count<2||count>30||![500,1000,2000,5000].includes(intervalMs)||
   !Number.isFinite(maxLossPct)||maxLossPct<0||maxLossPct>100||!Number.isFinite(maxAvgRttMs)||maxAvgRttMs<1||maxAvgRttMs>5000){
   toast('Некоректни параметри: 2–30 проби, 0–100% загуби, RTT праг 1–5000 ms.',true);return;
 }
 Object.assign(state,{monitorTarget:host,monitorCount:count,monitorInterval:intervalMs,monitorLoss:maxLossPct,monitorRtt:maxAvgRttMs});
 controller=new AbortController();setBusy(true);
 try{
   state.lastMonitor=await api('/monitor','POST',{host,count,intervalMs,timeoutMs:800,maxLossPct,maxAvgRttMs,authorized:true});
   const snapshot=await api('/snapshot');state.snapshot.tests=snapshot.tests;
   toast('Мониторингов тест: '+state.lastMonitor.status);
 }catch(e){toast(e.name==='AbortError'?'Тестът е прекратен без частичен отчет.':'Мониторинг: '+e.message,e.name!=='AbortError')}
 finally{controller=null;setBusy(false)}
}
async function runSnmp(){
 if(state.demo||!state.connected){toast('Необходим е локален Windows агент.',true);return;}
 if(!$('#snmp-authorized')?.checked){toast('Потвърди разрешението за SNMP достъп.',true);return;}
 const host=$('#snmp-target')?.value.trim()||'', community=$('#snmp-community')?.value||'';
 const port=Number($('#snmp-port')?.value),maxRows=Number($('#snmp-rows')?.value);
 if(!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)||!community||!Number.isInteger(port)||port<1||port>65535){toast('Въведи IPv4 адрес, community и валиден порт.',true);return;}
 state.snmpTarget=host;
 controller=new AbortController();setBusy(true);
 try{
   state.lastSnmp=await api('/snmp','POST',{host,community,port,maxRows,timeoutMs:700,authorized:true});
   const [updated,topology]=await Promise.all([api('/snapshot'),api('/topology')]);state.snapshot.tests=updated.tests;state.topologyEvidence=topology;
   toast('SNMP инспекция: '+state.lastSnmp.status);
 }catch(e){toast('SNMP: '+e.message,true)}finally{controller=null;setBusy(false)}
}
async function runTest(){if(state.activeTest==='ethernet')return ethernetStart();if(state.activeTest==='speedtest')return runSpeedtest();if(state.activeTest==='snmp')return runSnmp();if(state.activeTest==='profile')return runProfile();if(state.activeTest==='monitor')return runMonitor();if(state.demo||!state.connected){toast('За реален тест е необходим работещ агент.',true);return;}state.testHost=$('#testhost')?.value.trim();if(!state.testHost){toast('Въведи целеви хост.',true);return;}
const pingCount=Number($('#pingcount')?.value||4),tcpPort=Number($('#port')?.value||443);controller=new AbortController();setBusy(true);try{let path,body;switch(state.activeTest){case 'ping':path='/ping';body={host:state.testHost,count:pingCount,intervalMs:Number($('#pinginterval')?.value||1000),timeoutMs:Number($('#pingtimeout')?.value||1200)};break;case 'tcp':path='/tcp';body={host:state.testHost,port:tcpPort};break;case 'udp':path='/udp';body={host:state.testHost,port:tcpPort};break;case 'traceroute':path='/traceroute';body={host:state.testHost,maxHops:Number($('#hops')?.value||20)};break;case 'http':path='/http';body={url:state.testHost};break;default:path='/dns';body={host:state.testHost};}
state.lastTest=await api(path,'POST',body);const updated=await api('/snapshot');state.snapshot.tests=updated.tests;toast('Диагностичната проверка приключи.');}catch(e){toast('Тест: '+e.message,true)}finally{controller=null;setBusy(false)}}
async function runWifi(){try{state.wifiAdapters=await api('/wifi/adapters')}catch(e){state.wifiAdapters=[];}if(state.demo||!state.connected){toast('За Wi-Fi измервания е необходим Windows агент.',true);return;}setBusy(true);try{state.snapshot.wifi=await api('/wifi','POST',{});toast(`Открити BSSID: ${state.snapshot.wifi.networks.length}`);}catch(e){toast('Wi-Fi: '+e.message,true)}finally{setBusy(false)}}
function download(name,content,type='text/plain;charset=utf-8'){const blob=content instanceof Blob?content:new Blob([content],{type});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),15000)}
function makeXml(){const devices=state.snapshot.scan?.devices||[],cidr=state.snapshot.scan?.cidr||'Unscanned network';const cell=(id,val,x,y,w,h,style)=>`<mxCell id="${esc(id)}" value="${esc(val)}" style="${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
let body=cell('subnet','IP subnet: '+cidr,350,60,230,75,'rounded=1;whiteSpace=wrap;html=0;fillColor=#24547e;fontColor=#ffffff;strokeColor=#5c9ed6;');const cols=4;
devices.forEach((d,i)=>{const x=60+(i%cols)*230,y=230+Math.floor(i/cols)*105;body+=cell('dev'+i,(d.name?d.name+'\n':'')+d.ip,x,y,185,57,'rounded=1;whiteSpace=wrap;html=0;fillColor=#19324a;fontColor=#ffffff;strokeColor=#4d7596;');body+=`<mxCell id="edge${i}" style="dashed=1;endArrow=none;strokeColor=#8a99ab;" edge="1" parent="1" source="subnet" target="dev${i}"><mxGeometry relative="1" as="geometry"/></mxCell>`});
return `<?xml version="1.0" encoding="UTF-8"?><mxfile host="network-inspector" modified="${new Date().toISOString()}" agent="NETWORK INSPECTOR" version="1.0"><diagram name="Logical IP topology"><mxGraphModel dx="1000" dy="800" grid="1" gridSize="10" page="1" pageScale="1" pageWidth="1654" pageHeight="1169"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${body}</root></mxGraphModel></diagram></mxfile>`;}
function evidenceSvgExport(){
 const container=document.createElement('div');container.innerHTML=evidenceGraph();
 const svg=container.querySelector('svg');
 if(!svg)throw new Error('Няма LLDP доказателства за SVG експорт.');
 const style=document.createElementNS('http://www.w3.org/2000/svg','style');
 style.textContent='.topology-label{font:600 12px sans-serif;fill:#edf7ff}.topology-sub{font:10px sans-serif;fill:#aec5e0}';
 svg.insertBefore(style,svg.firstChild);return new XMLSerializer().serializeToString(svg);
}
function evidenceDrawio(){
 const t=state.topologyEvidence||{nodes:[],edges:[]};
 if(!t.edges?.length)throw new Error('Няма LLDP доказателства за DRAWIO експорт.');
 const nodes=t.nodes||[], ids=new Map(nodes.map((n,i)=>[n.id,'n'+i]));
 const v=(id,value,x,y,fill)=>`<mxCell id="${id}" value="${esc(value)}" style="rounded=1;whiteSpace=wrap;html=0;fillColor=${fill};fontColor=#ffffff;strokeColor=#6588a1;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="220" height="58" as="geometry"/></mxCell>`;
 let body=''; const positionMap=new Map();const sources=nodes.filter(n=>n.kind==='INSPECTED'),neighbors=nodes.filter(n=>n.kind!=='INSPECTED');
 sources.forEach((n,i)=>body+=v(ids.get(n.id),`${n.label}\n${n.ip||''}`,50,130+i*110,'#28577a'));
 neighbors.forEach((n,i)=>body+=v(ids.get(n.id),`${n.label}\n${n.chassisId||'unresolved identity'}`,580,130+i*110,'#4b4950'));
 t.edges.forEach((e,i)=>{
  const x=ids.get(e.sourceId),y=ids.get(e.targetId);if(!x||!y)return;
  const label=`LLDP ${e.confidence}\n${e.localPortIndex} → ${e.remotePortId||'?'}\n${e.observedAt}`;
  body+=`<mxCell id="e${i}" value="${esc(label)}" edge="1" parent="1" source="${x}" target="${y}" style="html=0;endArrow=none;dashed=${e.confidence==='RECIPROCAL_LLDP'?'0':'1'};strokeColor=#baa864;fontColor=#7288a1;"><mxGeometry relative="1" as="geometry"/></mxCell>`;
 });
 return `<?xml version="1.0" encoding="UTF-8"?><mxfile host="network-inspector" agent="NETWORK INSPECTOR" version="1.0"><diagram name="SNMP LLDP evidence - NOT cabling certification"><mxGraphModel dx="1000" dy="800" grid="1" page="1"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${body}</root></mxGraphModel></diagram></mxfile>`;
}
function svgExport(){const div=document.createElement('div');div.innerHTML=topologySvg(true);const svg=div.querySelector('svg');const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent='.topology-label{font:600 11px sans-serif;fill:#edf7ff}.topology-sub{font:10px sans-serif;fill:#aec5e0}';svg.insertBefore(style,svg.firstChild);return new XMLSerializer().serializeToString(svg)}
function snapshotData(){return {...state.snapshot,exportedAt:new Date().toISOString(),dataKind:state.demo?'DEMONSTRATION':'REAL_SESSION',topologyNote:'IP subnet membership is logical; LLDP advertisements are not physical cable certifications.',topologyEvidence:state.topologyEvidence};}
function htmlReport(){const s=snapshotData(),ds=s.scan?.devices||[],ts=s.tests||[],wf=s.wifi?.networks||[];
const rows=(heads,items)=>`<table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${items.map(row=>`<tr>${row.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const profiles=ts.filter(t=>t.type==='PROFILE'&&t.data?.checks?.length);
const profileDetails=profiles.map(p=>`<h3>Диагностичен профил: ${esc(p.target)} · ${esc(p.status)}</h3>`+rows(['Проверка','Цел','Статус','Детайли'],p.data.checks.map(c=>[c.name,c.target,c.status,c.detail]))).join('');
const monitorDetails=ts.filter(t=>t.type==='MONITOR'&&t.data?.samples?.length).map(t=>`<h3>Стабилност: ${esc(t.target)} · ${esc(t.status)}</h3>`+rows(['№','Време','Отговор','RTT ms','Основание'],t.data.samples.map(s=>[s.sequence,s.at,s.success?'REPLY':'NO REPLY',s.rttMs??'—',s.error||'ICMP echo']))).join('');
const diagram=svgExport().replace(/<\?xml[^>]*>/,'');const topo=state.topologyEvidence||{edges:[],warnings:[]};return `<!doctype html><html lang="bg"><head><meta charset="utf-8"><title>NETWORK INSPECTOR Report</title><style>body{font:13px Arial,sans-serif;color:#203044;max-width:1100px;margin:30px auto;padding:10px}h1{color:#133e69}h2{margin:30px 0 10px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccd4df;padding:7px;text-align:left}th{background:#e5eff9}svg{max-width:100%;height:400px;background:#183149}button{padding:12px;border:1px solid #ccc;border-radius:6px}@media print{button{display:none}body{margin:5mm}}</style></head><body><h1>NETWORK INSPECTOR</h1><p>Технически отчет · ${esc(fmtTime(new Date()))} · ${s.dataKind==='DEMONSTRATION'?'ДЕМО ДАННИ — НЯМА РЕАЛНО ИЗМЕРВАНЕ':'РЕАЛНА СЕСИЯ'}</p><button onclick="window.print()">Печат / Запази като PDF</button><h2>Логическа топология</h2><p>Пунктираните връзки показват принадлежност към IP подмрежа. Не са доказани физически кабелни връзки.</p>${diagram}<h2>LLDP наблюдения (${topo.edges.length})</h2><p>SNMP LLDP-MIB съобщения. Не доказват кабели; FDB/VLAN не са използвани за автоматични връзки.</p>${rows(['Източник','Локален порт','Съсед','Далечен порт','Статус','Наблюдение UTC'],topo.edges.map(e=>[e.sourceIp,e.localPortIndex,e.remoteName||e.remoteChassisId,e.remotePortId,e.confidence,e.observedAt]))}<h2>Устройства (${ds.length})</h2>${rows(['IP','Име','MAC адрес','RTT ms','TCP портове'],ds.map(d=>[d.ip,d.name,d.mac||'—',d.rttMs??'—',(d.openPorts||[]).join(',')]))}<h2>Wi-Fi (${wf.length})</h2>${rows(['SSID','BSSID','RSSI','Channel'],wf.map(d=>[d.ssid,d.bssid,d.rssiDbm??'—',d.channel??'—']))}<h2>Диагностични тестове (${ts.length})</h2>${rows(['Тип','Цел','Статус','Резултат'],ts.map(d=>[d.type,d.target,d.status,d.summary]))}${profileDetails}${monitorDetails}<p><small>Генерирано локално. Не са приложени контролни методики за сертификация на кабелни или безжични трасета.</small></p></body></html>`;}
function csv(){const arr=[['IP','Hostname','MAC','ICMP','RTT_ms','Open_TCP_Ports','Source']];for(const d of state.snapshot.scan?.devices||[])arr.push([d.ip,d.name,d.mac||'',d.ping,d.rttMs??'',(d.openPorts||[]).join('|'),d.source]);return '\ufeff'+arr.map(row=>row.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\r\n')}
async function exportAction(action){if(action==='xlsx'){if(!state.connected||state.demo){toast('XLSX експортът изисква стартиран агент и реална сесия.',true);return;}const res=await fetch(agentApi('/api/export/xlsx'),{headers:{'X-Agent-Token':state.token||''},cache:'no-store'});if(!res.ok)throw new Error('Неуспешен XLSX експорт');download('NetworkInspector_Results.xlsx',await res.blob());return;}
if(action==='bundle'){if(!state.connected||state.demo){toast('Пълният ZIP архив изисква реална сесия.',true);return;}const res=await fetch(agentApi('/api/export/bundle'),{headers:{'X-Agent-Token':state.token||''},cache:'no-store'});if(!res.ok)throw new Error('Неуспешен ZIP архив');download('NetworkInspector_Complete_Report.zip',await res.blob());return;}
if(action==='json')download('NetworkInspector_Snapshot.json',JSON.stringify(snapshotData(),null,2),'application/json');
if(action==='csv')download('NetworkInspector_Devices.csv',csv(),'text/csv;charset=utf-8');
if(action==='svg')download('NetworkInspector_Topology.svg',svgExport(),'image/svg+xml');
if(action==='evidence-svg')download('NetworkInspector_LLDP_Evidence.svg',evidenceSvgExport(),'image/svg+xml');
if(action==='evidence-drawio')download('NetworkInspector_LLDP_Evidence.drawio',evidenceDrawio(),'application/xml');
if(action==='drawio')download('NetworkInspector_Topology.drawio',makeXml(),'application/xml');
if(action==='html')download('NetworkInspector_Report.html',htmlReport(),'text/html;charset=utf-8');}
document.addEventListener('click',async e=>{const link=e.target.closest('[data-nav]');if(link){nav(link.dataset.nav);return;}
const node=e.target.closest('[data-node]');if(node){state.selectedDevice=node.dataset.node;render();return;}
const btnEl=e.target.closest('[data-action]');if(!btnEl||state.busy && !['abort'].includes(btnEl.dataset.action))return;
const action=btnEl.dataset.action;
if(titles[action]){nav(action);return;}
if(action.startsWith('toolkit-level-')){state.toolkitLevel=action.slice(14);render();return;}if(action.startsWith('toolkit-select-')){state.toolkitSelected=action.slice(15);state.toolkitResult=null;render();return;}if(action.startsWith('testtype-')){state.testHost=$('#testhost')?.value||state.testHost;if(state.activeTest==='profile'){state.profileTarget=$('#profile-target')?.value||state.profileTarget;state.profilePort=Number($('#profile-port')?.value)||state.profilePort;state.profileUrl=$('#profile-url')?.value||'';}if(state.activeTest==='monitor'){state.monitorTarget=$('#monitor-target')?.value||state.monitorTarget;}state.activeTest=action.slice(9);render();if(state.activeTest==='ethernet')await ethernetSetup();return;}
if(action.startsWith('target-level-')){state.targetToolkitLevel=action.slice(13);render();return;}
if(action.startsWith('target-select-')){state.targetToolkitCommand=action.slice(14);render();return;}try{switch(action){case 'network-map-export':exportNetworkMap();break;case 'toolkit-export-html':exportToolkit('html');break;case 'toolkit-export-json':exportToolkit('json');break;case 'target-run':await toolkitTargetRun();break;case 'toolkit-run':await toolkitRun();break;case 'scan':await runScan();break;case 'scan-auto':await runAutoScan();break;case 'routes-snmp':await discoverSnmpRoutes();break;case 'pair-agent':await pairAgent();break;case 'discovery-run':await runNetworkDiscovery();break;case 'run-test':await runTest();break;case 'speedtest-start':await runSpeedtest();break;case 'scan-wifi':await runWifi();break;case 'topology-refresh':if(state.connected){state.topologyEvidence=await api('/topology');render();toast('LLDP наблюденията са обновени.')}else toast('Необходим е сдвоен агент.',true);break;case 'abort':controller?.abort();toast('Заявката е прекратена.');break;case 'check-agent':await checkAgent();toast(state.connected?'Локалният агент е достъпен.':'Локалният агент не е достъпен.',!state.connected);break;case 'zoom-in':state.scale=Math.min(2,Number((state.scale+.2).toFixed(2)));render();break;case 'zoom-out':state.scale=Math.max(.5,Number((state.scale-.2).toFixed(2)));render();break;case 'theme':state.theme=state.theme==='dark'?'light':'dark';try{localStorage.setItem('netpro-theme',state.theme)}catch{}render();break;default:if(['xlsx','bundle','json','csv','svg','drawio','html','evidence-svg','evidence-drawio'].includes(action))await exportAction(action);}}catch(err){toast(err.message,true)} });
$('#nav').addEventListener('click',e=>{const nav=e.target.closest('[data-view]');if(nav)window.scrollTo(0,0),window.requestAnimationFrame(()=>window.scrollTo(0,0)),navView(nav.dataset.view)});
function navView(v){nav(v)}
$('.sidebar-bottom').addEventListener('click',e=>{const n=e.target.closest('[data-view]');if(n)nav(n.dataset.view)});
document.getElementById('open-guide').addEventListener('click',()=>{
  const dialog=document.getElementById('guide-dialog');
  const frame=dialog.querySelector('iframe');
  frame.src='./guide.html?view='+Date.now();
  dialog.showModal();
});
document.getElementById('close-guide').addEventListener('click',()=>document.getElementById('guide-dialog').close());
$('#refresh-button').addEventListener('click',async()=>{await checkAgent();toast(state.connected?'Агентът е активен.':'Няма връзка с агента.',!state.connected)});

$('#mobile-menu').addEventListener('click',()=>$('#sidebar').classList.add('open'));
$('#nav-close').addEventListener('click',()=>$('#sidebar').classList.remove('open'));
$('#page-content').addEventListener('change',e=>{if(e.target.id==='cidr'){state.scanCidr=e.target.value;state.userCidr=true;}if(e.target.classList?.contains('scope-choice')){state.selectedCidrs=[...document.querySelectorAll('.scope-choice:checked')].map(x=>x.value);state.selectionTouched=true;}});

if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{});}
// Keep separately opened same-origin PWA tabs synchronized without persisting the agent token.
const agentChannel=typeof BroadcastChannel==='function'?new BroadcastChannel('ni-v2-agent-session'):null;
if(agentChannel){
  agentChannel.onmessage=async ({data})=>{
    if(data?.type==='request' && state.connected && state.token)
      agentChannel.postMessage({type:'session',token:state.token});
    if(data?.type==='session' && !state.connected && /^[A-F0-9]{64}$/.test(data.token||'')){
      state.token=data.token;
      try{sessionStorage.setItem('netpro-agent-token',data.token);localStorage.setItem('ni-v2-agent-token',data.token)}catch{}
      await checkAgent();
    }
  };
}
// Consume the fragment immediately, before network requests or other app initialization.
async function activateFromLaunch(){
  const fragment=location.hash.match(/^#ni-auto=([0-9A-Fa-f]{64})$/);
  if(!fragment){await checkAgent();if(!state.connected)agentChannel?.postMessage({type:'request'});return;}
  history.replaceState(null,'',location.pathname+location.search);
  try{
    const result=await api('/auto-pair','POST',{secret:fragment[1]});
    if(!/^[A-F0-9]{64}$/.test(result.token||''))throw new Error('Invalid session token');
    state.token=result.token;
    try{sessionStorage.setItem('netpro-agent-token',result.token);localStorage.setItem('ni-v2-agent-token',result.token)}catch{}
    await checkAgent();
    if(state.connected){state.view='dashboard';render();agentChannel?.postMessage({type:'session',token:state.token});}
    else toast('Agent authentication incomplete.',true);
  }catch(e){await checkAgent();toast('Automatic pairing failed: '+e.message,true);}
}
render();activateFromLaunch();