/* Vector Studio — browser-first editor. External libraries load from pinned CDNs. */
(()=>{'use strict';
const $=id=>document.getElementById(id), uid=()=>`id_${Math.random().toString(36).slice(2,11)}`, deep=x=>JSON.parse(JSON.stringify(x));
const formats={A0:[3179,4494],A1:[2245,3179],A2:[1587,2245],A3:[1123,1587],A4:[794,1123],A5:[559,794],Letter:[816,1056]};
const state={pages:[],page:0,tool:'select',zoom:0.72,activeLayer:null,history:[],future:[],busy:false,assets:{},sourceFiles:[],filename:'Без име.vstudio',counter:0,draw:null,pageHistories:new Map()};let canvas;
function requireLib(name){if(!window[name])throw Error(`Библиотеката ${name} не е заредена. Необходима е интернет връзка за първоначално зареждане.`);return window[name]}
function status(t){$('status').textContent=t}function notify(title,msg){$('modalTitle').textContent=title;$('modalBody').textContent=msg;$('modal').showModal();}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)}
// Native folder/file selection where supported; downloads remain the browser-safe fallback.
let projectFileHandle=null;
const fileTypes={vstudio:'application/zip',pdf:'application/pdf',svg:'image/svg+xml',dxf:'application/dxf',png:'image/png',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',csv:'text/csv'};
async function writeFileToDestination(blob,name,extension,{project=false,forcePicker=false}={}){
 const type=fileTypes[extension]||'application/octet-stream';
 if(!forcePicker&&project&&projectFileHandle){
   const stream=await projectFileHandle.createWritable();await stream.write(blob);await stream.close();
   status('Записано: '+projectFileHandle.name);return true;
 }
 if(typeof window.showSaveFilePicker==='function'&&window.isSecureContext){
   try{
     const handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:extension.toUpperCase()+' файл',accept:{[type]:['.'+extension]}}]});
     const stream=await handle.createWritable();await stream.write(blob);await stream.close();
     if(project){projectFileHandle=handle;state.filename=handle.name;}
     status('Записано: '+handle.name);return true;
   }catch(e){if(e?.name==='AbortError')return false;throw e;}
 }
 // Firefox, unsupported browsers, file:// and insecure contexts: Download folder is controlled by browser settings.
 download(blob,name);status('Файлът е изтеглен. Местоположението се определя от браузъра.');return true;
}
function dataToBlob(data){return fetch(data).then(r=>r.blob())}
function layerTemplate(name='Слой'){return{id:uid(),name,visible:true,locked:false,opacity:1}}
function pageTemplate(label='Страница 1',format='A4',orientation='portrait'){const [a,b]=formats[format];return{id:uid(),name:label,format,orientation,width:orientation==='landscape'?b:a,height:orientation==='landscape'?a:b,layers:[layerTemplate('Основен слой')],objects:[],units:'mm',background:'#ffffff',transparentBackground:false}}
const page=()=>state.pages[state.page];const layer=id=>page().layers.find(l=>l.id===id);const selected=()=>canvas.getActiveObject();const objectLayer=o=>layer(o?.layerId);const list=()=>canvas.getObjects();
function serialize(){return{app:'Vector Studio',schemaVersion:1,filename:state.filename,createdAt:state.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),pages:state.pages.map((p,i)=>({...p,objects:i===state.page?objectsJSON():p.objects})),assets:state.assets,sourceFiles:state.sourceFiles}}
// Exportable CAD geometry is derived from the current Fabric transform at serialization time.
// Never trust historical cadEndpoints/cadCenter: they become stale after moving/scaling/rotating.
function cadGeometry(o){
  if(!['line','circle'].includes(o.type))return null;
  const matrix=o.calcTransformMatrix(), point=(x,y)=>fabric.util.transformPoint(new fabric.Point(x,y),matrix);
  if(o.type==='line'){
    const p=o.calcLinePoints(), a=point(p.x1,p.y1),b=point(p.x2,p.y2);
    return {kind:'LINE',x1:a.x,y1:a.y,x2:b.x,y2:b.y};
  }
  // A nonuniformly scaled circle is an ellipse, not a CIRCLE. Fail export rather than distort it.
  const c=point(0,0),x=point(o.radius,0),y=point(0,o.radius);
  const rx=Math.hypot(x.x-c.x,x.y-c.y),ry=Math.hypot(y.x-c.x,y.y-c.y);
  const dot=(x.x-c.x)*(y.x-c.x)+(x.y-c.y)*(y.y-c.y);
  if(!Number.isFinite(rx)||!Number.isFinite(ry)||rx<=0||ry<=0||
     Math.abs(rx-ry)>1e-7*Math.max(rx,ry)||Math.abs(dot)>1e-7*rx*ry)
    return {kind:'UNSUPPORTED_ELLIPSE'};
  return {kind:'CIRCLE',x:c.x,y:c.y,radius:(rx+ry)/2};
}
function objectsJSON(){return list().map(o=>{
  const json=o.toObject(['uid','layerId','itemType','itemName','countable','symbolCode','qty','objectOpacity','vsBaseFill','vsShadowStyle','vsEffectParams','vsTransparencyGradient','vsSymbolMasterId']);
  const geometry=cadGeometry(o);
  if(geometry)json.cadGeometry=geometry;
  return json;
})}
function hydrateMeta(o){o.uid=o.uid||uid();o.layerId=o.layerId||state.activeLayer;o.itemType=o.itemType||o.type;o.itemName=o.itemName||({'i-text':'Текст',textbox:'Текст',rect:'Правоъгълник',ellipse:'Елипса',line:'Линия',triangle:'Триъгълник',path:'Крива',image:'Изображение',group:'Група'}[o.type]||o.type);o.countable=o.countable===undefined?(o.itemType==='symbol'||o.type==='symbol'):o.countable!==false;o.qty=Number.isFinite(+o.qty)?+o.qty:1;if(o.objectOpacity===undefined||o.objectOpacity===null){const alpha=Number(o.opacity),layerAlpha=objectLayer(o)?.opacity??1;o.objectOpacity=Number.isFinite(alpha)&&layerAlpha>0?Math.max(0,Math.min(1,alpha/layerAlpha)):1;}return o}
function add(o,name){hydrateMeta(o);if(name)o.itemName=name;const l=objectLayer(o);o.set({opacity:(l?.opacity??1)*(o.objectOpacity??1),visible:l?.visible!==false});o.dirty=true;canvas.add(o);canvas.setActiveObject(o);canvas.requestRenderAll();if(!(['rect','ellipse','line','arrow'].includes(state.tool)&&['rect','ellipse','line'].includes(o.type)))commit();return o}
function storeCurrent(){if(page())page().objects=objectsJSON()}
async function displayPage(i,skipStore=false){if(i<0||i>=state.pages.length)return;if(!skipStore)storeCurrent();state.busy=true;state.page=i;const p=page();state.activeLayer=p.layers[0]?.id||null;canvas.clear();canvas.setBackgroundColor(p.transparentBackground?'rgba(0,0,0,0)':(p.background||'#ffffff'),()=>{});canvas.setDimensions({width:p.width,height:p.height});try{await new Promise((resolve,reject)=>canvas.loadFromJSON({objects:p.objects||[]},()=>resolve(),(obj,inst)=>hydrateMeta(inst)))}catch(e){notify('Грешка при отваряне на страница',e.message)}canvas.getObjects().forEach(o=>hydrateMeta(o));applyLayers();setZoom(state.zoom);$('paper').value=p.format;$('orientation').value=p.orientation;state.busy=false;const h=pageHistory();if(h&&!h.past.length)h.past.push(snapshot());state.history=h?.past||[];state.future=h?.future||[];renderAll()}
function renderPages(){const root=$('pagesList');if(!root)return;root.replaceChildren();state.pages.forEach((p,i)=>{const row=document.createElement('div');row.className='page-entry'+(i===state.page?' active':'');const title=document.createElement('span');title.className='page-entry-name';title.textContent=`${i+1}. ${p.name}`;const meta=document.createElement('span');meta.className='page-entry-meta';meta.textContent=p.format;row.append(title,meta);row.onclick=()=>displayPage(i);row.ondblclick=()=>{if(i===state.page)renamePage()};root.append(row)})}
function refreshPageOptions(){const s=$('pageSelect');s.innerHTML='';state.pages.forEach((p,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`${i+1}. ${p.name}`;s.append(option)});s.value=state.page}
function applyLayers(){const layerLookup=new Map((page()?.layers||[]).map(l=>[l.id,l]));for(const o of list()){const l=layerLookup.get(o.layerId);o.visible=l?.visible!==false;o.selectable=state.tool==='select'&&l?.locked!==true&&l?.visible!==false;o.evented=o.selectable;o.set('opacity',(l?.opacity??1)*(o.objectOpacity??1));o.dirty=true;}canvas.discardActiveObject();canvas.requestRenderAll()}
function setZoom(z){state.zoom=Math.max(.15,Math.min(2,z));const p=page();if(!p)return;canvas.setZoom(state.zoom);canvas.setDimensions({width:p.width*state.zoom,height:p.height*state.zoom});$('zoomLabel').textContent=Math.round(state.zoom*100)+'%';$('paperWrap').style.width=(p.width*state.zoom)+'px';$('paperWrap').style.height=(p.height*state.zoom)+'px';canvas.calcOffset();updateGrid();renderGuides();drawRulers();canvas.requestRenderAll()}
function fit(){const area=$('scrollArea'),p=page();setZoom(Math.min(.98,(area.clientWidth-90)/p.width,(area.clientHeight-85)/p.height))}
// AutoCAD-style wheel zoom: preserve the document point beneath the cursor.
function setupWheelZoom(){
 const area=$('scrollArea');
 area.addEventListener('wheel',e=>{
  if(!page()||!canvas)return;
  e.preventDefault();
  const before=$('paperWrap').getBoundingClientRect();
  const oldZoom=state.zoom;
  const x=(e.clientX-before.left)/oldZoom;
  const y=(e.clientY-before.top)/oldZoom;
  // Normalize wheel steps; both mouse wheels and trackpads are supported.
  const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?area.clientHeight:1);
  const factor=Math.exp(-Math.max(-180,Math.min(180,pixels))*0.0015);
  const next=Math.max(.15,Math.min(2,oldZoom*factor));
  if(Math.abs(next-oldZoom)<1e-9)return;
  setZoom(next);
  const after=$('paperWrap').getBoundingClientRect();
  area.scrollLeft+=x*next+after.left-e.clientX;
  area.scrollTop+=y*next+after.top-e.clientY;
  drawRulers();
 },{passive:false});
}

// One owner for all right-hand tabs; avoids competing listeners from the element library.
function showSidebarPanel(name){
 const allowed=new Set(['pages','layers','objects','quantity','properties','elements']);
 if(!allowed.has(name))return;
 document.querySelectorAll('.sidebar .tabs button').forEach(button=>{
  const selected=(button.dataset.tab|| (button.id==='vsElementsTab'?'elements':''))===name;
  button.classList.toggle('active',selected);
  button.setAttribute('aria-selected',String(selected));
 });
 document.querySelectorAll('.sidebar .panel').forEach(panel=>{
  const selected=(name==='elements'?'vsElementsPanel':name+'Panel')===panel.id;
  panel.classList.toggle('hidden',!selected);
 });
 if(name==='quantity')renderQuantities();
}
window.VectorStudioShowSidebarPanel=showSidebarPanel;
// One quantity report is shared by the sidebar and both file exporters.
// Only explicit countable objects contribute to the equipment schedule.
function quantityEligible(o){return quantityEligibleWithOptions(o);}
function quantityEligibleWithOptions(o, options={}){
 if(!o || typeof o!=='object')return false;
 const {includeExcluded=false,visibleOnly=false,currentLayerOnly=false,pageData=page()}=options;
 const layerData=options.layerLookup?options.layerLookup.get(o.layerId):pageData?.layers?.find(l=>l.id===o.layerId);
 return (o.countable!==false || includeExcluded) &&
  !(visibleOnly && (layerData?.visible===false || o.visible===false)) &&
  !(currentLayerOnly && o.layerId!==state.activeLayer);
}
function quantityAmount(o){const n=Number(o.qty);return o.qty===undefined||o.qty===null||o.qty===''||!Number.isFinite(n)||n<0?1:n;}
// UI filters are display-only; exports always include all countable equipment across pages.
function quantityReport(options={}){
 const forExport=options.forExport===true;
 const includeExcluded=!forExport && ($('countIncludeExcluded')?.checked===true);
 const visibleOnly=!forExport && ($('countVisible')?.checked===true);
 const currentLayerOnly=!forExport && ($('countCurrent')?.checked===true);
 const currentOnly=!forExport;
 const aggregate=new Map(),perLayer=new Map();let excluded=0;
 const currentPage=typeof page==='function'?page():state.pages?.[state.page]||{id:'current',name:'Страница',layers:[]};
 const pages=currentOnly||!Array.isArray(state.pages)?[{data:currentPage,objects:list()}]:state.pages.map((p,i)=>({data:p,objects:i===state.page?list():p.objects||[]}));
 for(const entry of pages){
  const p=entry.data;if(!p)continue;
  const layerLookup=new Map((p.layers||[]).map(l=>[l.id,l]));
  const eligibility={includeExcluded,visibleOnly,currentLayerOnly,pageData:p,layerLookup};
  for(const o of entry.objects){
   if(!o || typeof o!=='object')continue;
   if(o.countable===false)excluded++;
   if(!quantityEligibleWithOptions(o,eligibility))continue;
   const name=String(o.itemName||o.itemType||o.type||'Обект').trim()||'Обект';
   const layerData=layerLookup.get(o.layerId);
   const layerName=layerData?.name||'Без слой';
   const key=p.id+'\u0000'+(layerData?.id||'')+'\u0000'+name;
   const total=aggregate.get(name)||{name,count:0,quantity:0};
   total.count++;total.quantity+=quantityAmount(o);aggregate.set(name,total);
   const detail=perLayer.get(key)||{page:p.name||'Страница',layer:layerName,name,count:0,quantity:0};
   detail.count++;detail.quantity+=quantityAmount(o);perLayer.set(key,detail);
  }
 }
 const rows=[...aggregate.values()].sort((a,b)=>a.name.localeCompare(b.name,'bg'));
 const details=[...perLayer.values()].sort((a,b)=>a.page.localeCompare(b.page,'bg')||a.layer.localeCompare(b.layer,'bg')||a.name.localeCompare(b.name,'bg'));
 return {rows,details,totalCount:rows.reduce((n,r)=>n+r.count,0),totalQuantity:rows.reduce((n,r)=>n+r.quantity,0),excluded};
}
function countRows(){return quantityReport().rows.map(r=>[r.name,r.quantity,r.count]);}
function setSelectedCountable(value){
 const active=selected();if(!active)return;
 const objects=active.type==='activeSelection'?active.getObjects():[active];
 objects.forEach(o=>{o.countable=value;if(value&&(!Number.isFinite(+o.qty)||+o.qty<=0))o.qty=1;});
 commit();showSidebarPanel('quantity');
}

function renderLayers(){const root=$('layersList');root.innerHTML='';[...page().layers].reverse().forEach(l=>{const row=document.createElement('div');row.className='layer'+(l.id===state.activeLayer?' active':'');const count=list().filter(o=>o.layerId===l.id).length;row.innerHTML=`<span class="layer-name"></span><span class="count">${count}</span><button class="eye" title="Видимост">${l.visible?'👁':'◌'}</button><button class="lock" title="Заключване">${l.locked?'🔒':'🔓'}</button>`;row.querySelector('.layer-name').textContent=l.name;row.onclick=()=>{state.activeLayer=l.id;canvas.discardActiveObject();renderAll()};row.querySelector('.eye').onclick=e=>{e.stopPropagation();l.visible=!l.visible;applyLayers();commit()};row.querySelector('.lock').onclick=e=>{e.stopPropagation();l.locked=!l.locked;applyLayers();commit()};root.append(row);const controls=document.createElement('div');controls.className='layer-opacity';const caption=document.createElement('label');caption.textContent='\u041f\u0440\u043e\u0437\u0440\u0430\u0447\u043d\u043e\u0441\u0442';const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.step='1';slider.value=String(Math.round((l.opacity??1)*100));slider.setAttribute('aria-label',caption.textContent+' - '+l.name);const value=document.createElement('output');value.textContent=slider.value+'%';slider.oninput=()=>{l.opacity=Number(slider.value)/100;value.textContent=slider.value+'%';list().filter(o=>o.layerId===l.id).forEach(o=>{o.set('opacity',l.opacity*(o.objectOpacity??1));o.dirty=true});canvas.requestRenderAll()};slider.onchange=()=>commit();controls.append(caption,slider,value);root.append(controls)})}
function syncActiveOpacity(){const l=layer(state.activeLayer),slider=$('activeOpacity'),label=$('activeOpacityValue');if(!slider||!label)return;slider.disabled=!l;slider.value=String(Math.round((l?.opacity??1)*100));label.textContent=slider.value+'%'}
function setActiveOpacity(value,save=false){const l=layer(state.activeLayer);if(!l)return;l.opacity=Math.max(0,Math.min(1,Number(value)/100));list().filter(o=>o.layerId===l.id).forEach(o=>{o.set('opacity',l.opacity*(o.objectOpacity??1));o.dirty=true});canvas.requestRenderAll();$('activeOpacityValue').textContent=Math.round(l.opacity*100)+'%';if(save)commit()}
// Presentation-only tree: keep Fabric's object model and .vstudio serialization unchanged.
const objectTreeCollapsed=new Set();
function renderObjects(){
 const root=$('objectsList');root.replaceChildren();
 const active=selected(),selectedSet=new Set(active?.type==='activeSelection'?active.getObjects():active?[active]:[]);
 const itemRow=(title,depth,kind,object,expanded)=>{
  const row=document.createElement('div');row.className='object-row tree-row'+(object&&selectedSet.has(object)?' active':'');
  row.style.paddingLeft=(7+depth*16)+'px';row.dataset.kind=kind;
  const text=document.createElement('span');text.className='obj-name';text.textContent=title;
  if(expanded!==null){const disclosure=document.createElement('button');disclosure.type='button';disclosure.className='tree-disclosure';disclosure.textContent=expanded?'▾':'▸';disclosure.title=expanded?'Свий':'Разгъни';disclosure.setAttribute('aria-label',disclosure.title);row.append(disclosure)}
  else {const indent=document.createElement('span');indent.className='tree-spacer';row.append(indent)}
  row.append(text);root.append(row);return row;
 };
 const addObject=(object,depth,path,groupOwner)=>{
  const group=object.type==='group',children=group?(object.getObjects?.()||object._objects||[]):[];
  const collapsed=objectTreeCollapsed.has(path);
  const row=itemRow((group?'▣ ':'◇ ')+(object.itemName||object.type||'Обект'),depth,group?'group':'object',object,group?!collapsed:null);
  const selectable=groupOwner||object;
  const choose=()=>{if(!selectable.selectable||!selectable.visible)return;setTool('select');canvas.setActiveObject(selectable);canvas.requestRenderAll();renderAll()};
  row.addEventListener('click',choose);
  if(group){row.querySelector('.tree-disclosure').onclick=e=>{e.stopPropagation();collapsed?objectTreeCollapsed.delete(path):objectTreeCollapsed.add(path);renderObjects()};
   if(!collapsed)children.forEach((child,i)=>addObject(child,depth+1,path+'/'+i,selectable));}
 };
 for(const l of [...page().layers].reverse()){
  const objects=[...list()].reverse().filter(o=>o.layerId===l.id);
  const path='layer:'+l.id,collapsed=objectTreeCollapsed.has(path);
  const row=itemRow((l.visible?'◉ ':'○ ')+(l.locked?'🔒 ':'')+l.name+' ('+objects.length+')',0,'layer',null,!collapsed);
  row.classList.toggle('tree-muted',!l.visible);
  row.onclick=()=>{state.activeLayer=l.id;canvas.discardActiveObject();renderAll()};
  row.querySelector('.tree-disclosure').onclick=e=>{e.stopPropagation();collapsed?objectTreeCollapsed.delete(path):objectTreeCollapsed.add(path);renderObjects()};
  if(!collapsed)objects.forEach((o,i)=>addObject(o,1,path+'/'+o.uid, null));
 }
}

function detailedCountRows(){return quantityReport().details;}
function renderQuantities(){const root=$('quantityList');if(!root)return;root.replaceChildren();
 const report=quantityReport();
 // Explicitly distinguish graphics from devices, preserving countable=false.
 const diagramObjects=list().filter(o=>o && o.countable===false);
 if(diagramObjects.length){
   const hint=document.createElement('p');hint.className='tip';
   hint.textContent=`Графични елементи (не са количества оборудване): ${diagramObjects.length}. За реална справка маркирай устройствата и натисни „Брой избраните“.`;
   root.append(hint);
 }
 const header=document.createElement('div');header.className='quantity-row quantity-header';
 for(const title of ['Наименование','Бр.','Количество']){const cell=document.createElement('strong');cell.textContent=title;header.append(cell)}root.append(header);
 if(!report.rows.length){const empty=document.createElement('p');empty.className='tip';empty.textContent=report.excluded?`Няма отчетни количества. ${report.excluded} графични обекта са изключени от броене. Маркирай устройство и използвай „Брой избраните“.`:'Няма броими обекти за избраните филтри.';root.append(empty)}
 for(const item of report.rows){const r=document.createElement('div');r.className='quantity-row';for(const value of [item.name,item.count,item.quantity]){const cell=document.createElement('span');cell.textContent=String(value);r.append(cell)}root.append(r)}
 const total=document.createElement('div');total.className='quantity-total';total.textContent=`Общо: ${report.totalCount} бр. обекти · количество ${report.totalQuantity}`;root.append(total);
 if(report.details.length){const heading=document.createElement('h4');heading.textContent='По слоеве';root.append(heading);for(const item of report.details){const r=document.createElement('div');r.className='quantity-row';for(const value of [item.layer+' / '+item.name,item.count,item.quantity]){const c=document.createElement('span');c.textContent=String(value);r.append(c)}root.append(r)}}
 if($('stats'))$('stats').textContent=`${list().length} обекта · ${page().layers.length} слоя`;
}
// Keep the existing top toolbar bound to the selected object as well as new-object defaults.
function toolbarSelectionObjects(){
 const active=selected();
 return active?.type==='activeSelection'?active.getObjects():active?[active]:[];
}
function updateToolbarFromSelection(){
 const objects=toolbarSelectionObjects();
 if(!objects.length)return;
 for(const key of ['fill','stroke']){
  const values=objects.map(o=>styleTargets(o).find(child=>typeof child[key]==='string'&&/^#[0-9a-f]{6}$/i.test(child[key]))?.[key]).filter(Boolean);
  if(values.length&&values.every(v=>v.toLowerCase()===values[0].toLowerCase()))$(key).value=values[0];
 }
 const widths=objects.map(o=>o.strokeWidth).filter(Number.isFinite);
 if(widths.length===objects.length&&widths.every(v=>v===widths[0]))$('strokeWidth').value=String(widths[0]);
 if(objects.length===1&&['text','i-text','textbox'].includes(objects[0].type)&&Number.isFinite(objects[0].fontSize))$('fontSize').value=String(objects[0].fontSize);
}
// One style engine for toolbar and Properties. For compound symbols, preserve
// fine black/white markings when changing fill instead of flattening the artwork.
function styleTargets(o){return o?.type==='group'?o.getObjects().flatMap(styleTargets):[o]}
function canFill(o){return !['line','polyline','path','image'].includes(o.type)}
function setVisualStyle(objects,key,value){
 let changed=false;
 for(const parent of objects){
  if(key==='objectOpacity'){
   parent.objectOpacity=value;
   parent.set('opacity',value*(objectLayer(parent)?.opacity??1));
   parent.dirty=true;changed=true;continue;
  }
  if(parent.type==='image')continue;
  for(const o of styleTargets(parent)){
   if(key==='fill'){
    if(!canFill(o))continue;
    if(parent.type==='group'){
     const old=o.fill;
     if(typeof old!=='string'||old==='transparent'||old==='none'||old==='')continue;
     if(/^(#(?:fff(?:fff)?|000(?:000)?)|white|black)$/i.test(old))continue;
    }
   }
   if(parent.type==='group'&&['stroke','strokeWidth'].includes(key)&&(!o.stroke||o.stroke==='transparent'||o.stroke==='none'))continue;
   o.set(key,value);o.dirty=true;changed=true;
  }
  parent.dirty=true;parent.setCoords();
 }
 return changed;
}
function applyVisualProperty(key,value){
 const objects=toolbarSelectionObjects();
 if(!objects.length)return;
 if(key==='strokeWidth'&&(!Number.isFinite(value)||value<0||value>50))return;
 if(key==='objectOpacity'&&(!Number.isFinite(value)||value<0||value>1))return;
 if(setVisualStyle(objects,key,value)){
  canvas.requestRenderAll();commit();
 }
}
function applyToolbarStyle(key,value){
 const objects=toolbarSelectionObjects();
 if(!objects.length)return; // The toolbar values remain defaults for subsequently created shapes.
 if(key==='strokeWidth'&&(!Number.isFinite(value)||value<0||value>50))return;
 if(key==='fontSize'&&(!Number.isFinite(value)||value<6||value>200))return;
 if(key==='fontSize'){
  let changed=false;
  for(const o of objects){if(['text','i-text','textbox'].includes(o.type)){o.set(key,value);o.dirty=true;o.setCoords();changed=true;}}
  if(changed){canvas.requestRenderAll();commit();}return;
 }
 applyVisualProperty(key,value);
}
function setupToolbarStyle(){
 for(const key of ['fill','stroke','strokeWidth','fontSize']){
  $(key).addEventListener('change',()=>{
   const raw=$(key).value;
   applyToolbarStyle(key,key==='strokeWidth'||key==='fontSize'?Number(raw):raw);
  });
 }
}
function renderVisualProperties(root,objects,field){
 const representative=objects[0];if(!representative)return;
 const firstColor=(key,fallback)=>{const obj=styleTargets(representative).find(o=>typeof o[key]==='string'&&/^#[0-9a-f]{6}$/i.test(o[key]));return obj?.[key]||fallback};
 const fillSupported=objects.some(o=>o.type!=='image'&&styleTargets(o).some(canFill));
 const contourSupported=objects.some(o=>o.type!=='image');
 if(fillSupported){field('Цвят на елемента',firstColor('fill','#ffffff'),'color',v=>applyVisualProperty('fill',v));}
 if(contourSupported){
  field('Цвят на контура',firstColor('stroke','#000000'),'color',v=>applyVisualProperty('stroke',v));
  const widthField=field('Дебелина на контура',styleTargets(representative).find(o=>Number.isFinite(o.strokeWidth))?.strokeWidth??1,'number',v=>applyVisualProperty('strokeWidth',v));widthField.min='0';widthField.max='50';widthField.step='0.5';
 }
 const percent=Math.round((representative.objectOpacity??1)*100);
 const alpha=field('Непрозрачност на обекта (%)',percent,'range',v=>applyVisualProperty('objectOpacity',Number(v)/100));alpha.min='0';alpha.max='100';alpha.step='1';
 alpha.oninput=()=>{alpha.title=alpha.value+'%'};
 alpha.onchange=()=>applyVisualProperty('objectOpacity',Number(alpha.value)/100);
}
function renderPageProperties(root,field){
 const p=page();if(!p)return;
 const factor={mm:96/25.4,cm:96/2.54,in:96,px:1};
 const unit=p.units||'mm';const round=x=>Math.round(x*1000)/1000;
 const choose=(label,value,options,callback)=>{const wrap=document.createElement('label'),span=document.createElement('span'),sel=document.createElement('select');span.textContent=label;for(const [v,caption] of options){const opt=document.createElement('option');opt.value=v;opt.textContent=caption;sel.append(opt)}sel.value=value;sel.onchange=()=>callback(sel.value);wrap.append(span,sel);root.append(wrap)};
 const repaint=()=>{canvas.setBackgroundColor(p.transparentBackground?'rgba(0,0,0,0)':(p.background||'#ffffff'),()=>canvas.requestRenderAll());};
 const resize=()=>{canvas.setDimensions({width:p.width,height:p.height});setZoom(state.zoom);renderPages();commit();};
 field('Име на страницата',p.name,'text',v=>{if(!v.trim())return;p.name=v.trim();refreshPageOptions();renderPages();commit()});
 choose('Формат',p.format||'A4',[...Object.keys(formats).map(f=>[f,f]),['Custom','Потребителски']],v=>{p.format=v;if(v==='Custom'){p.customWidth=p.width;p.customHeight=p.height;}else{const [a,b]=formats[v];p.width=p.orientation==='landscape'?b:a;p.height=p.orientation==='landscape'?a:b;}$('paper').value=v;resize()});
 choose('Ориентация',p.orientation||'portrait',[['portrait','Портрет'],['landscape','Пейзаж']],v=>{if(p.orientation===v)return;p.orientation=v;[p.width,p.height]=[p.height,p.width];if(p.format==='Custom'){p.customWidth=p.width;p.customHeight=p.height;}$('orientation').value=v;resize()});
 choose('Мерни единици',unit,[['mm','Милиметри'],['cm','Сантиметри'],['in','Инчове'],['px','Пиксели']],v=>{p.units=v;renderProperties();drawRulers();commit()});
 for(const [label,key] of [['Ширина','width'],['Височина','height']]){
  const input=field(label+' ('+unit+')',round(p[key]/factor[unit]),'number',v=>{const px=v*factor[unit];if(!Number.isFinite(px)||px<10||px>40000){renderProperties();return;}p[key]=px;p.format='Custom';p.customWidth=p.width;p.customHeight=p.height;p.orientation=p.width>p.height?'landscape':'portrait';$('paper').value='Custom';$('orientation').value=p.orientation;resize()});input.min=String(round(10/factor[unit]));input.max=String(round(40000/factor[unit]));input.step='any';
 }
 const bg=field('Цвят на фона',/^#[0-9a-f]{6}$/i.test(p.background||'')?p.background:'#ffffff','color',v=>{p.background=v;repaint();commit()});bg.disabled=!!p.transparentBackground;
 field('Прозрачен фон',!!p.transparentBackground,'checkbox',v=>{p.transparentBackground=v;repaint();renderProperties();commit()});
 const hint=document.createElement('p');hint.className='tip';hint.textContent='Размерите са физически; смяната на мерните единици не мащабира обектите. При по-малка страница обекти могат да останат извън нея.';root.append(hint);
}
// Editable, non-destructive Fabric effects. Coordinates are local to each shape.
function effectsTargets(parent){
 if(parent.type==='group')return styleTargets(parent).filter(o=>o.type!=='image');
 return parent.type==='image'?[parent]:[parent];
}
function hasGradient(o){return !!o?.fill&&typeof o.fill==='object'&&Array.isArray(o.fill.colorStops)}
function effectGradient(o,type,from='#79b2ff',to='#1c5b9a',angle=0,mid=null){
 const width=Math.max(1,Number(o.width)||100),height=Math.max(1,Number(o.height)||100);
 const radial=type==='radial';
 return new fabric.Gradient({type:radial?'radial':'linear',gradientUnits:'pixels',
  coords:radial?{x1:width/2,y1:height/2,r1:0,x2:width/2,y2:height/2,r2:Math.max(width,height)/2}:{x1:width/2-Math.cos(angle*Math.PI/180)*width/2,y1:height/2-Math.sin(angle*Math.PI/180)*height/2,x2:width/2+Math.cos(angle*Math.PI/180)*width/2,y2:height/2+Math.sin(angle*Math.PI/180)*height/2},
  colorStops:mid?[{offset:0,color:from},{offset:.5,color:mid},{offset:1,color:to}]:[{offset:0,color:from},{offset:1,color:to}]});
}
// Pattern fills are real Fabric patterns and remain editable after project reload.
function effectPattern(color='#4479b4',background='#ffffff',spacing=18){
 const c=document.createElement('canvas');c.width=c.height=spacing;const ctx=c.getContext('2d');
 ctx.fillStyle=background;ctx.fillRect(0,0,spacing,spacing);ctx.fillStyle=color;
 ctx.beginPath();ctx.arc(spacing/2,spacing/2,Math.max(1,spacing/8),0,Math.PI*2);ctx.fill();
 return new fabric.Pattern({source:c,repeat:'repeat'});
}
function isPattern(o){return !!o?.fill&&o.fill instanceof fabric.Pattern}
function setEffectOnSelection(kind,params={}){
 const objects=toolbarSelectionObjects();if(!objects.length){status('Избери обект за прилагане на ефект.');return;}
 let changed=false;
 for(const parent of objects){
  if(kind==='clear'){
   if(parent.shadow){parent.set('shadow',null);changed=true;}if(parent.clipPath){parent.set('clipPath',null);changed=true;}if(parent.vsShadowStyle){parent.vsShadowStyle=null;changed=true;}
   for(const obj of effectsTargets(parent)){
    if(obj.shadow){obj.set('shadow',null);changed=true;}
    if(hasGradient(obj)||isPattern(obj)){obj.set('fill',obj.vsBaseFill||'#79b2ff');changed=true;}if(obj.vsTransparencyGradient){obj.vsTransparencyGradient=null;changed=true;}
    obj.dirty=true;
   }
  }else if(['shadow','glow','block-shadow'].includes(kind)){
   // A shadow on the group preserves the internal appearance of technical symbols.
   const target=parent;
   target.set('shadow',new fabric.Shadow({color:params.color||(kind==='glow'?'#4bbcff':'#000000'),blur:params.blur??(kind==='glow'?24:kind==='block-shadow'?0:8),
    offsetX:params.offsetX??(kind==='glow'?0:6),offsetY:params.offsetY??(kind==='glow'?0:6)}));target.vsShadowStyle=kind;target.dirty=true;changed=true;
  }else{
   for(const obj of effectsTargets(parent)){
    if(!canFill(obj))continue;
    // Do not recolor fine black/white markings in grouped symbols.
    if(parent.type==='group'&&(!obj.fill||typeof obj.fill!=='string'||/^(#(?:fff(?:fff)?|000(?:000)?)|white|black|none|transparent)$/i.test(obj.fill)))continue;
    if(!hasGradient(obj)&&!isPattern(obj)&&typeof obj.fill==='string')obj.vsBaseFill=obj.fill;
    if(kind==='pattern')obj.set('fill',effectPattern(params.color,params.background,params.spacing||18));
    else obj.set('fill',effectGradient(obj,kind,params.from,params.to,params.angle||0,params.mid||null));
    obj.dirty=true;changed=true;
   }
  }
  parent.dirty=true;parent.setCoords();
 }
 if(changed){canvas.requestRenderAll();commit();}
 else status('За този тип обект няма приложим градиент.');
}
function renderEffectsProperties(root,objects,field){
 if(!objects.length)return;
 const heading=document.createElement('h3');heading.textContent='Ефекти';root.append(heading);
 const first=objects[0];
 const shadow=first.shadow;
 const box=field('Сянка / светене',!!shadow,'checkbox',v=>{
  if(v)setEffectOnSelection(first.vsShadowStyle||'shadow',{color:shadow?.color||'#000000',blur:shadow?.blur??8,offsetX:shadow?.offsetX??6,offsetY:shadow?.offsetY??6});
  else {for(const o of objects){o.set('shadow',null);o.vsShadowStyle=null;o.dirty=true;}canvas.requestRenderAll();commit();}
 });
 const opacity=field('Прозрачност на обекта (%)',Math.round((first.objectOpacity??1)*100),'number',v=>{if(!Number.isFinite(v)||v<0||v>100)return;for(const o of objects){o.objectOpacity=v/100;o.set('opacity',(objectLayer(o)?.opacity??1)*o.objectOpacity);o.dirty=true;}canvas.requestRenderAll();commit()});opacity.min=0;opacity.max=100;
 if(shadow){
  const styles=['shadow','glow','block-shadow'];const names=['Външна сянка','Светене / Glow','Плътна сянка'];
  const style=document.createElement('label'),ss=document.createElement('select');style.append(document.createElement('span'),ss);style.firstChild.textContent='Стил на сянката';styles.forEach((v,i)=>{const o=document.createElement('option');o.value=v;o.textContent=names[i];ss.append(o)});ss.value=first.vsShadowStyle||'shadow';ss.onchange=()=>setEffectOnSelection(ss.value,{color:shadow.color,blur:shadow.blur,offsetX:shadow.offsetX,offsetY:shadow.offsetY});root.append(style);
  field('Цвят на сянката',/^#[0-9a-f]{6}$/i.test(shadow.color)?shadow.color:'#000000','color',v=>setEffectOnSelection(first.vsShadowStyle||'shadow',{color:v,blur:shadow.blur,offsetX:shadow.offsetX,offsetY:shadow.offsetY}));
  const numeric=(title,key,min,max)=>{const input=field(title,Number(shadow[key])||0,'number',v=>{if(!Number.isFinite(v)||v<min||v>max)return;const p={color:shadow.color,blur:shadow.blur,offsetX:shadow.offsetX,offsetY:shadow.offsetY};p[key]=v;setEffectOnSelection(first.vsShadowStyle||'shadow',p)});input.min=min;input.max=max;};
  numeric('Размазване на сянката','blur',0,100);numeric('Отместване X','offsetX',-200,200);numeric('Отместване Y','offsetY',-200,200);
 }
 const painted=effectsTargets(first).find(o=>hasGradient(o)||isPattern(o)),gradient=painted&&hasGradient(painted)?painted.fill:null;const pattern=painted&&isPattern(painted);
 const wrap=document.createElement('label'),label=document.createElement('span'),select=document.createElement('select');label.textContent='Градиент';
 [['none','Без градиент'],['linear','Линеен'],['radial','Радиален'],['pattern','Шарка / Pattern']].forEach(([v,t])=>{const opt=document.createElement('option');opt.value=v;opt.textContent=t;select.append(opt)});
 select.value=pattern?'pattern':gradient?.type||'none';select.onchange=()=>{
  if(select.value==='none'){
   for(const parent of objects)for(const o of effectsTargets(parent)){if(hasGradient(o)||isPattern(o)){o.set('fill',o.vsBaseFill||'#79b2ff');o.dirty=true;parent.dirty=true;}}
   canvas.requestRenderAll();commit();
  }else setEffectOnSelection(select.value,{from:gradient?.colorStops?.[0]?.color||'#79b2ff',to:gradient?.colorStops?.at(-1)?.color||'#1c5b9a'});
 };
 wrap.append(label,select);root.append(wrap);
 if(gradient){
  const stops=gradient.colorStops||[],start=stops[0]?.color||'#79b2ff',end=stops[stops.length-1]?.color||'#1c5b9a';
  const hex=c=>/^#[0-9a-f]{6}$/i.test(c)?c:'#79b2ff';
  field('Градиент: начален цвят',hex(start),'color',v=>setEffectOnSelection(gradient.type,{from:v,to:end}));
  field('Градиент: краен цвят',hex(end),'color',v=>setEffectOnSelection(gradient.type,{from:start,to:v}));
  if(gradient.type==='linear'){const currentAngle=Math.round(Math.atan2(gradient.coords.y2-gradient.coords.y1,gradient.coords.x2-gradient.coords.x1)*180/Math.PI);const angle=field('Посока на градиента (°)',currentAngle,'number',v=>{if(Number.isFinite(v))setEffectOnSelection('linear',{from:start,to:end,angle:v})});angle.min=-360;angle.max=360;}
 }
}
// Stage 10 — shadow/masking effects; preserve source geometry and canvas history.
function stage10Value(label,initial,min,max){
 const raw=prompt(label,String(initial));if(raw===null)return null;
 const v=Number(raw);if(!raw.trim()||!Number.isFinite(v)||v<min||v>max){status(`Стойността трябва да е между ${min} и ${max}.`);return null;}return v;
}
function stage10Hex(raw,fallback){return /^#[\da-f]{6}$/i.test(raw||'')?raw:fallback;}
function stage10ColorToRGBA(hex,alpha){const c=new fabric.Color(hex).getSource();if(!Array.isArray(c)||c.length<3)throw Error('Невалиден цвят');return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;}
function stage10GradientAlpha(){
 const objs=selectedObjects();if(!objs.length){status('Избери обект.');return;}
 const a=stage10Value('Начална прозрачност (0=непрозрачен, 100=прозрачен):',0,0,100);if(a===null)return;
 const b=stage10Value('Крайна прозрачност (0=непрозрачен, 100=прозрачен):',100,0,100);if(b===null)return;
 const angle=stage10Value('Ъгъл на прехода (градуси):',0,-360,360);if(angle===null)return;
 let changed=false;
 for(const parent of objs){if(objectLayer(parent)?.locked)continue;
  for(const target of effectsTargets(parent)){
   if(!canFill(target)||target.type==='image')continue;
   if(!target.vsBaseFill&&typeof target.fill==='string')target.vsBaseFill=target.fill;
   const base=stage10Hex(typeof target.fill==='string'?target.fill:target.vsBaseFill,'#79b2ff');
   target.set('fill',effectGradient(target,'linear',stage10ColorToRGBA(base,1-a/100),stage10ColorToRGBA(base,1-b/100),angle));
   target.vsTransparencyGradient={start:a,end:b,angle,base};target.dirty=true;changed=true;
  }
  parent.dirty=true;
 }
 if(changed){canvas.requestRenderAll();commit();}else status('Няма подходящ обект за градиентна прозрачност.');
}
function stage10Feather(){
 const o=selectedObjects();if(!o.length)return status('Избери обект.');
 const blur=stage10Value('Ширина на меката външна периферия (px):',16,1,100);if(blur===null)return;
 // Fabric shadows provide a soft outside halo; this is explicitly not a true edge-alpha feather.
 for(const x of o){if(objectLayer(x)?.locked)continue;x.set('shadow',new fabric.Shadow({color:'rgba(0,0,0,0.30)',blur,offsetX:0,offsetY:0}));x.vsShadowStyle='feather-halo';x.dirty=true;}
 canvas.requestRenderAll();commit();status('Добавена е мека външна периферия (приближение чрез сянка).');
}
function stage10InnerShadow(){
 const o=selectedObjects();if(o.length!==1)return status('Избери един правоъгълник.');
 const source=o[0],r=axisAlignedRect(source),l=objectLayer(source);
 if(!r||!l||l.locked||!l.visible)return status('Вътрешна сянка: необходим е осево подравнен правоъгълник в отключен слой.');
 const w=r.x2-r.x1,h=r.y2-r.y1;
 const depth=stage10Value('Дълбочина на вътрешната сянка:',Math.min(16,Math.floor(Math.min(w,h)/4)),1,Math.min(w,h)/2);if(depth===null)return;
 const color=stage10Hex(prompt('Цвят на вътрешната сянка (#RRGGBB):','#000000'),'#000000');
 const alpha=stage10Value('Интензитет (0–100):',40,0,100);if(alpha===null)return;
 const transparent=stage10ColorToRGBA(color,0),dark=stage10ColorToRGBA(color,alpha/100);
 const {x1,y1,x2,y2}=r;
 const bands=[
  [x1,y1,w,depth,0], [x1,y2-depth,w,depth,180],
  [x1,y1,depth,h,90], [x2-depth,y1,depth,h,270]
 ].map(([x,y,bw,bh,angle])=>{
  const rect=new fabric.Rect({left:x,top:y,width:bw,height:bh,strokeWidth:0,objectCaching:false});
  rect.set('fill',effectGradient(rect,'linear',dark,transparent,angle));return rect;
 });
 effectAddGenerated(bands,source,'Вътрешна сянка · правоъгълник');
}
function stage10PowerClip(){
 const objs=selectedObjects();if(objs.length!==2)return status('PowerClip: избери точно два обекта. Вторият обект в реда на селекция е формата за изрязване.');
 const [target,mask]=objs;
 if(target===mask||target.type==='activeSelection'||mask.type==='activeSelection'||mask.type==='group'||!['rect','circle','ellipse','polygon','path','triangle'].includes(mask.type))
  return status('PowerClip: използвай негрупирана затворена векторна форма като маска.');
 if(!objectLayer(target)||objectLayer(target)?.locked||objectLayer(mask)?.locked)return status('PowerClip: заключен слой.');
 mask.clone(clone=>{
  clone.set({absolutePositioned:true,fill:'#000000',stroke:null,strokeWidth:0,selectable:false,evented:false});
  clone.setCoords();target.set('clipPath',clone);target.dirty=true;canvas.requestRenderAll();commit();
  status('PowerClip е приложен. Маската остава отделен обект; премахването на ефекти освобождава изрязването.');
 },['uid']);
}

function chooseEffect(kind){
 if(!toolbarSelectionObjects().length){status('Първо избери обект.');return;}
 if(kind==='clear'){setEffectOnSelection('clear');document.querySelector('[data-tab="properties"]')?.click();return;}
 if(['shadow','glow','block-shadow','pattern'].includes(kind))setEffectOnSelection(kind);
 else setEffectOnSelection(kind);
 // All parameters are editable in the existing Properties tab.
 document.querySelector('[data-tab="properties"]')?.click();
}
function renderProperties(){updateToolbarFromSelection();updateAdaptiveToolbar();const root=$('propertiesContent');root.replaceChildren();const o=selected();const l=layer(state.activeLayer);const field=(label,value,type,callback)=>{const wrap=document.createElement('label'),title=document.createElement('span'),input=document.createElement('input');title.textContent=label;input.type=type;input.value=String(value??'');if(type==='checkbox')input.checked=!!value;input.onchange=()=>callback(type==='checkbox'?input.checked:type==='number'?Number(input.value):input.value);wrap.append(title,input);root.append(wrap);return input};const heading=document.createElement('h3');heading.textContent=o&&o.type!=='activeSelection'?'Свойства на обект':'Свойства на страница';root.append(heading);
if(!o){renderPageProperties(root,field);return}
if(o.type==='activeSelection'){renderVisualProperties(root,toolbarSelectionObjects(),field);renderEffectsProperties(root,toolbarSelectionObjects(),field);return}
const units=page().units||'px',factor={mm:96/25.4,cm:96/2.54,in:96,px:1}[units]||1,unitLabel=units;const num=n=>Math.round(n/factor*1000)/1000;
field('Име',o.itemName,'text',v=>{o.itemName=v;commit()});
for(const [label,key] of [['X','left'],['Y','top']])field(label+' ('+unitLabel+')',num(o[key]||0),'number',v=>{if(!Number.isFinite(v))return;o.set(key,v*factor);o.setCoords();canvas.requestRenderAll();commit()});
for(const [label,key] of [['Ширина','width'],['Височина','height']])field(label+' ('+unitLabel+')',num(key==='width'?o.getScaledWidth():o.getScaledHeight()),'number',v=>{if(!Number.isFinite(v)||v<=0)return;key==='width'?o.scaleToWidth(v*factor):o.scaleToHeight(v*factor);o.setCoords();canvas.requestRenderAll();commit()});
field('Завъртане (°)',o.angle||0,'number',v=>{if(!Number.isFinite(v))return;o.rotate(v);o.setCoords();canvas.requestRenderAll();commit()});
const quantityInput=field('Количество',o.qty??1,'number',v=>{if(!Number.isFinite(v)||v<0)return;o.qty=v;commit()});quantityInput.min='0';quantityInput.step='any';
field('Брои се',o.countable!==false,'checkbox',v=>{o.countable=v;commit()});
const wrap=document.createElement('label'),title=document.createElement('span'),select=document.createElement('select');title.textContent='Слой';page().layers.forEach(x=>{const opt=document.createElement('option');opt.value=x.id;opt.textContent=x.name;select.append(opt)});select.value=o.layerId;select.onchange=()=>{o.layerId=select.value;applyLayers();commit()};wrap.append(title,select);root.append(wrap);
renderVisualProperties(root,[o],field);renderEffectsProperties(root,[o],field);
// Text formatting uses the existing Properties panel; no second text tool or catalog.
if(['text','i-text','textbox'].includes(o.type)){
 const option=(label,property,values)=>{
  const wrap=document.createElement('label'),title=document.createElement('span'),select=document.createElement('select');
  title.textContent=label;
  for(const [value,caption] of values){const entry=document.createElement('option');entry.value=value;entry.textContent=caption;select.append(entry)}
  select.value=String(o[property]??values[0][0]);
  select.onchange=()=>{o.set(property,select.value);o.dirty=true;o.setCoords();canvas.requestRenderAll();commit()};
  wrap.append(title,select);root.append(wrap);
 };
 option('Шрифт','fontFamily', [['Arial','Arial'],['Verdana','Verdana'],['Tahoma','Tahoma'],['Georgia','Georgia'],['Times New Roman','Times New Roman'],['Courier New','Courier New'],['Trebuchet MS','Trebuchet MS'],['sans-serif','Sans Serif'],['serif','Serif'],['monospace','Monospace']]);
 field('Размер на шрифта',o.fontSize||22,'number',v=>{if(!Number.isFinite(v)||v<6||v>200)return;o.set('fontSize',v);o.dirty=true;o.setCoords();canvas.requestRenderAll();commit()});
 option('Дебелина на шрифта','fontWeight',[['normal','Нормален'],['bold','Удебелен']]);
 option('Начертание','fontStyle',[['normal','Нормално'],['italic','Курсив']]);
 field('Подчертан',!!o.underline,'checkbox',v=>{o.set('underline',v);o.dirty=true;canvas.requestRenderAll();commit()});
 option('Подравняване','textAlign',[['left','Ляво'],['center','Център'],['right','Дясно'],['justify','Двустранно']]);
 field('Междуредово разстояние',o.lineHeight||1.16,'number',v=>{if(!Number.isFinite(v)||v<0.5||v>5)return;o.set('lineHeight',v);o.dirty=true;o.setCoords();canvas.requestRenderAll();commit()});
 field('Разстояние между символите',o.charSpacing||0,'number',v=>{if(!Number.isFinite(v)||v< -1000||v>5000)return;o.set('charSpacing',v);o.dirty=true;o.setCoords();canvas.requestRenderAll();commit()});
 if(o.type==='textbox')field('Ширина на текстовия блок (px)',Math.round(o.width),'number',v=>{if(!Number.isFinite(v)||v<40||v>10000)return;o.set('width',v);o.dirty=true;o.setCoords();canvas.requestRenderAll();commit()});
}
const hint=document.createElement('p');hint.className='tip';hint.textContent='Непрозрачността на обекта се комбинира с тази на слоя.';root.append(hint)}
function alignSelection(mode){const active=selected(),objects=active?.type==='activeSelection'?active.getObjects():active?[active]:[];if(objects.length<2){status('Избери поне два обекта (Shift + клик).');return}const boxes=objects.map(o=>({o,rect:o.getBoundingRect(true,true)}));const left=Math.min(...boxes.map(b=>b.rect.left)),right=Math.max(...boxes.map(b=>b.rect.left+b.rect.width)),top=Math.min(...boxes.map(b=>b.rect.top)),bottom=Math.max(...boxes.map(b=>b.rect.top+b.rect.height));if(mode.startsWith('distribute')&&objects.length<3){status('За разпределяне са нужни поне три обекта.');return}if(mode.startsWith('distribute')){const horizontal=mode==='distribute-h';boxes.sort((a,b)=>horizontal?a.rect.left-b.rect.left:a.rect.top-b.rect.top);const first=boxes[0].rect,last=boxes[boxes.length-1].rect,firstPos=horizontal?first.left:first.top,lastPos=horizontal?last.left:last.top;const step=(lastPos-firstPos)/(boxes.length-1);boxes.slice(1,-1).forEach((b,i)=>{const coord=firstPos+step*(i+1),offset=coord-(horizontal?b.rect.left:b.rect.top);b.o.set(horizontal?'left':'top',(horizontal?b.o.left:b.o.top)+offset);b.o.setCoords()})}else boxes.forEach(({o,rect})=>{let dx=0,dy=0;if(mode==='left')dx=left-rect.left;if(mode==='center-h')dx=(left+right)/2-(rect.left+rect.width/2);if(mode==='right')dx=right-(rect.left+rect.width);if(mode==='top')dy=top-rect.top;if(mode==='center-v')dy=(top+bottom)/2-(rect.top+rect.height/2);if(mode==='bottom')dy=bottom-(rect.top+rect.height);o.set({left:o.left+dx,top:o.top+dy});o.setCoords()});canvas.discardActiveObject();canvas.requestRenderAll();commit();status('Подравняването е приложено')}
function moveLayer(direction){const layers=page().layers,index=layers.findIndex(l=>l.id===state.activeLayer),next=index+direction;if(index<0||next<0||next>=layers.length)return;[layers[index],layers[next]]=[layers[next],layers[index]];const order=new Map(layers.map((l,i)=>[l.id,i]));const sorted=list().slice().sort((a,b)=>(order.get(a.layerId)??0)-(order.get(b.layerId)??0));sorted.forEach((o,i)=>canvas.moveTo(o,i));canvas.requestRenderAll();commit()}

function renderAll(){updateAdaptiveToolbar();refreshPageOptions();renderPages();renderLayers();syncActiveOpacity();renderObjects();renderSymbolLibrary();renderQuantities();renderProperties();$('documentName').textContent=state.filename}
// Document-local reusable symbol templates. Instances are intentionally independent;
// linked CorelDRAW-style master instances require a separate, explicit data model.
const SYMBOL_LIBRARY_KEY='vectorStudioSymbolLibrary';
function symbolLibrary(){
  if(!state.assets||typeof state.assets!=='object')state.assets={};
  const entries=state.assets[SYMBOL_LIBRARY_KEY];
  return Array.isArray(entries)?entries:[];
}
function renderSymbolLibrary(){
  const select=$('symbolLibraryList');if(!select)return;
  const previous=select.value,entries=symbolLibrary();select.replaceChildren();
  entries.forEach(entry=>{const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name;select.append(option)});
  if(entries.some(entry=>entry.id===previous))select.value=previous;
  $('symbolInsert').disabled=!entries.length;
  $('symbolDelete').disabled=!entries.length;
}
function saveSelectedSymbol(){
  const o=selected();
  if(!o||o.type==='activeSelection'){notify('Библиотека символи','Изберете един обект или предварително групирайте няколко обекта.');return}
  const name=prompt('Име на символа:',o.itemName||'Символ');
  if(name===null)return;
  if(!name.trim()){notify('Библиотека символи','Името на символа не може да е празно.');return}
  const entry={id:uid(),name:name.trim().slice(0,100),object:o.toObject(['itemType','itemName','countable','symbolCode','qty'])};
  // Do not add uid/layerId: each instance gets its own identity and active layer.
  if(!Array.isArray(state.assets[SYMBOL_LIBRARY_KEY]))state.assets[SYMBOL_LIBRARY_KEY]=[];
  state.assets[SYMBOL_LIBRARY_KEY].push(entry);
  commit();$('symbolLibraryList').value=entry.id;status('Символът е добавен в библиотеката на проекта');
}
async function insertLibrarySymbol(linked=false){
  const entry=symbolLibrary().find(e=>e.id===$('symbolLibraryList').value);
  if(!entry)return;
  const active=layer(state.activeLayer);if(!active||active.locked||!active.visible){notify('Библиотека символи','Изберете видим, отключен слой.');return}
  if(!entry.object||typeof entry.object!=='object')throw Error('Невалиден символ в библиотеката.');
  const items=await new Promise((resolve,reject)=>{
    try{fabric.util.enlivenObjects([deep(entry.object)],resolve)}catch(e){reject(e)}
  });
  if(items.length!==1||!items[0])throw Error('Символът не може да бъде възстановен.');
  const o=items[0];o.uid=uid();o.layerId=state.activeLayer;o.itemType='symbol';o.itemName=entry.name;o.symbolCode=entry.name;o.countable=true;if(linked)o.vsSymbolMasterId=entry.id;
  o.set({left:(Number(o.left)||0)+20,top:(Number(o.top)||0)+20});o.setCoords();add(o,entry.name);
  status(linked?'Вмъкнат свързан символ':'Символът е вмъкнат като независимо копие');
}
// Stage 30: explicit master/instance references. A master is stored in document assets;
// linked instances retain placement. Updating affects unlocked instances on the active page only.
async function updateLinkedSymbolMaster(){
  const source=selected(),id=source?.vsSymbolMasterId;
  const entry=symbolLibrary().find(e=>e.id===id);
  if(!source||!entry){notify('Свързани символи','Изберете свързан екземпляр.');return}
  if(objectLayer(source)?.locked){notify('Свързани символи','Слоят е заключен.');return}
  if(!confirm('Обновяване на оригиналния символ от избрания екземпляр?'))return;
  entry.object=source.toObject(['itemType','itemName','countable','symbolCode','qty']);
  delete entry.object.uid;delete entry.object.layerId;delete entry.object.vsSymbolMasterId;
  commit();status('Оригиналният символ е обновен. Изпълнете „Обнови екземплярите“.');
}
async function refreshLinkedSymbols(){
  const entries=new Map(symbolLibrary().map(e=>[e.id,e]));
  const instances=list().filter(o=>o.vsSymbolMasterId&&entries.has(o.vsSymbolMasterId));
  if(!instances.length){status('На текущата страница няма свързани екземпляри.');return}
  let changed=0,skipped=0;
  state.busy=true;
  try{
    for(const old of instances){
      const l=objectLayer(old);if(!l||l.locked||!l.visible){skipped++;continue}
      const entry=entries.get(old.vsSymbolMasterId);
      const restored=await new Promise((resolve,reject)=>{
        try{fabric.util.enlivenObjects([deep(entry.object)],a=>resolve(a?.[0]))}catch(e){reject(e)}
      });
      if(!restored)throw Error('Символът не може да бъде възстановен: '+entry.name);
      const index=canvas.getObjects().indexOf(old);
      restored.set({left:old.left,top:old.top,scaleX:old.scaleX,scaleY:old.scaleY,angle:old.angle,flipX:old.flipX,flipY:old.flipY,originX:old.originX,originY:old.originY});
      restored.uid=old.uid;restored.layerId=old.layerId;restored.itemType='symbol';restored.itemName=entry.name;
      restored.symbolCode=old.symbolCode;restored.countable=old.countable;restored.qty=old.qty;
      restored.objectOpacity=old.objectOpacity;restored.vsSymbolMasterId=entry.id;
      canvas.remove(old);canvas.insertAt(restored,index,false);hydrateMeta(restored);
      restored.set({opacity:(l.opacity??1)*(restored.objectOpacity??1),visible:true});restored.setCoords();changed++;
    }
  }finally{state.busy=false}
  canvas.discardActiveObject();canvas.requestRenderAll();commit();
  status(`Обновени свързани символи: ${changed}; пропуснати: ${skipped}.`);
}
function deleteLibrarySymbol(){
  const select=$('symbolLibraryList'),id=select.value;
  const entries=symbolLibrary();const i=entries.findIndex(e=>e.id===id);if(i<0)return;
  if(!confirm('Изтриване на символа от библиотеката? Съществуващите копия остават в документа.'))return;
  entries.splice(i,1);commit();status('Символът е изтрит от библиотеката');
}
function snapshot(){const d=serialize();delete d.updatedAt;d.activePageId=page()?.id;return JSON.stringify(d)}
function pageHistory(){const id=page()?.id;if(!id)return null;if(!state.pageHistories.has(id))state.pageHistories.set(id,{past:[],future:[]});return state.pageHistories.get(id)}
function commit(){if(state.busy)return;const snap=snapshot(),h=pageHistory();if(h&&h.past[h.past.length-1]!==snap){h.past.push(snap);if(h.past.length>35)h.past.shift();h.future=[]}state.history=h?.past||[];state.future=h?.future||[];renderAll()}
async function restore(s){const doc=JSON.parse(s),activeId=doc.activePageId;state.busy=true;state.pages=doc.pages;state.assets=doc.assets||{};state.sourceFiles=doc.sourceFiles||[];state.filename=doc.filename||'Проект.vstudio';state.createdAt=doc.createdAt||new Date().toISOString();const index=state.pages.findIndex(p=>p.id===activeId);state.page=index>=0?index:0;state.busy=false;await displayPage(state.page,true)}
async function restorePageHistory(snapshotText){const saved=JSON.parse(snapshotText),id=page()?.id,previous=saved.pages.find(p=>p.id===id);if(!previous)return;state.pages[state.page]=deep(previous);await displayPage(state.page,true)}
async function undo(){const h=pageHistory();if(!h||h.past.length<2)return;h.future.push(h.past.pop());await restorePageHistory(h.past[h.past.length-1]);state.history=h.past;state.future=h.future;status('Отменено')}
async function redo(){const h=pageHistory();if(!h||!h.future.length)return;const s=h.future.pop();h.past.push(s);await restorePageHistory(s);state.history=h.past;state.future=h.future;status('Възстановено')}
let releaseDrawingGesture=()=>{};
function setTool(t){if(t!=='knife-polyline'&&t!=='knife-bezier'&&t!=='knife-polygon'){knifeSource=null;polygonKnifeStart=null;}if(t!=='shape-region')shapeRegionSources=null;releaseDrawingGesture();if(state.tool==='polyline'&&t!=='polyline')cancelPolyline();if(state.tool==='bezier'&&t!=='bezier')cancelBezier();state.tool=t;[...document.querySelectorAll('[data-tool]')].forEach(b=>b.classList.toggle('active',b.dataset.tool===t));canvas.isDrawingMode=t==='pencil';canvas.selection=t==='select';canvas.defaultCursor=t==='pan'?'grab':t==='select'?'default':'crosshair';const layerLookup=new Map((page()?.layers||[]).map(l=>[l.id,l]));canvas.forEachObject(o=>{const l=layerLookup.get(o.layerId);o.selectable=t==='select'&&l?.visible!==false&&!l?.locked;o.evented=o.selectable});canvas.discardActiveObject();canvas.requestRenderAll();$('hint').textContent={select:'Избери и премести обект. Двойно щракване върху текст за редакция.',pan:'Плъзни върху платното за преместване на изгледа.',pencil:'Чертане със свободна ръка.',polyline:'Кликни за възел, двоен клик за край.',bezier:'Постави точки, двоен клик или Enter за плавна крива.',line:'Плъзни за линия.',rect:'Плъзни за правоъгълник.',ellipse:'Плъзни за елипса.',triangle:'Плъзни за триъгълник.',arrow:'Плъзни за стрелка.',text:'Щракни за текст.',symbol:'Щракни за преброим символ.',eyedrop:'Щракни върху обект за неговия цвят.', 'knife-polyline':'Щракни върху сегмент от предварително избраната полилиния, за да я разрежеш.','knife-bezier':'Щракни върху предварително избрана отворена Безие крива, за да я разделиш.','knife-polygon':'Щракни две точки, определящи линията на разреза през избрания изпъкнал многоъгълник.','shape-region':'Щракни в избрана правоъгълна област, за да създадеш отделен векторен обект.'}[t]||''}
function style(){return{fill:$('fill').value,stroke:$('stroke').value,strokeWidth:Math.max(0,Number($('strokeWidth').value)||0),objectCaching:false}}
function gridSize(){return Math.max(2,Math.min(500,Number($('gridStep').value)||20))}
function snapPoint(p){if(!$('snapGrid').checked)return p;const n=gridSize();return{x:Math.round(p.x/n)*n,y:Math.round(p.y/n)*n}}
function updateGrid(){const wrap=$('paperWrap');let overlay=$('drawingGrid');if(!overlay){overlay=document.createElement('div');overlay.id='drawingGrid';wrap.append(overlay)}const enabled=$('showGrid').checked;overlay.style.display=enabled?'block':'none';if(enabled){const step=gridSize()*state.zoom;overlay.style.backgroundSize=step+'px '+step+'px'}}

// Stage 26: opt-in snapping to editable vertices on existing vector paths.
let smartNodeSnapEnabled=false;
function smartNodeCandidates(o){
 if(!o||!['polyline','polygon'].includes(o.type)||!Array.isArray(o.points))return [];
 const matrix=o.calcTransformMatrix();
 return o.points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).map(p=>{
  const point=fabric.util.transformPoint(new fabric.Point(p.x-(o.pathOffset?.x||0),p.y-(o.pathOffset?.y||0)),matrix);
  return {x:point.x,y:point.y};
 });
}
// Stage 28: independent opt-in snapping to actual segment midpoints (in world coordinates).
let smartMidpointSnapEnabled=false;
function smartMidpointCandidates(o){
 if(!o||!['polyline','polygon'].includes(o.type)||!Array.isArray(o.points))return [];
 const pts=o.points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
 if(pts.length<2)return [];
 const matrix=o.calcTransformMatrix(),offset=o.pathOffset||{x:0,y:0};
 const candidates=[];
 const count=o.type==='polygon'?pts.length:pts.length-1;
 for(let i=0;i<count;i++){
  const a=pts[i],b=pts[(i+1)%pts.length];
  if(Math.hypot(b.x-a.x,b.y-a.y)<1e-9)continue;
  const middle=new fabric.Point((a.x+b.x)/2-offset.x,(a.y+b.y)/2-offset.y);
  const point=fabric.util.transformPoint(middle,matrix);
  candidates.push({x:point.x,y:point.y});
 }
 return candidates;
}
// Stage 29: intersections of straight vector segments in document/world coordinates.
let smartIntersectionSnapEnabled=false;
function snapWorldSegments(o){
 if(!o||!['polyline','polygon'].includes(o.type)||!Array.isArray(o.points))return [];
 const pts=o.points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
 if(pts.length<2)return [];
 const m=o.calcTransformMatrix(),offset=o.pathOffset||{x:0,y:0};
 const world=pts.map(p=>fabric.util.transformPoint(new fabric.Point(p.x-offset.x,p.y-offset.y),m));
 const count=o.type==='polygon'?world.length:world.length-1;
 const result=[];
 for(let i=0;i<count;i++){
  const a=world[i],b=world[(i+1)%world.length];
  if(Math.hypot(b.x-a.x,b.y-a.y)>1e-9)result.push([a,b]);
 }
 return result;
}
function snapSegmentIntersection(a,b,c,d){
 const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y;
 const denom=rx*sy-ry*sx;
 if(Math.abs(denom)<1e-10)return null; // Parallel or coincident: no unique intersection.
 const qx=c.x-a.x,qy=c.y-a.y,t=(qx*sy-qy*sx)/denom,u=(qx*ry-qy*rx)/denom;
 if(t< -1e-9||t>1+1e-9||u< -1e-9||u>1+1e-9)return null;
 return {x:a.x+t*rx,y:a.y+t*ry};
}
function smartIntersectionCandidates(objects){
 const segments=[];
 for(const o of objects){for(const segment of snapWorldSegments(o))segments.push({segment,source:o});}
 if(segments.length>400)return []; // Safety bound for interactive pointer events.
 const result=[];
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
  if(segments[i].source===segments[j].source)continue;
  const p=snapSegmentIntersection(...segments[i].segment,...segments[j].segment);
  if(p&&!result.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<1e-7))result.push(p);
 }
 return result;
}
function toggleSmartIntersectionSnap(){
 smartIntersectionSnapEnabled=!smartIntersectionSnapEnabled;
 const b=document.querySelector('[data-action="smart-intersection-snap"]');
 if(b){b.setAttribute('aria-pressed',String(smartIntersectionSnapEnabled));b.textContent='Прихващане към пресечни точки: '+(smartIntersectionSnapEnabled?'ВКЛ':'ИЗКЛ');}
 status('Прихващане към пресечни точки: '+(smartIntersectionSnapEnabled?'включено':'изключено'));
}
function toggleSmartMidpointSnap(){
 smartMidpointSnapEnabled=!smartMidpointSnapEnabled;
 const b=document.querySelector('[data-action="smart-midpoint-snap"]');
 if(b){b.setAttribute('aria-pressed',String(smartMidpointSnapEnabled));b.textContent='Прихващане към среди: '+(smartMidpointSnapEnabled?'ВКЛ':'ИЗКЛ');}
 status('Прихващане към среди на сегменти: '+(smartMidpointSnapEnabled?'включено':'изключено'));
}
function toggleSmartNodeSnap(){
 smartNodeSnapEnabled=!smartNodeSnapEnabled;
 const b=document.querySelector('[data-action="smart-node-snap"]');
 if(b){b.setAttribute('aria-pressed',String(smartNodeSnapEnabled));b.textContent='Прихващане към възли: '+(smartNodeSnapEnabled?'ВКЛ':'ИЗКЛ');}
 status('Прихващане към възли: '+(smartNodeSnapEnabled?'включено':'изключено'));
}
function objectSnapPoint(p){if(!$('snapObjects').checked)return null;const threshold=10/Math.max(.1,state.zoom);let best=null,dist=threshold;for(const o of list()){if(!o.visible||o===state.draw||o===selected()&&state.tool!=='select')continue;const box=o.getBoundingRect(true,true),x=box.left,y=box.top,w=box.width,h=box.height;const points=[[x,y],[x+w/2,y],[x+w,y],[x,y+h/2],[x+w/2,y+h/2],[x+w,y+h/2],[x,y+h],[x+w/2,y+h],[x+w,y+h]];if(smartNodeSnapEnabled){for(const node of smartNodeCandidates(o))points.push([node.x,node.y]);}if(smartMidpointSnapEnabled){for(const mid of smartMidpointCandidates(o))points.push([mid.x,mid.y]);}for(const [px,py] of points){const d=Math.hypot(px-p.x,py-p.y);if(d<dist){dist=d;best={x:px,y:py}}}}if(smartIntersectionSnapEnabled){
 const candidates=smartIntersectionCandidates(list().filter(o=>o.visible&&o!==state.draw&&!(o===selected()&&state.tool!=='select')));
 for(const q of candidates){const d=Math.hypot(q.x-p.x,q.y-p.y);if(d<dist){dist=d;best=q;}}
}return best}
function drawRulers(){let rulers=$('editorRulers');if(!rulers){rulers=document.createElement('div');rulers.id='editorRulers';$('scrollArea').append(rulers)}rulers.replaceChildren();rulers.hidden=!$('showRulers').checked;if(rulers.hidden)return;const units=page()?.units||'px',ratio={mm:96/25.4,cm:96/2.54,in:96,px:1}[units]||1,step=Math.max(10,Math.ceil(40/state.zoom/ratio)*ratio);const rect=$('paperWrap').getBoundingClientRect(),base=$('scrollArea').getBoundingClientRect();const positions=[['horizontal',page().width],['vertical',page().height]];positions.forEach(([direction,size])=>{const bar=document.createElement('div');bar.className='ruler '+direction;bar.style.left=(rect.left-base.left)+'px';bar.style.top=(rect.top-base.top)+'px';bar.style[direction==='horizontal'?'width':'height']=(size*state.zoom)+'px';for(let value=0;value<=size;value+=step){const tick=document.createElement('span');tick.className='ruler-tick';tick.style[direction==='horizontal'?'left':'top']=(value*state.zoom)+'px';tick.textContent=String(Math.round(value/ratio));bar.append(tick)}rulers.append(bar)})}
function renderGuides(){let root=$('guidesOverlay');if(!root){root=document.createElement('div');root.id='guidesOverlay';$('paperWrap').append(root)}root.replaceChildren();(page().guides||[]).forEach((g,i)=>{const line=document.createElement('div');line.className='drawing-guide '+(g.axis==='x'?'vertical':'horizontal');line.style[g.axis==='x'?'left':'top']=(g.value*state.zoom)+'px';line.title='Водач '+(g.axis==='x'?'X':'Y')+': двоен клик за точна позиция';line.onpointerdown=e=>{e.preventDefault();e.stopPropagation();line.setPointerCapture(e.pointerId);const move=ev=>{const rect=$('paperWrap').getBoundingClientRect();const coord=g.axis==='x'?ev.clientX-rect.left:ev.clientY-rect.top;g.value=Math.max(0,Math.min(g.axis==='x'?page().width:page().height,coord/state.zoom));line.style[g.axis==='x'?'left':'top']=(g.value*state.zoom)+'px'};const stop=()=>{line.removeEventListener('pointermove',move);line.removeEventListener('pointerup',stop);commit()};line.addEventListener('pointermove',move);line.addEventListener('pointerup',stop,{once:true})};line.ondblclick=e=>{e.preventDefault();e.stopPropagation();const units=page().units||'px',factor={mm:96/25.4,cm:96/2.54,in:96,px:1}[units]||1,reply=prompt('Позиция ('+units+'):',String(Math.round(g.value/factor*100)/100));if(reply===null)return;const value=Number(reply.replace(',','.'))*factor;if(!Number.isFinite(value)||value<0||value>(g.axis==='x'?page().width:page().height))return;g.value=value;renderGuides();commit()};root.append(line)})}
function snapGuidePoint(p){if(!$('snapGuides').checked)return p;const tolerance=8/Math.max(.1,state.zoom),q={...p};let dx=tolerance,dy=tolerance;for(const g of page().guides||[]){if(g.axis==='x'&&Math.abs(g.value-p.x)<dx){q.x=g.value;dx=Math.abs(g.value-p.x)}if(g.axis==='y'&&Math.abs(g.value-p.y)<dy){q.y=g.value;dy=Math.abs(g.value-p.y)}}return q}

function addGuide(axis){const p=page();p.guides=p.guides||[];p.guides.push({axis,value:(axis==='x'?p.width:p.height)/2});renderGuides();commit()}
function clearGuides(){page().guides=[];renderGuides();commit()}
function pointer(ev){const raw=canvas.getPointer(ev);return snapGuidePoint(objectSnapPoint(raw)||snapPoint(raw))}

let polyDraft=null;
function finishPolyline(){if(!polyDraft)return;const pts=polyDraft.points||[];polyDraft=null;if(pts.length<2)return;const shape=new fabric.Polyline(pts,{...style(),fill:'',stroke:$('stroke').value,strokeWidth:Math.max(1,Number($('strokeWidth').value)||2),objectCaching:false});add(shape,'Полилиния');setTool('select')}
function cancelPolyline(){polyDraft=null;canvas.requestRenderAll()}
function editPolylineNodes(o){if(!o||o.type!=='polyline')return;const controls={};o.points.forEach((_,i)=>{controls['node'+i]=new fabric.Control({positionHandler:function(dim,finalMatrix,obj){const pt=obj.points[i],local=new fabric.Point(pt.x-obj.pathOffset.x,pt.y-obj.pathOffset.y);return fabric.util.transformPoint(local,fabric.util.multiplyTransformMatrices(obj.canvas.viewportTransform,obj.calcTransformMatrix()))},actionHandler:function(e,transform,x,y){const obj=transform.target,m=fabric.util.multiplyTransformMatrices(obj.canvas.viewportTransform,obj.calcTransformMatrix()),local=fabric.util.transformPoint(new fabric.Point(x,y),fabric.util.invertTransform(m));obj.points[i]={x:local.x+obj.pathOffset.x,y:local.y+obj.pathOffset.y};obj.__vsLastNodeIndex=i;obj.dirty=true;obj.setCoords();obj.canvas.requestRenderAll();return true},mouseUpHandler:function(){commit();return true},actionName:'modifyNode',cornerStyle:'circle',cornerColor:'#8fe4ff',cornerSize:10})});o.controls=controls;canvas.setActiveObject(o);canvas.requestRenderAll();status('Редактиране на възли: плъзни сините точки.')}
function editBezierHandles(o){if(!o||o.type!=='path'||!o.path.some(c=>c[0]==='C'))return;const controls={};o.path.forEach((cmd,i)=>{const indexes=cmd[0]==='M'?[1]:cmd[0]==='C'?[1,3,5]:[];indexes.forEach(k=>{const id='bezier'+i+'_'+k;controls[id]=new fabric.Control({positionHandler:function(dim,m,obj){const c=obj.path[i],point=new fabric.Point(c[k]-obj.pathOffset.x,c[k+1]-obj.pathOffset.y);return fabric.util.transformPoint(point,fabric.util.multiplyTransformMatrices(obj.canvas.viewportTransform,obj.calcTransformMatrix()))},actionHandler:function(evt,transform,x,y){const obj=transform.target,m=fabric.util.multiplyTransformMatrices(obj.canvas.viewportTransform,obj.calcTransformMatrix());const local=fabric.util.transformPoint(new fabric.Point(x,y),fabric.util.invertTransform(m));obj.path[i][k]=local.x+obj.pathOffset.x;obj.path[i][k+1]=local.y+obj.pathOffset.y;obj.dirty=true;obj.canvas.requestRenderAll();return true},mouseUpHandler:function(evt,transform){transform.target.setCoords();commit();return true},actionName:'modifyBezier',cornerStyle:'circle',cornerColor:k===5||cmd[0]==='M'?'#8fe4ff':'#ffb45b',cornerStrokeColor:'#10243f',cornerSize:10})})});o.controls=controls;canvas.setActiveObject(o);canvas.requestRenderAll();status('Безие: сини възли и оранжеви управляващи дръжки.')}
// Extend existing polyline editing without changing document serialization or Fabric.js.
function addPolylineNode(){
 const o=selected();if(o?.type!=='polyline'||o.points.length<2){status('Избери полилиния с поне две точки.');return}
 // Insert halfway along the longest segment; existing vertices remain untouched.
 let index=0,length=-1;
 for(let i=0;i<o.points.length-1;i++){
  const a=o.points[i],b=o.points[i+1],d=(a.x-b.x)**2+(a.y-b.y)**2;
  if(d>length){length=d;index=i}
 }
 const a=o.points[index],b=o.points[index+1];
 o.points.splice(index+1,0,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});
 o.__vsLastNodeIndex=index+1;o.dirty=true;o.setCoords();editPolylineNodes(o);commit();
 status('Добавен е възел в средата на най-дългия сегмент.');
}
// Stage 27: insert a vertex into a specifically chosen segment, preserving the original geometry.
function insertPolylineNodeAtSegment(){
 const o=selected();
 if(o?.type!=='polyline'||o.group||!Array.isArray(o.points)||o.points.length<2||isClosedPolyline(o)){
  status('Избери една самостоятелна отворена полилиния.');return;
 }
 const layer=objectLayer(o);
 if(!layer||layer.locked||layer.visible===false){status('Слоят е заключен или скрит.');return;}
 const raw=prompt('Номер на сегмента (1–'+(o.points.length-1)+'):', '1');
 if(raw===null)return;
 if(!/^\d+$/.test(raw.trim())){status('Въведи цял номер на сегмент.');return;}
 const i=Number(raw)-1;
 if(i<0||i>=o.points.length-1){status('Невалиден номер на сегмент.');return;}
 const a=o.points[i],b=o.points[i+1];
 if(Math.hypot(b.x-a.x,b.y-a.y)<1e-9){status('Нулев сегмент не може да бъде разделен.');return;}
 const point={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
 o.points.splice(i+1,0,point);o.__vsLastNodeIndex=i+1;
 o.dirty=true;o.setCoords();editPolylineNodes(o);commit();
 status('Добавен възел в сегмент '+(i+1)+'.');
}
function removePolylineNode(){
 const o=selected();if(o?.type!=='polyline'){status('Избери полилиния.');return}
 if(o.points.length<=2){status('Полилинията трябва да запази поне две точки.');return}
 const index=Number.isInteger(o.__vsLastNodeIndex)?Math.min(o.__vsLastNodeIndex,o.points.length-1):o.points.length-1;
 o.points.splice(index,1);delete o.__vsLastNodeIndex;
 o.dirty=true;o.setCoords();editPolylineNodes(o);commit();
 status('Премахнат е възел от полилинията.');
}
function enableNodeEditing(){const o=selected();if(o?.type==='polyline')editPolylineNodes(o);else if(o?.type==='path'&&o.path.some(c=>c[0]==='C'))editBezierHandles(o);else status('Избери полилиния или крива на Безие.')}
let bezierDraft=null;
function bezierCommands(pts){if(pts.length<2)return [];const cmds=[['M',pts[0].x,pts[0].y]];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],dx=(b.x-a.x)/3;cmds.push(['C',a.x+dx,a.y,b.x-dx,b.y,b.x,b.y])}return cmds}
function renderBezierPreview(){const old=$('bezierPreview');if(old)old.remove();if(!bezierDraft||!bezierDraft.points.length)return;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='bezierPreview';svg.setAttribute('viewBox', '0 0 '+page().width+' '+page().height);svg.setAttribute('preserveAspectRatio','none');Object.assign(svg.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'7'});const pts=[...bezierDraft.points];if(bezierDraft.cursor)pts.push(bezierDraft.cursor);const commands=bezierCommands(pts);if(commands.length){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',commands.map(c=>c.join(' ')).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke','#e67424');path.setAttribute('stroke-width',String(2/Math.max(.2,state.zoom)));path.setAttribute('stroke-dasharray','5 3');svg.append(path)}for(const point of bezierDraft.points){const dot=document.createElementNS(svg.namespaceURI,'circle');dot.setAttribute('cx',point.x);dot.setAttribute('cy',point.y);dot.setAttribute('r',String(4/Math.max(.2,state.zoom)));dot.setAttribute('fill','#8fe4ff');dot.setAttribute('stroke','#0b1830');svg.append(dot)}$('paperWrap').append(svg)}
function finishBezier(){if(!bezierDraft)return;let pts=bezierDraft.points;bezierDraft=null;const old=$('bezierPreview');if(old)old.remove();if(pts.length<2)return;if(pts.length>2&&Math.hypot(pts.at(-1).x-pts.at(-2).x,pts.at(-1).y-pts.at(-2).y)<3)pts=pts.slice(0,-1);const path=new fabric.Path(bezierCommands(pts),{fill:'',stroke:$('stroke').value,strokeWidth:Math.max(1,Number($('strokeWidth').value)||2),objectCaching:false});add(path,'Крива на Безие');setTool('select');canvas.setActiveObject(path);canvas.requestRenderAll();renderProperties()}
function cancelBezier(){bezierDraft=null;const old=$('bezierPreview');if(old)old.remove();canvas.requestRenderAll()}

function setupDrawing(){let down=null,origX=0,origY=0;
  const release=()=>{
    if(!down)return;
    const finished=down;down=null;
    // Pan uses a plain pointer-position object, not a Fabric object.
    if(typeof finished.setCoords==='function'){finished.setCoords();commit()}
  };
  releaseDrawingGesture=release;
  // Fabric owns ordinary canvas events. Do not replay private _onMouseUp or
  // change _currentTransform from capture listeners during a normal drag.
  // On a release outside, cancel the stale transform only after Fabric missed it.
  const outsideCanvas=e=>{
    const el=canvas?.upperCanvasEl;
    return !!el && e?.target!==el && !el.contains(e?.target);
  };
  window.addEventListener('mouseup',e=>{
    if(outsideCanvas(e) && canvas?._currentTransform){
      canvas._currentTransform=null;
      canvas.requestRenderAll();
    }
  });
  window.addEventListener('blur',()=>{
    if(canvas?._currentTransform){canvas._currentTransform=null;canvas.requestRenderAll();}
  });
  window.addEventListener('mouseup',release);
  window.addEventListener('pointerup',release);
  window.addEventListener('blur',release);
  canvas.on('mouse:down',opt=>{if(typeof meshDragMode!=='undefined'&&meshDragMode){meshDragDown(opt);return;}if(down)release();const e=opt.e;if(state.tool==='knife-polyline'){cutSelectedPolylineAt(pointer(e));return;}if(state.tool==='knife-bezier'){cutSelectedBezierAt(pointer(e));return;}if(state.tool==='knife-polygon'){polygonKnifeClick(pointer(e));return;}if(state.tool==='shape-region'){shapeRegionClick(pointer(e));return;}if(state.tool==='pan'){down={clientX:e.clientX,clientY:e.clientY};return}if(state.tool==='bezier'){const p=pointer(e);if(!bezierDraft)bezierDraft={points:[]};bezierDraft.points.push({x:p.x,y:p.y});renderBezierPreview();status('Крива: '+bezierDraft.points.length+' точки');return}if(state.tool==='polyline'){const p=pointer(e);if(!polyDraft)polyDraft={points:[]};polyDraft.points.push({x:p.x,y:p.y});status('Точки: '+polyDraft.points.length+' · двоен клик за край');return}if(state.tool==='select'||state.tool==='pencil')return;if(objectLayer({layerId:state.activeLayer})?.locked)return;const p=pointer(e),s=style();origX=p.x;origY=p.y;if(state.tool==='text'){const o=add(new fabric.Textbox('Двоен клик за текст',{left:p.x,top:p.y,width:Math.max(140,Math.min(340,page().width-p.x-15)),fontSize:Number($('fontSize').value)||22,fontFamily:'Arial',fill:s.fill,strokeWidth:0,breakWords:false}),'Текст');o.enterEditing();return}if(state.tool==='triangle')down=add(new fabric.Triangle({left:p.x,top:p.y,width:1,height:1,...s}),'Триъгълник');if(state.tool==='symbol'){const r=new fabric.Circle({left:p.x,top:p.y,radius:17,fill:'#d3eeff',stroke:s.stroke,strokeWidth:2});const t=new fabric.Text('S',{left:p.x+10,top:p.y+6,fontSize:18,fill:'#174974'});add(new fabric.Group([r,t],{left:p.x,top:p.y,itemType:'symbol',itemName:'Символ',symbolCode:'S'}),'Символ');return}if(state.tool==='eyedrop'){const o=canvas.findTarget(e);if(o&&typeof o.fill==='string')$('fill').value=o.fill;return}if(state.tool==='line'||state.tool==='arrow')down=add(new fabric.Line([p.x,p.y,p.x,p.y],{...s,fill:undefined}),'Линия');if(state.tool==='rect')down=add(new fabric.Rect({left:p.x,top:p.y,width:1,height:1,...s}),'Правоъгълник');if(state.tool==='ellipse')down=add(new fabric.Ellipse({left:p.x,top:p.y,rx:1,ry:1,...s}),'Елипса');});canvas.on('mouse:dblclick',()=>{if(state.tool==='polyline')finishPolyline();if(state.tool==='bezier')finishBezier()});canvas.on('mouse:move',opt=>{if(typeof meshDragMode!=='undefined'&&meshDragMode){meshDragMove(opt);return;}if(down&&opt.e&&typeof opt.e.buttons==='number'&&opt.e.buttons===0)release();const p=pointer(opt.e);if(state.tool==='bezier'&&bezierDraft){bezierDraft.cursor={x:p.x,y:p.y};renderBezierPreview()}$('cursor').textContent=`X: ${Math.round(p.x)} · Y: ${Math.round(p.y)}`;if(!down)return;if(state.tool==='pan'){const area=$('scrollArea');area.scrollLeft-=opt.e.clientX-down.clientX;area.scrollTop-=opt.e.clientY-down.clientY;down={clientX:opt.e.clientX,clientY:opt.e.clientY};return}if(['line','arrow'].includes(state.tool))down.set({x2:p.x,y2:p.y});if(state.tool==='rect'||state.tool==='triangle')down.set({left:Math.min(p.x,origX),top:Math.min(p.y,origY),width:Math.max(1,Math.abs(p.x-origX)),height:Math.max(1,Math.abs(p.y-origY))});if(state.tool==='ellipse')down.set({left:Math.min(p.x,origX),top:Math.min(p.y,origY),rx:Math.max(1,Math.abs(p.x-origX)/2),ry:Math.max(1,Math.abs(p.y-origY)/2)});canvas.requestRenderAll()});canvas.on('mouse:up',opt=>{if(typeof meshDragMode!=='undefined'&&meshDragMode){meshDragUp();return;}release();});canvas.on('after:render',()=>{if(typeof meshDrawHandles==='function')meshDrawHandles();});canvas.on('object:modified',commit);canvas.on('object:added',()=>{if(!state.busy)renderAll()});canvas.on('object:removed',()=>{if(!state.busy)commit()});canvas.on('path:created',e=>{hydrateMeta(e.path);e.path.itemName='Рисувана линия';commit()});canvas.on('selection:created',renderProperties);canvas.on('selection:updated',renderProperties);canvas.on('selection:cleared',renderProperties)}
function getBase(){return(state.filename||'vector-studio').replace(/\.vstudio$/i,'').replace(/[^a-zA-Zа-яА-Я0-9_ -]/g,'_')}
async function save(){storeCurrent();const zip=new (requireLib('JSZip'))(),doc=serialize(),pages=doc.pages;zip.file('manifest.json',JSON.stringify({app:doc.app,schemaVersion:doc.schemaVersion,filename:doc.filename,createdAt:doc.createdAt,updatedAt:doc.updatedAt},null,2));zip.file('document.json',JSON.stringify({pages,sourceFiles:doc.sourceFiles},null,2));zip.file('assets.json',JSON.stringify(doc.assets));const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});await writeFileToDestination(blob,getBase()+'.vstudio','vstudio',{project:true})}
async function saveAs(){
 const previous=projectFileHandle;projectFileHandle=null;
 try{
   if(typeof window.showSaveFilePicker==='function'&&window.isSecureContext){await save();renderAll();return;}
   const current=getBase(),input=window.prompt('Запази проекта като (.vstudio):',current);
   if(input===null)return;
   const name=input.trim().replace(/\.vstudio$/i,'');
   if(!name||/[\\/:*?"<>|]/.test(name)){notify('Невалидно име','Въведете име без забранени символи.');return;}
   state.filename=name+'.vstudio';await save();renderAll();
 }finally{if(!projectFileHandle)projectFileHandle=previous;}
}
async function loadFile(file){let doc;if(/\.vstudio$|\.zip$/i.test(file.name)){const z=await requireLib('JSZip').loadAsync(file);const m=JSON.parse(await z.file('manifest.json').async('string')),d=JSON.parse(await z.file('document.json').async('string'));doc={...m,...d,assets:z.file('assets.json')?JSON.parse(await z.file('assets.json').async('string')):{}}}else doc=JSON.parse(await file.text());if(!doc.pages?.length||doc.schemaVersion!==1)throw Error('Неподдържан проектен формат или версия.');doc.filename=file.name.endsWith('.vstudio')?file.name:doc.filename;await restore(JSON.stringify(doc));projectFileHandle=null;state.pageHistories=new Map();commit();status('Проектът е отворен')}
function newDocument(options={}){projectFileHandle=null;state.createdAt=new Date().toISOString();const p=pageTemplate();p.name='Страница 1';p.units=options.units||'mm';p.format=options.format||'A4';p.orientation=options.orientation||'portrait';if(p.format==='Custom'){p.width=options.width;p.height=options.height;p.customWidth=options.width;p.customHeight=options.height;}else{const [w,h]=formats[p.format];p.width=p.orientation==='portrait'?w:h;p.height=p.orientation==='portrait'?h:w;}state.pages=[p];state.page=0;state.filename=(options.name||'Без име').replace(/\.vstudio$/i,'')+'.vstudio';state.assets={};state.sourceFiles=[];state.history=[];state.future=[];state.pageHistories=new Map();return displayPage(0,true).then(()=>commit())}
function openNewDocument(){const dialog=$('newDocDialog');$('newDocName').value='Нов документ';$('newDocFormat').value=page()?.format||'A4';$('newDocUnits').value=page()?.units||'mm';$('newDocOrientation').value=page()?.orientation||'portrait';$('newDocFormat').dispatchEvent(new Event('change'));dialog.showModal()}
function toPixels(value,units){return value*({mm:96/25.4,cm:96/2.54,in:96,px:1}[units]||1)}

function changePageSize(){const p=page(),format=$('paper').value;p.format=format;p.orientation=$('orientation').value;if(format==='Custom'){const w=p.customWidth||p.width,h=p.customHeight||p.height;p.width=p.orientation==='portrait'?Math.min(w,h):Math.max(w,h);p.height=p.orientation==='portrait'?Math.max(w,h):Math.min(w,h)}else{const [w,h]=formats[format];p.width=p.orientation==='portrait'?w:h;p.height=p.orientation==='portrait'?h:w}canvas.setDimensions({width:p.width,height:p.height});setZoom(state.zoom);commit()}
// A dimension is a separate editable annotation, not a live constraint on the source line.
function dimensionSelectedLine(){
 const source=selected();
 if(!source||source.type!=='line'){status('Избери една линия за оразмеряване.');return}
 const sourceLayer=layer(source.layerId);
 if(sourceLayer?.locked||sourceLayer?.visible===false){status('Слоят е заключен или скрит.');return}
 const g=cadGeometry(source);
 if(!g||g.kind!=='LINE')throw Error('Не може да се измери избраната линия.');
 const lib=window.VectorDimensions;
 if(!lib)throw Error('Модулът за размери не е зареден.');
 const unit=page().units||'px';
 const length=lib.measure(g.x1,g.y1,g.x2,g.y2,unit);
 if(length<1e-9){status('Линията е с нулева дължина.');return}
 const dx=g.x2-g.x1,dy=g.y2-g.y1,L=Math.hypot(dx,dy),nx=-dy/L,ny=dx/L;
 const offset=22, p1={x:g.x1+nx*offset,y:g.y1+ny*offset},p2={x:g.x2+nx*offset,y:g.y2+ny*offset};
 const style={stroke:'#19477b',strokeWidth:1,selectable:false,evented:false};
 const parts=[
  new fabric.Line([g.x1,g.y1,p1.x+nx*5,p1.y+ny*5],style),
  new fabric.Line([g.x2,g.y2,p2.x+nx*5,p2.y+ny*5],style),
  new fabric.Line([p1.x,p1.y,p2.x,p2.y],style),
  new fabric.Text(lib.label(length,unit),{left:(p1.x+p2.x)/2,top:(p1.y+p2.y)/2-12,originX:'center',originY:'center',fontSize:13,fill:'#19477b',backgroundColor:'#ffffff',selectable:false,evented:false})
 ];
 const annotation=new fabric.Group(parts,{objectCaching:false});
 annotation.layerId=source.layerId;annotation.countable=false;annotation.itemName='Размер: '+lib.label(length,unit);
 add(annotation,annotation.itemName);
 status('Добавен размер '+lib.label(length,unit)+' (несвързана анотация).');
}
function selectedObjects(){const s=selected();return s?.type==='activeSelection'?s.getObjects():s?[s]:[]}
async function duplicate(){const objs=selectedObjects();if(!objs.length)return;for(const o of objs){await new Promise(resolve=>o.clone(cl=>{cl.set({left:o.left+20,top:o.top+20,uid:uid()});add(cl);resolve()},['uid','layerId','itemType','itemName','countable','symbolCode','qty']))}commit()}
function removeSelection(){const obs=selectedObjects();canvas.discardActiveObject();obs.forEach(o=>canvas.remove(o));commit()}
// Phase 4: conservative boolean operations. Never destructively modify unsupported geometry.
function axisAlignedRect(o){
 if(o?.type!=='rect'||Math.abs(Number(o.skewX)||0)>1e-7||Math.abs(Number(o.skewY)||0)>1e-7)return null;
 const m=o.calcTransformMatrix(),p=(x,y)=>fabric.util.transformPoint(new fabric.Point(x,y),m);
 const w=o.width,h=o.height,points=[p(-w/2,-h/2),p(w/2,-h/2),p(w/2,h/2),p(-w/2,h/2)];
 const x1=Math.min(...points.map(t=>t.x)),y1=Math.min(...points.map(t=>t.y));
 const x2=Math.max(...points.map(t=>t.x)),y2=Math.max(...points.map(t=>t.y));
 const tolerance=1e-5;
 if(points.some(pt=>Math.min(Math.abs(pt.x-x1),Math.abs(pt.x-x2))>tolerance||Math.min(Math.abs(pt.y-y1),Math.abs(pt.y-y2))>tolerance))return null;
 return {x1,y1,x2,y2};
}
// Phase 5: convex polygon outlines in absolute canvas coordinates.
// Not a general-purpose clipping engine: no paths, circles, self-intersections or holes.
function convexOutline(o){
 if(!o||Math.abs(Number(o.skewX)||0)>1e-7||Math.abs(Number(o.skewY)||0)>1e-7)return null;
 let vertices;
 if(o.type==='rect'){
  const w=o.width,h=o.height;vertices=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
 }else if(o.type==='triangle'){
  const w=o.width,h=o.height;vertices=[[0,-h/2],[w/2,h/2],[-w/2,h/2]];
 }else if(o.type==='polygon'&&Array.isArray(o.points)){
  vertices=o.points.map(p=>[p.x-(o.pathOffset?.x||0),p.y-(o.pathOffset?.y||0)]);
 }else return null;
 if(vertices.length<3)return null;
 const m=o.calcTransformMatrix();
 return vertices.map(([x,y])=>{const p=fabric.util.transformPoint(new fabric.Point(x,y),m);return{x:p.x,y:p.y}});
}
function shapeBuilderUnion(){
 const objects=selectedObjects();
 if(objects.length<2||objects.length>12){status('Shape Builder: избери между 2 и 12 правоъгълника.');return}
 const first=objects[0],layer=objectLayer(first);
 if(!layer||layer.locked||layer.visible===false||objects.some(o=>o.layerId!==first.layerId)){
  status('Shape Builder: всички фигури трябва да са в един видим, отключен слой.');return
 }
 const regions=objects.map(axisAlignedRect);
 if(regions.some(r=>!r)){status('Shape Builder: поддържат се само осево подравнени правоъгълници.');return}
 if(typeof first.fill!=='string'||!first.fill||first.fill==='transparent'){
  status('Shape Builder: първият правоъгълник трябва да има плътно запълване.');return
 }
 let areas;
 try{areas=window.VectorBoolean.rectUnionMany(regions)}catch(e){status('Shape Builder: '+e.message);return}
 if(!areas.length)return;
 const total=areas.map(r=>new fabric.Rect({left:r.x1,top:r.y1,width:r.x2-r.x1,height:r.y2-r.y1,
  fill:first.fill,strokeWidth:0,objectCaching:false}));
 const result=total.length===1?total[0]:new fabric.Group(total,{objectCaching:false});
 result.layerId=first.layerId;hydrateMeta(result);result.itemName='Shape Builder — обединение';result.countable=false;result.qty=1;
 state.busy=true;
 try{canvas.discardActiveObject();objects.forEach(o=>canvas.remove(o));canvas.add(result);canvas.setActiveObject(result)}finally{state.busy=false}
 canvas.requestRenderAll();commit();status('Shape Builder: обединени '+objects.length+' правоъгълника.');
}
// Stage 25: interactive extraction of a rectangular arrangement cell.
// Preserve the selected sources; the result is a new independent vector rectangle.
let shapeRegionSources=null;
function activateShapeRegion(){
 const objects=selectedObjects();
 if(objects.length<2||objects.length>12){status('Shape Builder: избери 2–12 правоъгълника.');return;}
 const layer=objectLayer(objects[0]);
 if(!layer||layer.locked||layer.visible===false||objects.some(o=>o.layerId!==objects[0].layerId||o.group||!axisAlignedRect(o))){
  status('Shape Builder: необходими са осево подравнени правоъгълници в един отключен слой.');return;
 }
 shapeRegionSources=objects.slice();setTool('shape-region');
 status('Shape Builder: щракни върху област за извличане като нов правоъгълник.');
}
function shapeRegionClick(point){
 const objects=shapeRegionSources;
 if(!objects||objects.length<2){setTool('select');return;}
 const layer=objectLayer(objects[0]);
 if(!layer||layer.locked||!layer.visible||objects.some(o=>o.canvas!==canvas||o.layerId!==objects[0].layerId)){
  status('Shape Builder: изходните обекти вече не са достъпни.');setTool('select');return;
 }
 let region;
 try{region=window.VectorBoolean.rectRegionAtPoint(objects.map(axisAlignedRect),point)}catch(e){status(e.message);return;}
 if(!region){status('Shape Builder: щракни вътре в избраните правоъгълници.');return;}
 const first=objects[0];
 const result=new fabric.Rect({left:region.x1,top:region.y1,width:region.x2-region.x1,height:region.y2-region.y1,
  fill:typeof first.fill==='string'&&first.fill!=='transparent'?first.fill:'#80caff',
  stroke:first.stroke,strokeWidth:first.strokeWidth||0,opacity:first.opacity,objectCaching:false});
 result.layerId=first.layerId;hydrateMeta(result);result.itemName='Shape Builder — извлечена област';result.countable=false;result.qty=1;
 state.busy=true;try{canvas.add(result)}finally{state.busy=false}
 shapeRegionSources=null;setTool('select');canvas.setActiveObject(result);canvas.requestRenderAll();commit();
 status('Shape Builder: извлечена правоъгълна област. Оригиналите са запазени.');
}
// Stage 15: split a standalone straight line at a user-supplied fraction.
// Only straight Fabric.Line is supported; no silent conversion of curves.
function splitSelectedLine(){
 const objects=selectedObjects();
 if(objects.length!==1||objects[0].type!=='line'){
  status('Разделяне: избери една права линия. Криви и групи не се поддържат.');return;
 }
 const source=objects[0],layer=objectLayer(source);
 if(!layer||layer.locked||layer.visible===false||source.group){
  status('Разделяне: нужен е самостоятелен обект във видим, отключен слой.');return;
 }
 const input=prompt('Позиция на разделяне в % от началото (1–99):','50');
 if(input===null)return;
 const value=Number(input);
 if(!input.trim()||!Number.isFinite(value)||value<=0||value>=100){
  status('Разделяне: въведи число между 0 и 100 (без крайните стойности).');return;
 }
 const fraction=value/100;
 const offset=source.pathOffset||{x:0,y:0};
 const matrix=source.calcTransformMatrix();
 const absolute=(x,y)=>fabric.util.transformPoint(new fabric.Point(x-offset.x,y-offset.y),matrix);
 const a=absolute(source.x1,source.y1),b=absolute(source.x2,source.y2);
 const m={x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction};
 if(Math.hypot(b.x-a.x,b.y-a.y)<1e-6){status('Разделяне: линията е с нулева дължина.');return;}
 const points=[[a,m],[m,b]];
 const pieces=points.map(([start,end],i)=>{
  const line=new fabric.Line([start.x,start.y,end.x,end.y],{
   stroke:source.stroke,strokeWidth:source.strokeWidth,strokeDashArray:source.strokeDashArray?.slice()||null,
   strokeLineCap:source.strokeLineCap,opacity:source.opacity,objectCaching:false
  });
  line.layerId=source.layerId;line.itemName=(source.itemName||'Линия')+' — част '+(i+1);
  line.countable=false;line.qty=1;line.objectOpacity=source.objectOpacity;
  return line;
 });
 // Keep a single undo snapshot, with all children owned by the same layer.
 state.busy=true;
 try{
  canvas.discardActiveObject();canvas.remove(source);
  pieces.forEach(item=>{hydrateMeta(item);canvas.add(item)});
  canvas.setActiveObject(new fabric.ActiveSelection(pieces,{canvas}));
 }finally{state.busy=false}
 canvas.requestRenderAll();commit();status('Линията е разделена на две независими части.');
}
// Stage 16: split an OPEN polyline at a fraction of its full geometric length.
function splitSelectedPolyline(){
 const objects=selectedObjects();
 if(objects.length!==1||objects[0].type!=='polyline'){
  status('Разделяне: избери една отворена полилиния.');return;
 }
 const source=objects[0],lyr=objectLayer(source);
 if(!lyr||lyr.locked||lyr.visible===false||source.group){status('Разделяне: нужен е отключен, видим слой.');return;}
 const raw=source.points||[];
 if(raw.length<2||source.closed||source.path?.some?.(p=>p[0]==='Z')||
    (raw.length>2&&Math.hypot(raw[0].x-raw.at(-1).x,raw[0].y-raw.at(-1).y)<1e-7)){
  status('Разделяне: затворени и невалидни полилинии не се поддържат.');return;
 }
 const valueText=prompt('Разделяне по дължина в % (1–99):','50');
 if(valueText===null)return;
 const value=Number(valueText);
 if(!valueText.trim()||!Number.isFinite(value)||value<=0||value>=100){status('Въведи число между 0 и 100.');return;}
 const offset=source.pathOffset||{x:0,y:0},matrix=source.calcTransformMatrix();
 const pts=raw.map(p=>fabric.util.transformPoint(new fabric.Point(p.x-offset.x,p.y-offset.y),matrix));
 let halves;
 try{halves=window.VectorSplitPath.split(pts,value/100)}catch(error){status('Разделяне: '+error.message);return;}
 const pieces=halves.map((points,i)=>{
  const part=new fabric.Polyline(points.map(p=>({x:p.x,y:p.y})),{
   fill:'',stroke:source.stroke,strokeWidth:source.strokeWidth,
   strokeDashArray:source.strokeDashArray?.slice()||null,strokeLineCap:source.strokeLineCap,
   strokeLineJoin:source.strokeLineJoin,opacity:source.opacity,objectCaching:false
  });
  part.layerId=source.layerId;part.itemName=(source.itemName||'Полилиния')+' — част '+(i+1);
  part.countable=false;part.qty=1;part.objectOpacity=source.objectOpacity;
  hydrateMeta(part);return part;
 });
 state.busy=true;
 try{canvas.discardActiveObject();canvas.remove(source);pieces.forEach(part=>canvas.add(part));
  canvas.setActiveObject(new fabric.ActiveSelection(pieces,{canvas}));}finally{state.busy=false;}
 canvas.requestRenderAll();commit();status('Полилинията е разделена на две независими части.');
}
// Stage 19: conservative polyline geometry tools; no new dependencies.
function worldPolyline(o){
 if(o.type!=='polyline'||!Array.isArray(o.points)||o.points.length<2||o.group)throw Error('Избери самостоятелна полилиния');
 const m=o.calcTransformMatrix(),off=o.pathOffset||{x:0,y:0};
 return o.points.map(p=>{const v=fabric.util.transformPoint(new fabric.Point(p.x-off.x,p.y-off.y),m);return{x:v.x,y:v.y}});
}
function makeEditedPolyline(source,pts,title){
 const o=new fabric.Polyline(pts,{fill:'',stroke:source.stroke,strokeWidth:source.strokeWidth,strokeDashArray:source.strokeDashArray?.slice()||null,strokeLineCap:source.strokeLineCap,strokeLineJoin:source.strokeLineJoin,opacity:source.opacity,objectCaching:false});
 o.layerId=source.layerId;o.itemName=title;o.countable=source.countable;o.qty=source.qty;o.objectOpacity=source.objectOpacity;hydrateMeta(o);return o;
}
function replaceWithPolylines(old,results,message){
 state.busy=true;try{canvas.discardActiveObject();old.forEach(o=>canvas.remove(o));results.forEach(o=>canvas.add(o));canvas.setActiveObject(results.length===1?results[0]:new fabric.ActiveSelection(results,{canvas}));}finally{state.busy=false}
 canvas.requestRenderAll();commit();status(message);
}
function isClosedPolyline(o){
 if(o.closed===true||o.path?.some?.(segment=>segment[0]==='Z'||segment[0]==='z'))return true;
 const points=o.points||[];
 return points.length>2&&Math.hypot(points[0].x-points.at(-1).x,points[0].y-points.at(-1).y)<1e-7;
}
function editablePolylines(count){
 const items=selectedObjects();
 if(items.length!==count||items.some(o=>o.type!=='polyline'||o.group||!objectLayer(o)||objectLayer(o).locked||objectLayer(o).visible===false))throw Error('Избери '+count+' полилиния(и) от видими, отключени слоеве');
 if(items.some(isClosedPolyline))throw Error('Инструментът поддържа само отворени полилинии. Затворените контури остават непроменени.');
 return items;
}
function simplifyPolylineTool(){try{const [source]=editablePolylines(1);const value=prompt('Толеранс за опростяване (0.1–100 px):','3');if(value===null)return;const tolerance=Number(value);if(!Number.isFinite(tolerance)||tolerance<0.1||tolerance>100)throw Error('Невалиден толеранс');const pts=worldPolyline(source),output=window.VectorPathTools.simplify(pts,tolerance);if(output.length>=pts.length){status('Няма излишни възли при този толеранс');return;}replaceWithPolylines([source],[makeEditedPolyline(source,output,source.itemName||'Опростена полилиния')],'Премахнати възли: '+(pts.length-output.length));}catch(e){status(e.message)}}
function reversePolylineTool(){try{const [source]=editablePolylines(1),pts=worldPolyline(source).reverse();replaceWithPolylines([source],[makeEditedPolyline(source,pts,source.itemName||'Обърната полилиния')],'Посоката на полилинията е обърната');}catch(e){status(e.message)}}
function breakPolylineAtNodeTool(){try{
 const [source]=editablePolylines(1),points=worldPolyline(source);
 if(points.length<3)throw Error('За разделяне са нужни поне три възела');
 const raw=prompt('Номер на вътрешния възел за разделяне (2–'+(points.length-1)+'):',String(Math.ceil(points.length/2)));
 if(raw===null)return;
 if(!/^\d+$/.test(raw.trim()))throw Error('Въведи цял номер на възел');
 const index=Number(raw)-1;
 const parts=window.VectorPathTools.splitAtVertex(points,index);
 const result=parts.map((part,i)=>makeEditedPolyline(source,part,(source.itemName||'Полилиния')+' — част '+(i+1)));
 replaceWithPolylines([source],result,'Полилинията е разделена на възел '+(index+1));
 }catch(e){status(e.message)}}
function joinPolylinesTool(){try{const items=editablePolylines(2);if(items[0].layerId!==items[1].layerId)throw Error('Полилиниите трябва да са в един слой');const parts=items.map(worldPolyline);const output=window.VectorPathTools.join(parts[0],parts[1],10/Math.max(.1,state.zoom));replaceWithPolylines(items,[makeEditedPolyline(items[0],output,'Свързана полилиния')],'Полилиниите са съединени');}catch(e){status(e.message)}}
function patternAlongPolylineTool(){try{const [source]=editablePolylines(1);const value=prompt('Интервал между маркерите (5–2000 px):','30');if(value===null)return;const spacing=Number(value);if(!Number.isFinite(spacing)||spacing<5||spacing>2000)throw Error('Невалиден интервал');const positions=window.VectorPathTools.sample(worldPolyline(source),spacing,200);if(!positions.length)throw Error('Полилинията е твърде къса');const marks=positions.map((point,i)=>{const dot=new fabric.Circle({left:point.x-3,top:point.y-3,radius:3,fill:source.stroke||'#333333',strokeWidth:0});dot.layerId=source.layerId;dot.itemName='Маркер по път '+(i+1);dot.countable=false;hydrateMeta(dot);return dot});state.busy=true;try{marks.forEach(o=>canvas.add(o))}finally{state.busy=false}commit();status('Добавени са '+marks.length+' векторни маркера по полилинията');}catch(e){status(e.message)}}

// Stage 33: convert one open polyline to a separate variable-width filled polygon.
function variableWidthStrokeTool(){try{
 const [source]=editablePolylines(1);
 const rawStart=prompt('Начална ширина (0.1–1000 px):','4');if(rawStart===null)return;
 const rawEnd=prompt('Крайна ширина (0.1–1000 px):','16');if(rawEnd===null)return;
 const start=Number(rawStart),end=Number(rawEnd);
 if(!rawStart.trim()||!rawEnd.trim()||![start,end].every(v=>Number.isFinite(v)&&v>=0.1&&v<=1000))throw Error('Ширините трябва да бъдат между 0.1 и 1000 px');
 const polygon=window.VectorVariableStroke.ribbon(worldPolyline(source),start,end);
 const result=new fabric.Polygon(polygon,{fill:source.stroke||'#333333',strokeWidth:0,opacity:source.opacity,objectCaching:false});
 result.layerId=source.layerId;result.itemName=(source.itemName||'Полилиния')+' — променлива ширина';result.countable=false;result.qty=1;result.objectOpacity=source.objectOpacity;hydrateMeta(result);
 state.busy=true;try{canvas.add(result);canvas.discardActiveObject();canvas.setActiveObject(result)}finally{state.busy=false}
 canvas.requestRenderAll();commit();status('Създаден е отделен запълнен контур с променлива ширина.');
 }catch(error){status('Променлива ширина: '+error.message)}
}

// Stage 24: conservative straight-line Knife for convex polygons and triangles.
let polygonKnifeStart=null;
function activatePolygonKnife(){
 const objects=selectedObjects();if(objects.length!==1||!['polygon','triangle'].includes(objects[0].type)||objects[0].group){status('Knife фигура: избери един триъгълник или изпъкнал многоъгълник.');return;}
 const source=objects[0],layer=objectLayer(source),pts=stage11VertexList(source);
 if(!layer||layer.locked||layer.visible===false||!pts){status('Knife фигура: необходима е изпъкнала фигура във видим отключен слой.');return;}
 knifeSource=source;polygonKnifeStart=null;setTool('knife-polygon');knifeSource=source;
 status('Knife фигура: щракни две точки от линията на разреза. Esc отменя.');
}
function polygonKnifeClick(point){
 const source=knifeSource;
 if(!source||!canvas.getObjects().includes(source)){setTool('select');status('Knife фигура: изходният обект липсва.');return;}
 const layer=objectLayer(source);if(!layer||layer.locked||layer.visible===false){setTool('select');status('Knife фигура: слоят е скрит или заключен.');return;}
 if(!polygonKnifeStart){polygonKnifeStart={x:point.x,y:point.y};status('Knife фигура: избери втора точка по линията на разреза.');return;}
 const start=polygonKnifeStart;polygonKnifeStart=null;
 let halves;try{halves=window.VectorPolygonKnife.split(stage11VertexList(source),start,point)}catch(error){status('Knife фигура: '+error.message+'. Опитай с друга линия.');return;}
 const pieces=halves.map((pts,i)=>{const obj=stage11Polygon(pts,{fill:source.fill,stroke:source.stroke,strokeWidth:source.strokeWidth,strokeDashArray:source.strokeDashArray?.slice()||null,strokeLineCap:source.strokeLineCap,strokeLineJoin:source.strokeLineJoin,opacity:source.opacity});obj.layerId=source.layerId;obj.itemName=(source.itemName||'Фигура')+' — Knife '+(i+1);obj.countable=false;obj.qty=1;obj.objectOpacity=source.objectOpacity;hydrateMeta(obj);return obj});
 state.busy=true;try{canvas.discardActiveObject();canvas.remove(source);pieces.forEach(o=>canvas.add(o))}finally{state.busy=false}
 knifeSource=null;setTool('select');canvas.setActiveObject(new fabric.ActiveSelection(pieces,{canvas}));canvas.requestRenderAll();commit();status('Knife фигура: създадени са две затворени векторни фигури.');
}

// Stage 17: mouse Knife for an already selected, open polyline only.
let knifeSource=null;
function activatePolylineKnife(){
 const objects=selectedObjects();
 if(objects.length!==1||objects[0].type!=='polyline'||objects[0].group){status('Knife: избери една самостоятелна отворена полилиния.');return;}
 const o=objects[0],lyr=objectLayer(o),pts=o.points||[];
 if(!lyr||lyr.locked||lyr.visible===false||pts.length<2||o.closed||
    (pts.length>2&&Math.hypot(pts[0].x-pts.at(-1).x,pts[0].y-pts.at(-1).y)<1e-7)){
  status('Knife: полилинията трябва да е отворена, във видим отключен слой.');return;
 }
 setTool('knife-polyline');knifeSource=o;
 status('Knife: щракни върху вътрешността на сегмент от избраната полилиния. Esc отменя.');
}
function cutSelectedPolylineAt(point){
 const source=knifeSource;
 if(!source||!canvas.getObjects().includes(source)){setTool('select');status('Knife: оригиналната полилиния липсва.');return;}
 const layer=objectLayer(source);
 if(!layer||layer.locked||layer.visible===false){setTool('select');status('Knife: слоят е заключен или скрит.');return;}
 const offset=source.pathOffset||{x:0,y:0},matrix=source.calcTransformMatrix();
 const pts=(source.points||[]).map(p=>fabric.util.transformPoint(new fabric.Point(p.x-offset.x,p.y-offset.y),matrix));
 let halves;
 try{halves=window.VectorSplitPath.cutNearest(pts,point,10/Math.max(.1,state.zoom))}
 catch(error){status('Knife: '+error.message);return;}
 const parts=halves.map((points,i)=>{
  const part=new fabric.Polyline(points,{fill:'',stroke:source.stroke,strokeWidth:source.strokeWidth,
   strokeDashArray:source.strokeDashArray?.slice()||null,strokeLineCap:source.strokeLineCap,
   strokeLineJoin:source.strokeLineJoin,opacity:source.opacity,objectCaching:false});
  part.layerId=source.layerId;part.itemName=(source.itemName||'Полилиния')+' — Knife '+(i+1);
  part.countable=false;part.qty=1;part.objectOpacity=source.objectOpacity;hydrateMeta(part);return part;
 });
 state.busy=true;
 try{canvas.discardActiveObject();canvas.remove(source);parts.forEach(p=>canvas.add(p));}
 finally{state.busy=false;}
 knifeSource=null;setTool('select');canvas.setActiveObject(new fabric.ActiveSelection(parts,{canvas}));
 canvas.requestRenderAll();commit();status('Knife: полилинията е разрязана на две части.');
}
// Stage 18: interactive Knife for an open cubic Bezier path (M followed by C segments).
function activateBezierKnife(){
 const objects=selectedObjects();
 if(objects.length!==1||objects[0].type!=='path'||objects[0].group){status('Knife Безие: избери една самостоятелна крива.');return;}
 const o=objects[0],layer=objectLayer(o),cmd=o.path||[];
 if(!layer||layer.locked||layer.visible===false||cmd.length<2||cmd[0][0]!=='M'||cmd.slice(1).some(c=>c[0]!=='C')||Math.hypot(cmd[0][1]-cmd.at(-1)?.[5],cmd[0][2]-cmd.at(-1)?.[6])<1e-7||(o.fill&&o.fill!=='none')){
  status('Knife Безие: поддържа отворени незапълнени M/C криви във видим отключен слой.');return;
 }
 setTool('knife-bezier');knifeSource=o;
 status('Knife Безие: щракни близо до кривата; Esc отменя.');
}
function cutSelectedBezierAt(point){
 const source=knifeSource;
 if(!source||!canvas.getObjects().includes(source)){setTool('select');status('Knife Безие: оригиналната крива липсва.');return;}
 const layer=objectLayer(source);
 if(!layer||layer.locked||layer.visible===false){setTool('select');status('Knife Безие: слоят е заключен или скрит.');return;}
 const offset=source.pathOffset||{x:0,y:0},matrix=source.calcTransformMatrix();
 const transform=(x,y)=>fabric.util.transformPoint(new fabric.Point(x-offset.x,y-offset.y),matrix);
 const cmds=source.path.map(c=>{
  const out=[c[0]];for(let i=1;i<c.length;i+=2){const q=transform(c[i],c[i+1]);out.push(q.x,q.y);}return out;
 });
 let halves;
 try{halves=window.VectorSplitPath.cutBezier(cmds,point,10/Math.max(.1,state.zoom));}
 catch(error){status('Knife Безие: '+error.message);return;}
 const parts=halves.map((commands,i)=>{
  const part=new fabric.Path(commands,{fill:'',stroke:source.stroke,strokeWidth:source.strokeWidth,
   strokeDashArray:source.strokeDashArray?.slice()||null,strokeLineCap:source.strokeLineCap,
   strokeLineJoin:source.strokeLineJoin,opacity:source.opacity,objectCaching:false});
  part.layerId=source.layerId;part.itemName=(source.itemName||'Крива Безие')+' — Knife '+(i+1);
  part.countable=false;part.qty=1;part.objectOpacity=source.objectOpacity;hydrateMeta(part);return part;
 });
 state.busy=true;
 try{canvas.discardActiveObject();canvas.remove(source);parts.forEach(p=>canvas.add(p));}
 finally{state.busy=false;}
 knifeSource=null;setTool('select');canvas.setActiveObject(new fabric.ActiveSelection(parts,{canvas}));
 canvas.requestRenderAll();commit();status('Knife Безие: кривата е разделена на две части.');
}
function shapeBoolean(operation){
 const objects=selectedObjects();
 if(objects.length!==2){status('Избери точно две фигури.');return}
 const [first,second]=objects, a=axisAlignedRect(first),b=axisAlignedRect(second);
 if((!a||!b)&&operation!=='intersect'){status('Обединяване и изрязване засега поддържат само осево подравнени правоъгълници.');return}
 if(operation==='intersect'&&(!convexOutline(first)||!convexOutline(second))){status('Сечение: поддържат се само правоъгълници, триъгълници и изпъкнали многоъгълници.');return}
 if(first.layerId!==second.layerId||objectLayer(first)?.locked||objectLayer(first)?.visible===false){status('Избери два правоъгълника от един видим, отключен слой.');return}
 if(!first.fill||first.fill==='transparent'||first.fill===''||typeof first.fill!=='string'){status('Първата фигура трябва да има плътно запълване.');return}
 let result;
 if(operation==='intersect'){
  let polygon;
  try{polygon=window.VectorBoolean.convexIntersection(convexOutline(first),convexOutline(second))}
  catch(error){status('Сечение: '+error.message+'. Оригиналите са запазени.');return}
  if(!polygon.length){status('Резултатът е празен. Оригиналните фигури са запазени.');return}
  const minX=Math.min(...polygon.map(p=>p.x)),minY=Math.min(...polygon.map(p=>p.y));
  result=new fabric.Polygon(polygon.map(p=>({x:p.x-minX,y:p.y-minY})),{
   left:minX,top:minY,fill:first.fill,strokeWidth:0,objectCaching:false});
 }else{
  const parts=window.VectorBoolean.rectBoolean(a,b,operation);
  if(!parts.length){status('Резултатът е празен. Оригиналните фигури са запазени.');return}
  // Rectangle-based subtraction / union deliberately retain their original implementation.
  const total=parts.map(r=>new fabric.Rect({left:r.x1,top:r.y1,width:r.x2-r.x1,height:r.y2-r.y1,
   fill:first.fill,strokeWidth:0,objectCaching:false}));
  result=total.length===1?total[0]:new fabric.Group(total,{objectCaching:false});
 }
 result.layerId=first.layerId;hydrateMeta(result);result.itemName={'union':'Обединение','intersect':'Сечение','subtract':'Изрязване','exclude':'Симетрична разлика'}[operation];
 result.countable=false;result.qty=1;
 state.busy=true;
 try{canvas.discardActiveObject();canvas.remove(first,second);canvas.add(result);canvas.setActiveObject(result)}finally{state.busy=false}
 canvas.requestRenderAll();commit();status('Готово: '+result.itemName+'.');
}
// Phase 6: non-destructive offset with exact geometry for axis-aligned rectangles and circles.
function shapeContour(){
 const originals=selectedObjects();
 if(originals.length!==1){status('Контур: избери един правоъгълник, окръжност или изпъкнал многоъгълник.');return}
 const original=originals[0],l=objectLayer(original);
 if(!l||l.locked||l.visible===false){status('Контур: слоят трябва да е видим и отключен.');return}
 const input=prompt('Отстояние в единици на платното (+ навън, − навътре):','10');
 if(input===null)return;
 if(!input.trim()||!Number.isFinite(Number(input))||Number(input)===0){status('Контур: въведи ненулево числово отстояние.');return}
 const distance=Number(input);
 let outline;
 try{
  const rect=axisAlignedRect(original);
  if(rect){
   const result=window.VectorContour.contourRect(rect,distance);
   outline=new fabric.Rect({left:result.x1,top:result.y1,width:result.x2-result.x1,height:result.y2-result.y1,fill:'transparent',stroke:original.stroke&&original.stroke!=='transparent'?original.stroke:'#222222',strokeWidth:Math.max(1,Number(original.strokeWidth)||1),objectCaching:false});
  }else if(original.type==='circle'){
   const g=cadGeometry(original);
   if(!g||g.kind!=='CIRCLE')throw Error('Поддържат се само окръжности без елиптично разтягане');
   const result=window.VectorContour.contourCircle({x:g.x,y:g.y,radius:g.radius},distance);
   outline=new fabric.Circle({left:result.x-result.radius,top:result.y-result.radius,radius:result.radius,fill:'transparent',stroke:original.stroke&&original.stroke!=='transparent'?original.stroke:'#222222',strokeWidth:Math.max(1,Number(original.strokeWidth)||1),objectCaching:false});
  }else if(original.type==='polygon'||original.type==='triangle'){
   const vertices=stage11VertexList(original);
   if(!vertices)throw Error('Необходим е строго изпъкнал многоъгълник (3–32 върха)');
   const points=window.VectorContour.contourConvex(vertices,distance);
   outline=stage11Polygon(points,{fill:'transparent',stroke:original.stroke&&original.stroke!=='transparent'?original.stroke:'#222222',strokeWidth:Math.max(1,Number(original.strokeWidth)||1)});
  }else throw Error('Поддържат се само осево подравнени правоъгълници, окръжности и изпъкнали многоъгълници');
 }catch(e){status('Контур: '+e.message+'. Оригиналът е запазен.');return}
 outline.layerId=original.layerId;hydrateMeta(outline);outline.itemName='Контур';outline.countable=false;outline.qty=1;
 add(outline,'Контур');status('Контурът е създаден като отделен обект; оригиналът е запазен.');
}
// Stage 3: limited geometry effects. Generated pieces are separate, non-countable vectors.
function effectOptions(message,defaultValue,min,max){
 const raw=prompt(message,String(defaultValue));if(raw===null)return null;
 const value=Number(raw);if(!raw.trim()||!Number.isInteger(value)||value<min||value>max){status(`Въведи цяло число от ${min} до ${max}.`);return null;}return value;
}
function effectAddGenerated(parts,source,label){
 if(!parts.length)return;
 const group=new fabric.Group(parts,{objectCaching:false});
 group.layerId=source.layerId;hydrateMeta(group);group.itemName=label;group.countable=false;group.qty=0;
 // One history entry for an entire generated effect; original geometry stays untouched.
 canvas.discardActiveObject();canvas.add(group);canvas.setActiveObject(group);canvas.requestRenderAll();commit();
 status(`${label}: създадени ${parts.length} векторни елемента. Оригиналите са запазени.`);
}
function shapeMultiContour(){
 const objects=selectedObjects();if(objects.length!==1){status('Избери един правоъгълник или окръжност.');return;}
 const source=objects[0],layer=objectLayer(source);if(!layer||layer.locked||!layer.visible){status('Слоят е скрит или заключен.');return;}
 const count=effectOptions('Брой контури (1–30):',5,1,30);if(count===null)return;
 const raw=prompt('Стъпка на контурите (положителна навън, отрицателна навътре):','8');if(raw===null)return;
 const step=Number(raw);if(!raw.trim()||!Number.isFinite(step)||step===0||Math.abs(step)>10000){status('Невалидна стъпка.');return;}
 const rect=axisAlignedRect(source),circle=source.type==='circle'?cadGeometry(source):null;
 const poly=!rect?stage11VertexList(source):null;
 if(!rect&&(!circle||circle.kind!=='CIRCLE')&&!poly){status('Поддържат се правоъгълници, окръжности и изпъкнали многоъгълници до 32 върха.');return;}
 const pieces=[];
 try{for(let i=1;i<=count;i++){
  const dist=step*i;let obj;
  if(rect){const r=window.VectorContour.contourRect(rect,dist);obj=new fabric.Rect({left:r.x1,top:r.y1,width:r.x2-r.x1,height:r.y2-r.y1,fill:'transparent',stroke:source.stroke&&source.stroke!=='transparent'?source.stroke:'#333333',strokeWidth:Math.max(1,source.strokeWidth||1)});}
  else if(poly){const points=window.VectorContour.contourConvex(poly,dist);obj=stage11Polygon(points,{fill:'transparent',stroke:source.stroke&&source.stroke!=='transparent'?source.stroke:'#333333',strokeWidth:Math.max(1,source.strokeWidth||1)});}
  else{const c=window.VectorContour.contourCircle({x:circle.x,y:circle.y,radius:circle.radius},dist);obj=new fabric.Circle({left:c.x-c.radius,top:c.y-c.radius,radius:c.radius,fill:'transparent',stroke:source.stroke&&source.stroke!=='transparent'?source.stroke:'#333333',strokeWidth:Math.max(1,source.strokeWidth||1)});}
  pieces.push(obj);
 }}catch(e){status('Контури: '+e.message+'. Не са направени промени.');return;}
 effectAddGenerated(pieces,source,'Contour · '+count);
}
// Stage 11: conservative expansion to triangles and matching convex polygons.
function stage11VertexList(o){
 if(!['triangle','polygon'].includes(o?.type)||o.group)return null;
 const pts=convexOutline(o);
 if(!pts||pts.length<3||pts.length>32)return null;
 // Forbid degenerate and concave input: preserves simple interpolated outlines.
 const cross=(a,b,c)=>(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
 const signs=pts.map((v,i)=>cross(v,pts[(i+1)%pts.length],pts[(i+2)%pts.length]));
 if(signs.some(v=>Math.abs(v)<1e-7)||signs.some(v=>Math.sign(v)!==Math.sign(signs[0])))return null;
 return pts;
}
function stage11Polygon(points,style){
 const minX=Math.min(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y));
 return new fabric.Polygon(points.map(p=>({x:p.x-minX,y:p.y-minY})),{left:minX,top:minY,...style,objectCaching:false});
}
function shapeBlend(){
 const objects=selectedObjects();if(objects.length!==2){status('Blend: избери точно две фигури от един и същ тип.');return;}
 const [a,b]=objects,la=objectLayer(a),lb=objectLayer(b);
 if(!la||!lb||la.id!==lb.id||la.locked||!la.visible){status('Blend: фигурите трябва да са в един видим и отключен слой.');return;}
 const polygonMode=['triangle','polygon'].includes(a.type)&&a.type===b.type;
 const pa=polygonMode?stage11VertexList(a):null,pb=polygonMode?stage11VertexList(b):null;
 if(a.type!==b.type||!['rect','circle','triangle','polygon'].includes(a.type)||a.group||b.group||
    (polygonMode&&(!pa||!pb||pa.length!==pb.length))||
    (!polygonMode&&[a,b].some(o=>o.angle||o.skewX||o.skewY||o.flipX||o.flipY))){
  status('Blend: нужни са два незавъртени правоъгълника/две окръжности или два изпъкнали многоъгълника с еднакъв брой върхове.');return;
 }
 const from=typeof a.fill==='string'?new fabric.Color(a.fill).getSource():null;
 const to=typeof b.fill==='string'?new fabric.Color(b.fill).getSource():null;
 if(!from||!to||from[3]===0||to[3]===0){status('Blend: необходимо е плътно цветово запълване.');return;}
 const steps=effectOptions('Междинни фигури (1–50):',8,1,50);if(steps===null)return;
 const lerp=(u,v,t)=>u+(v-u)*t,pieces=[];
 for(let i=1;i<=steps;i++){
  const t=i/(steps+1),fill=`rgba(${Math.round(lerp(from[0],to[0],t))},${Math.round(lerp(from[1],to[1],t))},${Math.round(lerp(from[2],to[2],t))},${lerp(from[3],to[3],t)})`;
  const common={fill,opacity:lerp(a.opacity??1,b.opacity??1,t),strokeWidth:0};
  if(polygonMode){
   const vertices=pa.map((p,j)=>({x:lerp(p.x,pb[j].x,t),y:lerp(p.y,pb[j].y,t)}));
   // Skip self-intersecting or concave intermediate shapes instead of making invalid geometry.
   const cc=vertices.map((p,j)=>{const q=vertices[(j+1)%vertices.length],r=vertices[(j+2)%vertices.length];return (q.x-p.x)*(r.y-q.y)-(q.y-p.y)*(r.x-q.x)});
   if(cc.some(v=>Math.abs(v)<1e-7)||cc.some(v=>Math.sign(v)!==Math.sign(cc[0]))){status('Blend: междинната фигура би била невалидна; няма промени.');return;}
   pieces.push(stage11Polygon(vertices,common));
  }else{
   const base={...common,left:lerp(a.left,b.left,t),top:lerp(a.top,b.top,t)};
   if(a.type==='rect')pieces.push(new fabric.Rect({...base,width:lerp(a.getScaledWidth(),b.getScaledWidth(),t),height:lerp(a.getScaledHeight(),b.getScaledHeight(),t)}));
   else pieces.push(new fabric.Circle({...base,radius:lerp(a.radius*a.scaleX,b.radius*b.scaleX,t)}));
  }
 }
 effectAddGenerated(pieces,a,'Blend · '+steps);
}
function shapeExtrude(){
 const objects=selectedObjects();if(objects.length!==1){status('Extrude: избери един правоъгълник или изпъкнал многоъгълник.');return;}
 const source=objects[0],layer=objectLayer(source),r=axisAlignedRect(source);
 const poly=source.type==='rect'?(r?[{x:r.x1,y:r.y1},{x:r.x2,y:r.y1},{x:r.x2,y:r.y2},{x:r.x1,y:r.y2}]:null):stage11VertexList(source);
 if(!layer||layer.locked||!layer.visible||!poly||source.group){status('Extrude: нужен е правоъгълник или изпъкнал многоъгълник във видим, отключен слой.');return;}
 const dxRaw=prompt('Дълбочина по X (−500 до 500):','30');if(dxRaw===null)return;
 const dyRaw=prompt('Дълбочина по Y (−500 до 500):','-25');if(dyRaw===null)return;
 const dx=Number(dxRaw),dy=Number(dyRaw);
 if(!dxRaw.trim()||!dyRaw.trim()||![dx,dy].every(v=>Number.isFinite(v)&&Math.abs(v)<=500)||(dx===0&&dy===0)){status('Extrude: невалидно отместване.');return;}
 const rgba=typeof source.fill==='string'?new fabric.Color(source.fill).getSource():null;
 if(!rgba||rgba[3]===0){status('Extrude: необходимо е плътно цветово запълване.');return;}
 const shade=amount=>`rgb(${rgba.slice(0,3).map(v=>Math.max(0,Math.min(255,Math.round(v*amount)))).join(',')})`;
 const parts=[];
 // Only faces pointing towards the extrusion vector are visible in this 2D model.
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],edgeX=b.x-a.x,edgeY=b.y-a.y;
  const winding=poly.reduce((sum,v,j)=>{const w=poly[(j+1)%poly.length];return sum+v.x*w.y-w.x*v.y},0)>0?1:-1;
  if((edgeX*dy-edgeY*dx)*winding>=-1e-9)continue;
  parts.push(stage11Polygon([a,b,{x:b.x+dx,y:b.y+dy},{x:a.x+dx,y:a.y+dy}],{fill:shade(.60+.22*(i%3)/2),stroke:source.stroke||'#25384a',strokeWidth:Math.max(.5,source.strokeWidth||1)}));
 }
 if(!parts.length){status('Extrude: не са намерени видими странични повърхности.');return;}
 effectAddGenerated(parts,source,'Extrude · 2D');
}

// Stage 4: deliberately limited, non-destructive geometric constructions.
function stage4Rectangle(){
 const objects=selectedObjects();
 if(objects.length!==1){status('Ефект: избери един правоъгълник.');return null;}
 const source=objects[0],layer=objectLayer(source),r=axisAlignedRect(source);
 if(!layer||layer.locked||!layer.visible||!r||source.group){
  status('Ефект: нужен е самостоятелен осево подравнен правоъгълник във видим, отключен слой.');return null;
 }
 return {source,r};
}
function stage4Number(message,initial,min,max){
 const raw=prompt(message,String(initial));if(raw===null)return null;
 const n=Number(raw);
 if(!raw.trim()||!Number.isFinite(n)||n<min||n>max){status(`Невалидна стойност (от ${min} до ${max}).`);return null;}
 return n;
}
function shapeBevel(){
 const data=stage4Rectangle();if(!data)return;
 const {source,r}=data,w=r.x2-r.x1,h=r.y2-r.y1;
 const max=Math.min(w,h)/2;
 if(max<=1){status('Bevel: правоъгълникът е твърде малък.');return;}
 const depth=stage4Number('Ширина на фаската:',Math.min(10,Math.floor(max)),0.5,max);
 if(depth===null)return;
 const fill=(typeof source.fill==='string'&&source.fill!=='transparent')?source.fill:'#648ab4';
 const color=new fabric.Color(fill).getSource();
 if(!color){status('Bevel: необходим е плътен цвят на запълване.');return;}
 const shade=k=>'rgb('+color.slice(0,3).map(v=>Math.round(Math.max(0,Math.min(255,v*k)))).join(',')+')';
 const polygon=(v,c)=>new fabric.Polygon(v.map(([x,y])=>({x,y})),{fill:c,strokeWidth:0,objectCaching:false});
 const {x1,y1,x2,y2}=r,d=depth;
 const parts=[
  polygon([[x1,y1],[x2,y1],[x2-d,y1+d],[x1+d,y1+d]],shade(1.25)),
  polygon([[x1,y1],[x1+d,y1+d],[x1+d,y2-d],[x1,y2]],shade(1.13)),
  polygon([[x2,y1],[x2,y2],[x2-d,y2-d],[x2-d,y1+d]],shade(.7)),
  polygon([[x1,y2],[x1+d,y2-d],[x2-d,y2-d],[x2,y2]],shade(.8)),
  new fabric.Rect({left:x1+d,top:y1+d,width:w-2*d,height:h-2*d,fill,strokeWidth:0,objectCaching:false})
 ];
 effectAddGenerated(parts,source,'Bevel · фаска');
}
function shapePerspective(){
 const data=stage4Rectangle();if(!data)return;
 const {source,r}=data,w=r.x2-r.x1;
 const shift=stage4Number('Хоризонтално изместване на горния ръб:',Math.round(w*.15),-w,w);
 if(shift===null)return;
 const inset=stage4Number('Свиване на горния ръб от всяка страна:',Math.round(w*.12),0,w*.49);
 if(inset===null)return;
 const points=[[r.x1+shift+inset,r.y1],[r.x2+shift-inset,r.y1],[r.x2,r.y2],[r.x1,r.y2]];
 const poly=new fabric.Polygon(points.map(([x,y])=>({x,y})),{
  fill:source.fill,stroke:source.stroke,strokeWidth:source.strokeWidth||0,
  opacity:source.opacity,objectCaching:false
 });
 effectAddGenerated([poly],source,'Perspective · трапец');
}
function shapeEnvelope(){
 const data=stage4Rectangle();if(!data)return;
 const {source,r}=data,h=r.y2-r.y1;
 const bend=stage4Number('Извиване на горен/долен ръб (положително надолу):',Math.round(h*.2),-h,h);
 if(bend===null)return;
 const {x1,y1,x2,y2}=r,mid=(x1+x2)/2;
 const path=new fabric.Path(`M ${x1} ${y1} Q ${mid} ${y1+bend*2} ${x2} ${y1} L ${x2} ${y2} Q ${mid} ${y2+bend*2} ${x1} ${y2} Z`,{
  fill:source.fill,stroke:source.stroke,strokeWidth:source.strokeWidth||0,
  opacity:source.opacity,objectCaching:false
 });
 effectAddGenerated([path],source,'Envelope · извити ръбове');
}


// Stage 12: sampled vector-envelope on strictly convex polygons, no source mutation.
function shapePolygonEnvelope(){
 const selected=selectedObjects();
 if(selected.length!==1){status('Envelope: избери един изпъкнал триъгълник или многоъгълник.');return;}
 const source=selected[0],layer=objectLayer(source),points=stage11VertexList(source);
 if(!layer||layer.locked||!layer.visible||!points){status('Envelope: необходим е изпъкнал многоъгълник до 32 върха във видим отключен слой.');return;}
 const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
 const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
 const width=maxX-minX,height=maxY-minY;
 if(width<1e-6||height<1e-6){status('Envelope: размерът е твърде малък.');return;}
 const bend=stage4Number('Вертикална амплитуда на извиване (единици):',Math.round(height*.15),-height,height);
 if(bend===null)return;
 const pieces=[],steps=8;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];
  for(let j=0;j<steps;j++){
   const t=j/steps,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
   // Vertical sine deformation with fixed left/right boundary; bounded approximation.
   pieces.push({x,y:y+bend*Math.sin(Math.PI*(x-minX)/width)});
  }
 }
 const warped=stage11Polygon(pieces,{fill:source.fill,stroke:source.stroke,
  strokeWidth:source.strokeWidth||0,opacity:source.opacity,objectCaching:false});
 effectAddGenerated([warped],source,'Envelope · многоъгълник');
}

// Stage 5: bounded, polygon-based four-corner mesh approximation.
// This is not an editable CorelDRAW gradient-mesh lattice: each cell is a vector facet.
// Stage 6: keep a minimal parametric recipe for generated mesh facet groups.
function meshFacetParts(r,divisions,hexColors,nodes={}){
 const w=r.x2-r.x1,h=r.y2-r.y1;
 const checkedRGB=(value)=>{const rgb=new fabric.Color(value).getSource();if(!Array.isArray(rgb)||rgb.length<3||rgb.slice(0,3).some(v=>!Number.isFinite(v)))throw Error('Невалиден цвят на мрежата: '+String(value));return rgb.slice(0,3)};
 const colors=hexColors.map(checkedRGB);
 const vertex=(x,y)=>{
  const u=x/divisions,v=y/divisions,key=x+','+y,override=nodes[key]||{};
  const weights=[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v];
  const rgb=override.color?checkedRGB(override.color):
   [0,1,2].map(ch=>Math.round(colors.reduce((acc,c,k)=>acc+c[ch]*weights[k],0)));
  return {x:r.x1+u*w+(override.dx||0),y:r.y1+v*h+(override.dy||0),rgb};
 };
 const parts=[];
 for(let y=0;y<divisions;y++)for(let x=0;x<divisions;x++){
  const a=vertex(x,y),b=vertex(x+1,y),c=vertex(x+1,y+1),d=vertex(x,y+1);
  for(const tri of [[a,b,c],[a,c,d]]){
   const color='rgb('+[0,1,2].map(ch=>Math.round(tri.reduce((total,v)=>total+v.rgb[ch],0)/3)).join(',')+')';
   parts.push(new fabric.Polygon(tri.map(v=>({x:v.x,y:v.y})),
    {fill:color,strokeWidth:0,objectCaching:false,selectable:false}));
  }
 }
 return parts;
}
function meshParameters(previous){
 const divisions=effectOptions('Мрежа: клетки по страна (2–16):',previous?.divisions||8,2,16);
 if(divisions===null)return null;
 const defaults=previous?.colors||['#f8d46a','#e26383','#4769c1','#2dc4a5'];
 const labels=['горе ляво','горе дясно','долу ляво','долу дясно'];
 const colors=[];
 for(let i=0;i<4;i++){
  const value=prompt('Mesh — цвят '+labels[i]+' (HEX #RRGGBB):',defaults[i]);
  if(value===null)return null;
  if(!/^#[0-9a-f]{6}$/i.test(value.trim())){status('Mesh: необходим е HEX цвят #RRGGBB. Няма промени.');return null;}
  colors.push(value.trim());
 }
 return {divisions,colors};
}
function shapeMeshFacets(){
 const data=stage4Rectangle();if(!data)return;
 const {source,r}=data;
 if(r.x2<=r.x1||r.y2<=r.y1){status('Mesh: невалидни размери.');return;}
 const params=meshParameters();if(!params)return;
 const group=new fabric.Group(meshFacetParts(r,params.divisions,params.colors),{objectCaching:false});
 group.layerId=source.layerId;hydrateMeta(group);
 group.itemName='Mesh · '+params.divisions+'×'+params.divisions+' (фасети)';group.countable=false;group.qty=0;
 group.vsEffectParams={kind:'mesh-facets',divisions:params.divisions,colors:params.colors,nodes:{},bounds:{...r}};
 canvas.discardActiveObject();canvas.add(group);canvas.setActiveObject(group);canvas.requestRenderAll();commit();
 status('Mesh: създаден е ефект с параметри за последваща редакция.');
}
function editMeshFacets(){
 const objects=selectedObjects();
 if(objects.length!==1||objects[0].type!=='group'||objects[0].vsEffectParams?.kind!=='mesh-facets'){
  status('Редактиране на Mesh: избери група Mesh, създадена във версия 6 или по-нова.');return;
 }
 const old=objects[0],layer=objectLayer(old);
 if(!layer||layer.locked||!layer.visible){status('Mesh: слоят е скрит или заключен.');return;}
 if(old.angle||old.skewX||old.skewY||old.flipX||old.flipY||Math.abs((old.scaleX||1)-1)>1e-6||Math.abs((old.scaleY||1)-1)>1e-6){
  status('Mesh: параметричното редактиране не поддържа завъртяна, огледална или мащабирана група.');return;
 }
 const r=old.vsEffectParams.bounds||{x1:old.left,y1:old.top,x2:old.left+old.width,y2:old.top+old.height};
 if(!(r.x2>r.x1&&r.y2>r.y1)){status('Mesh: невалидна геометрия на групата.');return;}
 const params=meshParameters(old.vsEffectParams);if(!params)return;
 const keepNodes=params.divisions===old.vsEffectParams.divisions?(old.vsEffectParams.nodes||{}):{};
 const next=new fabric.Group(meshFacetParts(r,params.divisions,params.colors,keepNodes),{objectCaching:false});
 next.layerId=old.layerId;hydrateMeta(next);next.uid=old.uid;
 next.itemName='Mesh · '+params.divisions+'×'+params.divisions+' (фасети)';
 next.countable=false;next.qty=0;next.objectOpacity=old.objectOpacity;
 next.vsEffectParams={kind:'mesh-facets',divisions:params.divisions,colors:params.colors,nodes:keepNodes,bounds:{...r}};
 // Do not remove the old group until all validation and geometry generation succeeded.
 const index=canvas.getObjects().indexOf(old);
 canvas.discardActiveObject();
 state.busy=true;
 try{canvas.remove(old);canvas.insertAt(next,index,false);canvas.setActiveObject(next);}
 finally{state.busy=false;}
 canvas.requestRenderAll();commit();status('Mesh: параметрите са актуализирани (една Undo стъпка).');
}


// Stage 7: edit individual grid vertices without altering the source rectangle.
function editMeshNode(){
 const objects=selectedObjects();
 if(objects.length!==1||objects[0].type!=='group'||objects[0].vsEffectParams?.kind!=='mesh-facets'){
  status('Mesh възел: избери една Mesh група.');return;
 }
 const old=objects[0],layer=objectLayer(old),p=old.vsEffectParams;
 if(!layer||layer.locked||!layer.visible){status('Mesh възел: слоят е недостъпен.');return;}
 if(old.angle||old.skewX||old.skewY||old.flipX||old.flipY||Math.abs((old.scaleX||1)-1)>1e-6||Math.abs((old.scaleY||1)-1)>1e-6){
  status('Mesh възел: завъртени или мащабирани групи не се поддържат.');return;
 }
 const r=p.bounds;
 if(!r){status('Mesh възел: групата е от по-стара версия и няма опорна геометрия.');return;}
 const n=p.divisions;
 const row=stage4Number('Ред на възела (0–'+n+'):',Math.floor(n/2),0,n);if(row===null||!Number.isInteger(row)){status('Mesh: нужен е цял ред.');return;}
 const col=stage4Number('Колона на възела (0–'+n+'):',Math.floor(n/2),0,n);if(col===null||!Number.isInteger(col)){status('Mesh: нужна е цяла колона.');return;}
 const key=col+','+row,current=p.nodes?.[key]||{};
 const raw=prompt('Цвят HEX #RRGGBB (празно = изчислен от ъглите):',current.color||'');if(raw===null)return;
 const color=raw.trim();if(color&&!/^#[0-9a-f]{6}$/i.test(color)){status('Mesh възел: невалиден цвят.');return;}
 const max=Math.max(r.x2-r.x1,r.y2-r.y1);
 const dx=stage4Number('Отместване по X:',current.dx||0,-max,max);if(dx===null)return;
 const dy=stage4Number('Отместване по Y:',current.dy||0,-max,max);if(dy===null)return;
 const nodes={...(p.nodes||{})};
 if(color||dx||dy)nodes[key]={...(color?{color}:{}),dx,dy};else delete nodes[key];
 // Generate replacement first; preserve the original group on invalid input or failure.
 const next=new fabric.Group(meshFacetParts(r,n,p.colors,nodes),{objectCaching:false});
 next.layerId=old.layerId;hydrateMeta(next);next.uid=old.uid;
 next.itemName=old.itemName;next.countable=false;next.qty=0;next.objectOpacity=old.objectOpacity;
 next.vsEffectParams={kind:'mesh-facets',divisions:n,colors:[...p.colors],nodes,bounds:{...r}};
 const index=canvas.getObjects().indexOf(old);canvas.discardActiveObject();state.busy=true;
 try{canvas.remove(old);canvas.insertAt(next,index,false);canvas.setActiveObject(next);}
 finally{state.busy=false;}
 canvas.requestRenderAll();commit();status('Mesh възел ('+col+','+row+'): актуализиран.');
}


// Stage 8 — on-canvas Mesh node editor. Overlay is visual only, never exported.
let meshDragMode=null;
function meshModeGroup(){
 if(!meshDragMode)return null;
 const o=list().find(x=>x.uid===meshDragMode.uid);
 if(!o||o.vsEffectParams?.kind!=='mesh-facets'||!objectLayer(o)||objectLayer(o).locked||!objectLayer(o).visible){meshDragMode=null;canvas.skipTargetFind=false;return null;}
 return o;
}
function meshModePoint(o,x,y){
 const p=o.vsEffectParams,r=p.bounds,n=p.divisions,v=p.nodes?.[x+','+y]||{};
 return {x:r.x1+x*(r.x2-r.x1)/n+(v.dx||0),y:r.y1+y*(r.y2-r.y1)/n+(v.dy||0)};
}
function toggleMeshDrag(){
 if(meshDragMode){meshDragMode=null;canvas.skipTargetFind=false;canvas.requestRenderAll();status('Mesh: визуалният редактор е изключен.');return;}
 const objects=selectedObjects();
 if(objects.length!==1||objects[0].vsEffectParams?.kind!=='mesh-facets'){status('Mesh: избери една Mesh група.');return;}
 const o=objects[0],p=o.vsEffectParams;
 if(!objectLayer(o)||objectLayer(o).locked||!objectLayer(o).visible||!p.bounds||o.angle||o.skewX||o.skewY||o.flipX||o.flipY||Math.abs((o.scaleX||1)-1)>1e-6||Math.abs((o.scaleY||1)-1)>1e-6){status('Mesh: нужен е немащабиран, незавъртян Mesh във видим и отключен слой.');return;}
 meshDragMode={uid:o.uid,drag:null};canvas.discardActiveObject();canvas.skipTargetFind=true;canvas.requestRenderAll();
 status('Mesh: влачи кръглите възли. Използвай същата команда за изход.');
}
function meshDragDown(opt){
 const o=meshModeGroup();if(!o)return false;
 const pt=canvas.getPointer(opt.e),n=o.vsEffectParams.divisions;
 let best=null,dist=Infinity;
 for(let y=0;y<=n;y++)for(let x=0;x<=n;x++){
  const v=meshModePoint(o,x,y),d=Math.hypot(v.x-pt.x,v.y-pt.y);
  if(d<dist){dist=d;best={x,y};}
 }
 if(dist<=11/Math.max(state.zoom,.15))meshDragMode.drag=best;
 return true;
}
function meshDragMove(opt){
 const o=meshModeGroup();if(!o)return false;
 const drag=meshDragMode.drag;
 if(!drag)return true;
 if(typeof opt.e.buttons==='number'&&opt.e.buttons===0){meshDragUp();return true;}
 const p=o.vsEffectParams,r=p.bounds,n=p.divisions,pt=canvas.getPointer(opt.e);
 const max=Math.max(r.x2-r.x1,r.y2-r.y1),baseX=r.x1+drag.x*(r.x2-r.x1)/n,baseY=r.y1+drag.y*(r.y2-r.y1)/n;
 drag.dx=Math.max(-max,Math.min(max,pt.x-baseX));drag.dy=Math.max(-max,Math.min(max,pt.y-baseY));
 canvas.requestRenderAll();return true;
}
function meshDragUp(){
 const o=meshModeGroup();if(!o)return false;
 const drag=meshDragMode.drag;meshDragMode.drag=null;
 if(!drag||drag.dx===undefined)return true;
 const p=o.vsEffectParams,key=drag.x+','+drag.y,old=p.nodes?.[key]||{};
 if(Math.abs((old.dx||0)-drag.dx)<.001&&Math.abs((old.dy||0)-drag.dy)<.001)return true;
 const nodes={...(p.nodes||{}),[key]:{...old,dx:drag.dx,dy:drag.dy}};
 const replacement=new fabric.Group(meshFacetParts(p.bounds,p.divisions,p.colors,nodes),{objectCaching:false});
 replacement.layerId=o.layerId;hydrateMeta(replacement);replacement.uid=o.uid;
 replacement.itemName=o.itemName;replacement.countable=false;replacement.qty=0;replacement.objectOpacity=o.objectOpacity;
 replacement.vsEffectParams={...p,nodes};
 const index=list().indexOf(o);state.busy=true;
 try{canvas.discardActiveObject();canvas.remove(o);canvas.insertAt(replacement,index,false);}
 finally{state.busy=false;}
 canvas.requestRenderAll();commit();status(`Mesh: възел ${key} е преместен.`);return true;
}
function meshDrawHandles(){
 const o=meshModeGroup();if(!o)return;
 const ctx=canvas.contextTop;if(!ctx)return;
 const n=o.vsEffectParams.divisions,z=Math.max(state.zoom,.15),drag=meshDragMode.drag;
 ctx.save();ctx.lineWidth=1.5;
 for(let y=0;y<=n;y++)for(let x=0;x<=n;x++){
  const pt=meshModePoint(o,x,y);
  if(drag&&drag.x===x&&drag.y===y&&drag.dx!==undefined){const p=o.vsEffectParams,r=p.bounds;pt.x=r.x1+x*(r.x2-r.x1)/n+drag.dx;pt.y=r.y1+y*(r.y2-r.y1)/n+drag.dy;}
  const px=pt.x*z,py=pt.y*z;
  ctx.beginPath();ctx.arc(px,py,4.2,0,Math.PI*2);
  ctx.fillStyle=(drag&&drag.x===x&&drag.y===y)?'#ff9d36':'#ffffff';ctx.fill();ctx.strokeStyle='#186bad';ctx.stroke();
 }
 ctx.restore();
}

window.addEventListener('mouseup',()=>{if(meshDragMode?.drag)meshDragUp();});
window.addEventListener('blur',()=>{if(meshDragMode?.drag)meshDragUp();});

// Phase 7: non-destructive ellipse -> editable cubic Bézier path.
// Four cubic arcs approximate an ellipse; this is NOT an exact geometric offset.
function ellipseToPath(){
 const objects=selectedObjects();
 if(objects.length!==1||objects[0].type!=='ellipse'){
  status('Преобразуване: избери една елипса.');return;
 }
 const source=objects[0],l=objectLayer(source);
 if(!l||l.locked||l.visible===false){status('Преобразуване: слоят трябва да е видим и отключен.');return}
 if(source.group||Math.abs(Number(source.skewX)||0)>1e-9||Math.abs(Number(source.skewY)||0)>1e-9){
  status('Преобразуване: не се поддържат вложени групи и изкривяване (skew).');return;
 }
 try{
  const center=source.getCenterPoint();
  const commands=window.VectorEllipsePath.ellipsePath(Number(source.rx),Number(source.ry));
  const path=new fabric.Path(commands,{
   originX:'center',originY:'center',left:center.x,top:center.y,
   angle:source.angle||0,scaleX:source.scaleX,scaleY:source.scaleY,
   flipX:!!source.flipX,flipY:!!source.flipY,
   fill:source.fill,stroke:source.stroke,strokeWidth:source.strokeWidth,
   strokeUniform:source.strokeUniform,opacity:source.opacity,
   objectCaching:false
  });
  path.layerId=source.layerId;path.itemName=(source.itemName||'Елипса')+' · Безие';
  path.itemType=source.itemType||'ellipse';path.countable=source.countable;
  path.qty=source.qty;path.symbolCode=source.symbolCode;
  add(path,path.itemName);
  status('Добавен е редактируем Безие контур (приближение с 4 кубични сегмента). Оригиналът е запазен.');
 }catch(e){status('Преобразуване: '+e.message+'. Оригиналът е запазен.');}
}
function group(){const s=selected();if(s?.type!=='activeSelection')return;const g=s.toGroup();hydrateMeta(g);g.itemName='Група';g.itemType='group';commit()}
function ungroup(){const s=selected();if(s?.type!=='group')return;const lid=s.layerId,arr=s._objects;s.toActiveSelection();arr.forEach(o=>{hydrateMeta(o);o.layerId=lid});commit()}
function addLayer(){const l=layerTemplate('Слой '+(page().layers.length+1));page().layers.push(l);state.activeLayer=l.id;commit()}
function renameLayer(){const l=layer(state.activeLayer);if(!l)return;const n=prompt('Име на слой',l.name);if(n?.trim()){l.name=n.trim();commit()}}
function deleteLayer(){if(page().layers.length===1){notify('Слоеве','Трябва да остане поне един слой.');return}const id=state.activeLayer;const replacement=page().layers.find(l=>l.id!==id);list().filter(o=>o.layerId===id).forEach(o=>o.layerId=replacement.id);page().layers=page().layers.filter(l=>l.id!==id);state.activeLayer=replacement.id;applyLayers();commit()}
async function addPage(){storeCurrent();const p=pageTemplate('Страница '+(state.pages.length+1),page().format,page().orientation);state.pages.push(p);await displayPage(state.pages.length-1,true);commit()}
async function deletePage(){if(state.pages.length===1)return notify('Страници','Документът трябва да съдържа поне една страница.');if(!confirm('Изтриване на текущата страница и всички нейни обекти?'))return;const id=page().id;state.pages.splice(state.page,1);state.page=Math.min(state.page,state.pages.length-1);state.pageHistories.delete(id);await displayPage(state.page,true);commit()}
function renamePage(){const p=page(),name=prompt('Име на страница',p.name);if(name?.trim()){p.name=name.trim();commit()}}
async function copyPage(){storeCurrent();const source=deep(page()),ids=new Map();source.id=uid();source.name=source.name+' — копие';source.layers.forEach(l=>{const old=l.id;l.id=uid();ids.set(old,l.id)});source.objects.forEach(o=>{o.uid=uid();o.layerId=ids.get(o.layerId)||source.layers[0].id});state.pages.splice(state.page+1,0,source);await displayPage(state.page+1,true);commit()}
async function movePage(offset){const from=state.page,to=from+offset;if(to<0||to>=state.pages.length)return;storeCurrent();[state.pages[from],state.pages[to]]=[state.pages[to],state.pages[from]];await displayPage(to,true);commit()}
async function exportDXF(){storeCurrent();const exporter=requireLib('VectorStudioDXFExport');const names=new Map(page().layers.map(l=>[l.id,l.name]));const cadObjects=[];const collect=(o,inheritedLayer)=>{if(o.visible===false)return;const cadLayer=inheritedLayer||names.get(o.layerId)||'0';if(o.type==='group'){o.getObjects().forEach(child=>collect(child,cadLayer));return}cadObjects.push({...o.toObject(['itemName','layerId','countable','qty']),cadLayer,cadMatrix:o.calcTransformMatrix(),...(o.type==='line'?{cadLinePoints:(()=>{const p=o.calcLinePoints();return[{x:p.x1,y:p.y1},{x:p.x2,y:p.y2}]})()}:{})})};canvas.getObjects().forEach(o=>collect(o));const txt=exporter.encode(cadObjects);exporter.validate(txt);await writeFileToDestination(new Blob([txt],{type:'application/dxf'}),getBase()+'.dxf','dxf');status('DXF е експортиран; проверете точността и поддържаните типове.')}
async function exportSVG(){const svg=canvas.toSVG();await writeFileToDestination(new Blob([svg],{type:'image/svg+xml'}),getBase()+'.svg','svg')}
async function exportPNG(){const src=canvas.toDataURL({format:'png',multiplier:Math.min(3,1/state.zoom),enableRetinaScaling:false});await writeFileToDestination(await dataToBlob(src),getBase()+'.png','png')}
async function printDocument(){
 let dialog=document.getElementById('vsPrintDialog');
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='vsPrintDialog';
  dialog.style.cssText='width:min(1100px,calc(100vw - 32px));min-width:min(760px,calc(100vw - 32px));max-height:calc(100vh - 24px);display:flex;flex-direction:column;box-sizing:border-box;border:1px solid #789;border-radius:12px;padding:18px;background:#fff;color:#182536;box-shadow:0 18px 65px #0006';
  dialog.innerHTML='<form method="dialog" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><strong style="font-size:19px">Печат на чертеж</strong><button value="cancel" type="submit">✕</button></form><div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px" id="vsPrintControls"></div><div id="vsPrintPreview" style="background:#edf0f4;overflow:auto;flex:1 1 auto;max-height:none;min-height:160px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding:16px;border-radius:6px"></div><div style="display:flex;flex:none;justify-content:space-between;align-items:center;gap:8px;margin-top:12px;position:sticky;bottom:0;background:#fff;padding:10px 0 2px;z-index:2"><span id="vsPrintStatus" style="font-size:12px"></span><div style="display:flex;gap:8px"><button type="button" id="vsPrintRefresh">Преглед</button><button type="button" id="vsPrintGo" style="background:#174a8b;color:white;border:0;border-radius:6px;padding:10px 24px;font-size:15px;font-weight:700;min-width:138px;cursor:pointer">Печат…</button></div></div>';
  dialog.style.display='none';document.body.append(dialog);
  const choices=[
   ['area','Област',[['page','Цяла страница'],['selection','Селекция (избрани обекти)']]],
   ['pages','Страници',[['all','Всички'],['current','Текуща'],['range','Диапазон']]],
   ['paper','Хартия',[['document','По документа'],['A4','A4'],['A3','A3'],['A2','A2'],['A1','A1'],['A0','A0']]],
   ['orientation','Ориентация',[['document','По документа'],['portrait','Портрет'],['landscape','Пейзаж']]],
   ['scale','Мащаб',[['fit','Побери в листа'],['actual','1:1']]],
   ['color','Цвят',[['color','Цветен'],['gray','Сива скала'],['mono','Черно-бял']]]
  ];
  const controls=dialog.querySelector('#vsPrintControls');
  for(const [id,title,opts] of choices){
   const label=document.createElement('label');label.style.cssText='display:grid;gap:3px;font-size:12px';label.textContent=title;
   const select=document.createElement('select');select.id='vsPrint_'+id;select.style.cssText='padding:6px;border:1px solid #bac4d0;border-radius:4px';
   for(const [value,text] of opts){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option)}
   label.append(select);controls.append(label);
  }
  const range=document.createElement('label');range.textContent='Номера (напр. 1-3,5)';range.style.cssText='display:grid;gap:3px;font-size:12px';
  const rangeInput=document.createElement('input');rangeInput.id='vsPrint_range';rangeInput.value='1';rangeInput.style.cssText='width:120px;padding:6px';range.append(rangeInput);controls.append(range);
  const center=document.createElement('label');center.style.cssText='display:flex;align-items:center;gap:5px;font-size:12px';
  center.innerHTML='<input id="vsPrint_center" type="checkbox" checked> Центриране';controls.append(center);
  dialog.querySelector('#vsPrintRefresh').onclick=()=>preparePrint(false).catch(e=>notify('Печат',e.message));
  dialog.querySelector('#vsPrintGo').onclick=()=>{try{printPreparedSheets()}catch(e){notify('Печат',e.message)}};
  for(const input of controls.querySelectorAll('select,input'))input.addEventListener('change',()=>preparePrint(false).catch(e=>notify('Печат',e.message)));
 }
 await preparePrint(false);
 printPreparedSheets();
}
let vsPrintBusy=false,vsPrintReady=[];
async function preparePrint(doPrint){
 if(vsPrintBusy)return;
 const dialog=document.getElementById('vsPrintDialog');if(!dialog)return;
 const get=id=>dialog.querySelector('#vsPrint_'+id).value;
 const pagesMode=get('pages'),paper=get('paper'),orientation=get('orientation'),scale=get('scale'),color=get('color'),area=get('area');
 const center=dialog.querySelector('#vsPrint_center').checked;
 const total=state.pages.length;
 const selectionIds=new Set(selectedObjects().map(o=>o.uid));
 if(area==='selection'&&!selectionIds.size)throw Error('Изберете обекти в чертежа преди печат на селекция.');
 let indices=area==='selection'?[state.page]:pagesMode==='current'?[state.page]:Array.from({length:total},(_,i)=>i);
 if(area!=='selection'&&pagesMode==='range'){
  const ids=new Set();for(const part of get('range').split(',')){const m=part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);if(!m)throw Error('Невалиден диапазон на страниците');const a=+m[1],b=m[2]?+m[2]:a;if(a<1||b>total||b<a)throw Error('Диапазонът е извън документа');for(let i=a;i<=b;i++)ids.add(i-1)}
  indices=[...ids].sort((a,b)=>a-b);
 }
 if(!indices.length)throw Error('Няма страници за печат');
 vsPrintBusy=true;const preview=dialog.querySelector('#vsPrintPreview'),info=dialog.querySelector('#vsPrintStatus'),go=dialog.querySelector('#vsPrintGo');
 go.disabled=true;vsPrintReady=[];info.textContent='Подготвяне…';preview.replaceChildren();
 const prior=state.page,zoom=state.zoom,images=[];
 try{
  storeCurrent();
  for(const i of indices){
   await displayPage(i,true);setZoom(1);
   const p=page();let source;
   if(area==='selection'){
    const all=canvas.getObjects(),previous=all.map(o=>o.visible);
    try{all.forEach(o=>{if(!selectionIds.has(o.uid))o.visible=false});canvas.requestRenderAll();source=canvas.toDataURL({format:'png',multiplier:Math.min(2,4096/Math.max(p.width,p.height)),enableRetinaScaling:false})}
    finally{all.forEach((o,j)=>{o.visible=previous[j]});canvas.requestRenderAll()}
   }else source=canvas.toDataURL({format:'png',multiplier:Math.min(2,4096/Math.max(p.width,p.height)),enableRetinaScaling:false});
   if(!source.startsWith('data:image/png'))throw Error('Не може да се визуализира страница '+(i+1));
   const img=document.createElement('img');img.src=source;img.alt='Страница '+(i+1);img.style.cssText='background:white;border:1px solid #bbc3cb;object-fit:contain;max-width:540px;max-height:58vh;box-shadow:0 2px 9px #0002';
   if(color==='gray')img.style.filter='grayscale(1)';if(color==='mono')img.style.filter='grayscale(1) contrast(1000%)';
   preview.append(img);images.push({source,width:p.width,height:p.height,number:i+1});
  }
 }finally{state.zoom=zoom;await displayPage(prior,true);go.disabled=false;vsPrintBusy=false}
 vsPrintReady=images;info.textContent=images.length+' стр. • '+(scale==='actual'?'1:1':'Побери в листа')+' • '+(paper==='document'?'Размер по документа':paper);
}
function printPreparedSheets(){
 if(vsPrintBusy||!vsPrintReady.length)throw Error('Изчакайте завършване на прегледа');
 const dialog=document.getElementById('vsPrintDialog'),get=id=>dialog.querySelector('#vsPrint_'+id).value;
 const sizes={A4:[210,297],A3:[297,420],A2:[420,594],A1:[594,841],A0:[841,1189]};
 const paper=get('paper'),orientation=get('orientation'),scale=get('scale'),color=get('color');
 const mmPerPixel=25.4/96,first=vsPrintReady[0];
 const chosen=sizes[paper]||[first.width*mmPerPixel,first.height*mmPerPixel];
 const landscape=orientation==='document'?(paper==='document'?first.width>first.height:chosen[0]>chosen[1]):orientation==='landscape';
 const widthMm=landscape?Math.max(...chosen):Math.min(...chosen),heightMm=landscape?Math.min(...chosen):Math.max(...chosen);
 const center=dialog.querySelector('#vsPrint_center').checked;
 const styleId='vsPrintStyles',rootId='vsPrintSheets';
 document.getElementById(styleId)?.remove();document.getElementById(rootId)?.remove();
 const sheet=document.createElement('div');sheet.id=rootId;
 const filter=color==='gray'?'grayscale(1)':color==='mono'?'grayscale(1) contrast(1000%)':'none';
 for(const item of vsPrintReady){
  const section=document.createElement('section'),img=document.createElement('img');
  img.src=item.source;img.alt='Страница '+item.number;
  if(scale==='actual'){img.style.width=(item.width*mmPerPixel).toFixed(3)+'mm';img.style.height=(item.height*mmPerPixel).toFixed(3)+'mm'}
  else{img.style.maxWidth='100%';img.style.maxHeight='100%'}
  img.style.filter=filter;
  section.append(img);sheet.append(section);
 }
 const css=document.createElement('style');css.id=styleId;
 css.textContent='@media screen{#vsPrintSheets{display:none!important}}'+
  '@media print{@page{size:'+widthMm.toFixed(3)+'mm '+heightMm.toFixed(3)+'mm;margin:0}'+
  'html,body{margin:0!important;padding:0!important;width:auto!important;height:auto!important;overflow:visible!important}'+
  'body>*:not(#vsPrintSheets){display:none!important}#vsPrintSheets{display:block!important;position:static!important;margin:0!important;padding:0!important}'+
  '#vsPrintSheets section{width:'+widthMm.toFixed(3)+'mm;height:'+heightMm.toFixed(3)+'mm;display:flex!important;align-items:'+(center?'center':'flex-start')+';justify-content:'+(center?'center':'flex-start')+';overflow:hidden;break-after:page;page-break-after:always}'+
  '#vsPrintSheets section:last-child{break-after:auto;page-break-after:auto}#vsPrintSheets img{display:block;object-fit:contain}}';
 document.head.append(css);document.body.append(sheet);
 window.print();
}

async function exportPDF(printViewer=null){
 const namespace=requireLib('jspdf'),jsPDF=namespace?.jsPDF;if(typeof jsPDF!=='function')throw Error('Библиотеката jsPDF не е готова. Проверете достъпа до CDN.');
 storeCurrent();
 const originalId=page().id,originalZoom=state.zoom;
 let doc;
 try{
  for(let i=0;i<state.pages.length;i++){
   await displayPage(i,true);
   const p=page(),orientation=p.width>p.height?'landscape':'portrait';
   // Fabric renders the current zoom into PNG; normalize it so PDF is independent of screen zoom.
   setZoom(1);
   const pixels=Math.max(1,p.width*p.height);
   const multiplier=Math.min(2,4096/Math.max(p.width,p.height),Math.sqrt(12000000/pixels));
   const raster=canvas.toDataURL({format:'png',multiplier,enableRetinaScaling:false});
   if(!raster||!raster.startsWith('data:image/png'))throw Error('Неуспешно растеризиране на страница '+(i+1));
   if(!doc)doc=new jsPDF({orientation,unit:'px',format:[p.width,p.height],hotfixes:['px_scaling'],compress:true});
   else doc.addPage([p.width,p.height],orientation);
   try{doc.addImage(raster,'PNG',0,0,p.width,p.height)}catch(e){throw Error('PDF страница '+(i+1)+': '+(e?.message||'грешка при вграждане на изображението'))}
  }
  if(!doc)throw Error('Няма страници за експортиране');const pdfBlob=doc.output('blob');if(!pdfBlob||pdfBlob.size<100||pdfBlob.type!=='application/pdf')throw Error('Генерираният PDF е невалиден');const result=printViewer?(printViewer.location.replace(URL.createObjectURL(pdfBlob)),true):await writeFileToDestination(pdfBlob,getBase()+'.pdf','pdf');
  if(result&&!printViewer)notify('PDF експорт',`Експортирани са ${state.pages.length} страници като изображения. PDF слоеве и векторен PDF не са реализирани.`);
 }finally{
  const original=state.pages.findIndex(p=>p.id===originalId);
  state.zoom=originalZoom;
  await displayPage(original<0?0:original,true);
 }
}
function quantitiesCSV(){return '\ufeffНаименование;Брой обекти;Количество\r\n'+quantityReport({forExport:true}).rows.map(r=>`"${r.name.replace(/"/g,'""')}";${r.count};${r.quantity}`).join('\r\n')}
async function exportCSV(){storeCurrent();const report=quantityReport({forExport:true});if(!report.rows.length){notify('CSV — няма отчетни количества','Не са зададени броими устройства. Избери устройство и натисни „Брой избраните“.');return false;}return writeFileToDestination(new Blob([quantitiesCSV()],{type:'text/csv;charset=utf-8'}),getBase()+'-quantities.csv','csv')}
async function exportXLSX(){
 storeCurrent();
 const report=quantityReport({forExport:true});
 if(!report.rows.length){
  notify('Excel — няма отчетни количества',`В текущата справка няма броими устройства. Изключени обекти: ${report.excluded}. Маркирай действителните устройства в чертежа и натисни „Брой избраните“, след което задай количеството в „Свойства“. Експортът е отменен, за да не се създава подвеждаща празна сметка.`);
  return false;
 }
 const xlsx=requireLib('XLSX'),wb=xlsx.utils.book_new();
 const rows=[['Наименование','Брой обекти','Количество'],...report.rows.map(r=>[r.name,r.count,r.quantity])];
 xlsx.utils.book_append_sheet(wb,xlsx.utils.aoa_to_sheet(rows),'Количества');
 const details=[['Страница','Слой','Наименование','Брой обекти','Количество'],...report.details.map(r=>[r.page,r.layer,r.name,r.count,r.quantity])];
 xlsx.utils.book_append_sheet(wb,xlsx.utils.aoa_to_sheet(details),'По слоеве');
 const bytes=xlsx.write(wb,{bookType:'xlsx',type:'array'});
 if(!bytes||!bytes.byteLength)throw Error('Excel библиотеката не върна валиден файл.');
 const saved=await writeFileToDestination(new Blob([bytes],{type:fileTypes.xlsx}),getBase()+'-quantities.xlsx','xlsx');
 if(saved)status(`Excel: ${report.rows.length} позиции, ${report.totalCount} обекта, количество ${report.totalQuantity}`);
 return saved;
}
function xmlEscape(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
async function exportDOCX(){const z=new (requireLib('JSZip'))(),texts=list().filter(o=>['i-text','text','textbox'].includes(o.type)).map(o=>o.text),lines=[`Vector Studio — ${getBase()}`,...texts,'','Количества',...countRows().map(([k,v])=>`${k}: ${v}`)];z.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');z.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');z.file('word/document.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+lines.map(s=>`<w:p><w:r><w:t xml:space="preserve">${xmlEscape(s)}</w:t></w:r></w:p>`).join('')+'<w:sectPr/></w:body></w:document>');await writeFileToDestination(await z.generateAsync({type:'blob'}),getBase()+'.docx','docx');notify('Word експорт','Експортирани са текстовете и количествата като DOCX. Графичният чертеж не се пренася в Word като редактируеми фигури.')}
async function imageURL(url,name){return new Promise((res,rej)=>fabric.Image.fromURL(url,img=>{if(!img)return rej(Error('Невалидно изображение'));img.scaleToWidth(Math.min(450,img.width));img.set({left:50,top:50});add(img,name||'Изображение');res()}, {crossOrigin:'anonymous'}))}
async function importFile(f){const ext=f.name.split('.').pop().toLowerCase();if(['png','jpg','jpeg','webp'].includes(ext)){const url=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(f)});state.assets[uid()]=url;await imageURL(url,f.name)}else if(ext==='dwg'){throw Error('DWG още не се поддържа директно. Експортирайте ASCII DXF от CAD приложението и импортирайте него.')}else if(ext==='dxf'){
 const reader=requireLib('VectorStudioDXF'),data=reader.parse(await f.text());
 if(!data.entities.length)throw Error('Не са открити поддържани геометрични обекти в DXF.');
 if(data.unsupported)throw Error('DXF съдържа '+data.unsupported+' неподдържани обекта ('+data.unsupportedTypes.join(', ')+'). Импортът е спрян, за да няма скрита загуба на елементи.');
 if(data.entities.some(o=>o.hasBulges))throw Error('DXF съдържа полилинии с дъги (bulge). Импортът е спрян, за да не се изкриви геометрията.');
 const candidates=[];for(const e of data.entities){let o;const options={stroke:'#2055a2',strokeWidth:1,fill:'transparent',selectable:true};
 if(e.type==='LINE')o=new fabric.Line([e.x1,-e.y1,e.x2,-e.y2],options);
 else if(e.type==='LWPOLYLINE'){if(!Array.isArray(e.points)||e.points.length<2||e.points.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw Error('DXF: невалидни координати на полилиния.');const points=e.closed?[...e.points,{...e.points[0]}]:e.points;o=new fabric.Polyline(points.map(p=>({x:p.x,y:-p.y})),options);}
 else if(e.type==='CIRCLE')o=new fabric.Circle({left:e.x-e.radius,top:-e.y-e.radius,radius:e.radius,...options});
 else if(e.type==='ARC'){let span=(e.end-e.start+360)%360;if(span===0)span=360;const count=Math.max(8,Math.ceil(span/8));const points=Array.from({length:count+1},(_,i)=>{const angle=(e.start+span*i/count)*Math.PI/180;return{x:e.x+e.radius*Math.cos(angle),y:-e.y-e.radius*Math.sin(angle)}});o=new fabric.Polyline(points,options)}
 else if(e.type==='TEXT')o=new fabric.Text(e.text||' ',{left:e.x,top:-e.y-e.height,fontSize:e.height,fill:'#2055a2'});
 else if(e.type==='POINT')o=new fabric.Circle({left:e.x-1,top:-e.y-1,radius:1,...options});
 if(o){o.itemName='CAD '+e.type+' · '+e.layer;candidates.push(o);}}
 if(!candidates.length)throw Error('Няма поддържани DXF обекти.');
 const group=new fabric.Group(candidates,{left:50,top:50});
 const factor=Math.min(1,(page().width-100)/Math.max(1,group.width),(page().height-100)/Math.max(1,group.height));
 group.scale(factor);group.setCoords();add(group,'DXF: '+f.name);
 state.sourceFiles.push({name:f.name,type:'dxf',units:data.unitCode,scaleFactor:factor,entities:data.entities.length,note:'Векторен импорт на основна геометрия; мащабът е адаптиран към страницата при необходимост.'});
 if(factor<1)notify('Импорт на DXF','Геометрията е пропорционално намалена за побиране в страницата (коефициент '+factor.toPrecision(5)+'). Това НЕ е калибриран печат 1:1.');
 status('Импортирани '+candidates.length+' DXF обекта.');
 }else if(ext==='svg'){const text=await f.text();const parsed=await new Promise((res,rej)=>fabric.loadSVGFromString(text,(objects,opts)=>res({objects,opts})));if(parsed.objects.length){const g=fabric.util.groupSVGElements(parsed.objects,parsed.opts);g.set({left:55,top:55});add(g,f.name)}}else if(['txt','csv'].includes(ext)){const txt=await f.text();add(new fabric.Textbox(txt.slice(0,5000),{left:45,top:45,width:Math.min(650,page().width-90),fontSize:16,fill:'#17253e'}),f.name)}else if(['xlsx','xls'].includes(ext)){const xlsx=requireLib('XLSX');const book=xlsx.read(await f.arrayBuffer(),{type:'array'});const sh=book.Sheets[book.SheetNames[0]];const rows=xlsx.utils.sheet_to_json(sh,{header:1}).slice(0,55);const str=rows.map(row=>row.slice(0,12).map(x=>String(x??'')).join('  |  ')).join('\n');add(new fabric.Textbox(str,{left:40,top:40,width:Math.min(720,page().width-80),fontFamily:'monospace',fontSize:14,fill:'#102d50'}),`Таблица: ${f.name}`)}else if(ext==='docx'){const mammoth=requireLib('mammoth'),result=await mammoth.extractRawText({arrayBuffer:await f.arrayBuffer()});add(new fabric.Textbox(result.value.slice(0,12000),{left:40,top:40,width:Math.min(700,page().width-80),fontSize:17,fill:'#182c4a'}),f.name)}else if(ext==='pdf'){const pdfjs=requireLib('pdfjsLib');pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';const bytes=new Uint8Array(await f.arrayBuffer());const pdf=await pdfjs.getDocument({data:bytes}).promise;const first=await pdf.getPage(1),view=first.getViewport({scale:1.4});const cvs=document.createElement('canvas');cvs.width=view.width;cvs.height=view.height;await first.render({canvasContext:cvs.getContext('2d'),viewport:view}).promise;const url=cvs.toDataURL('image/png');await imageURL(url,`PDF фон: ${f.name}`);state.sourceFiles.push({name:f.name,type:'pdf',pages:pdf.numPages,note:'Импортирана е само първата страница като изображение'})}else throw Error('Неподдържан формат: '+ext);status('Импортиран: '+f.name)}
function traceSelectedImage(){
 const obj=selected();
 if(!obj||obj.type!=='image')throw Error('Избери едно импортирано PNG/JPG изображение.');
 const layer=objectLayer(obj);if(layer?.locked||layer?.visible===false)throw Error('Слоят е заключен или скрит.');
 if(Math.abs(obj.angle||0)>1e-8||obj.skewX||obj.skewY||obj.flipX||obj.flipY||obj.cropX||obj.cropY)throw Error('Поддържат се само изображения без завъртане, изрязване и огледално обръщане.');
 const element=obj.getElement(),width=Math.floor(obj.width),height=Math.floor(obj.height);
 if(!element||!width||!height)throw Error('Невалидно изображение.');
 const step=Math.max(1,Math.ceil(Math.max(width,height)/180));
 const t=document.createElement('canvas');t.width=width;t.height=height;
 const ctx=t.getContext('2d',{willReadFrequently:true});ctx.drawImage(element,0,0,width,height);
 let pixels;try{pixels=ctx.getImageData(0,0,width,height).data}catch(e){throw Error('Не може да се прочете изображението (CORS ограничение).')}
 const answer=prompt('Праг за черно-бяла векторизация (1–254):','128');if(answer===null)return;
 const threshold=Number(answer);if(!Number.isInteger(threshold)||threshold<1||threshold>254)throw Error('Прагът трябва да е между 1 и 254.');
 const regions=VStudioTrace.trace(pixels,width,height,threshold,step,4000);
 if(!regions.length){notify('Vector Trace','Не са открити тъмни области.');return}
 const shapes=regions.map(r=>new fabric.Rect({left:r.x,top:r.y,width:r.width,height:r.height,fill:'#111111',strokeWidth:0,originX:'left',originY:'top',objectCaching:false}));
 const group=new fabric.Group(shapes,{left:obj.left,top:obj.top,originX:obj.originX||'left',originY:obj.originY||'top',scaleX:obj.scaleX,scaleY:obj.scaleY});
 group.layerId=obj.layerId;add(group,'Vector Trace — '+regions.length+' области');
 notify('Vector Trace',regions.length+' векторни области са създадени като една разгрупируема група. Изходното изображение е запазено. Резултатът е пикселна векторизация, не гладък контур.');
}
async function action(name){try{switch(name){case'effect-shadow':chooseEffect('shadow');break;case'effect-glow':chooseEffect('glow');break;case'effect-block-shadow':chooseEffect('block-shadow');break;case'effect-pattern':chooseEffect('pattern');break;case'effect-linear':chooseEffect('linear');break;case'effect-radial':chooseEffect('radial');break;case'effect-clear':chooseEffect('clear');break;case'new':openNewDocument();break;case'open':$('fileOpen').click();break;case'save':await save();break;case'save-as':await saveAs();break;case'import':$('fileImport').click();break;case'print':await printDocument();break;case'export-pdf':await exportPDF();break;case'export-svg':await exportSVG();break;case'export-dxf':await exportDXF();break;case'export-png':await exportPNG();break;case'export-xlsx':await exportXLSX();break;case'export-docx':await exportDOCX();break;case'export-csv':await exportCSV();break;case'undo':await undo();break;case'redo':await redo();break;case'zoom-in':setZoom(state.zoom*1.2);break;case'zoom-out':setZoom(state.zoom/1.2);break;case'fit':fit();break;case'add-layer':addLayer();break;case'edit-nodes':enableNodeEditing();break;case'add-node':addPolylineNode();break;case'insert-node-segment':insertPolylineNodeAtSegment();break;case'remove-node':removePolylineNode();break;case'add-guide-h':addGuide('y');break;case'add-guide-v':addGuide('x');break;case'clear-guides':clearGuides();break;case'align-left':alignSelection('left');break;case'align-center-h':alignSelection('center-h');break;case'align-right':alignSelection('right');break;case'align-top':alignSelection('top');break;case'align-center-v':alignSelection('center-v');break;case'align-bottom':alignSelection('bottom');break;case'distribute-h':alignSelection('distribute-h');break;case'distribute-v':alignSelection('distribute-v');break;case'layer-up':moveLayer(1);break;case'layer-down':moveLayer(-1);break;case'rename-layer':renameLayer();break;case'delete-layer':deleteLayer();break;case'add-page':await addPage();break;case'delete-page':await deletePage();break;case'copy-page':await copyPage();break;case'rename-page':renamePage();break;case'page-up':await movePage(-1);break;case'page-down':await movePage(1);break;case'duplicate':await duplicate();break;case'delete':removeSelection();break;case'dimension-line':dimensionSelectedLine();break;case'ellipse-to-path':ellipseToPath();break;case'contour':shapeContour();break;case'effect-multi-contour':shapeMultiContour();break;case'effect-blend':shapeBlend();break;case'effect-extrude':shapeExtrude();break;case'effect-bevel':shapeBevel();break;case'effect-perspective':shapePerspective();break;case'effect-envelope':shapeEnvelope();break;case'effect-envelope-polygon':shapePolygonEnvelope();break;case'effect-mesh-facets':shapeMeshFacets();break;case'effect-edit-mesh':editMeshFacets();break;case'effect-edit-mesh-node':editMeshNode();break;case'effect-mesh-drag':toggleMeshDrag();break;case'effect-inner-shadow':stage10InnerShadow();break;case'effect-feather':stage10Feather();break;case'effect-transparency':stage10GradientAlpha();break;case'effect-powerclip':stage10PowerClip();break;case'shape-builder-union':shapeBuilderUnion();break;case'shape-builder-region':activateShapeRegion();break;case'split-line':splitSelectedLine();break;case'split-polyline':splitSelectedPolyline();break;case'knife-polyline':activatePolylineKnife();break;case'knife-polygon':activatePolygonKnife();break;case'knife-bezier':activateBezierKnife();break;case'path-break-node':breakPolylineAtNodeTool();break;case'path-simplify':simplifyPolylineTool();break;case'path-reverse':reversePolylineTool();break;case'path-join':joinPolylinesTool();break;case'path-pattern':patternAlongPolylineTool();break;case'path-variable-width':variableWidthStrokeTool();break;case'vector-trace-mono':traceSelectedImage();break;case'symbol-insert-linked':await insertLibrarySymbol(true);break;case'symbol-update-master':await updateLinkedSymbolMaster();break;case'symbol-refresh-linked':await refreshLinkedSymbols();break;case'smart-node-snap':toggleSmartNodeSnap();break;case'smart-midpoint-snap':toggleSmartMidpointSnap();break;case'smart-intersection-snap':toggleSmartIntersectionSnap();break;case'boolean-exclude':shapeBoolean('exclude');break;case'boolean-union':shapeBoolean('union');break;case'boolean-intersect':shapeBoolean('intersect');break;case'boolean-subtract':shapeBoolean('subtract');break;case'group':group();break;case'ungroup':ungroup();break;case'select-all':canvas.discardActiveObject();canvas.setActiveObject(new fabric.ActiveSelection(list().filter(o=>o.selectable),{canvas}));canvas.requestRenderAll();renderAll();break;case'isolate':{const selectedIds=new Set(selectedObjects().map(o=>o.uid));for(const l of page().layers)l.visible=list().some(o=>selectedIds.has(o.uid)&&o.layerId===l.id);applyLayers();commit();break}case'help':document.getElementById('vs-guide-dialog')?.showModal();break}}catch(e){console.error(e);const trace=String(e?.stack||'').split('\n').slice(0,5).join('\n');notify('Грешка',String(e?.message||e)+(trace?'\n\nДиагностика:\n'+trace:''));status('Грешка: '+(e?.message||e))}}
const paletteState={recent:[],favorites:[],chosen:'#79b2ff',tab:'standard'};
const PALETTE_BASE=['#ffffff','#000000','#808080','#ff0000','#ff8000','#ffff00','#80ff00','#00bb55','#00ffff','#0080ff','#0000ff','#8000ff'];
function hslHex(h,s,l){s/=100;l/=100;const a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0')};return '#'+f(0)+f(8)+f(4)}
const PALETTE_GROUPS=Array.from({length:12},(_,i)=>Array.from({length:12},(_,j)=>hslHex(i*30,85,10+j*7)));
function paletteHex(hex){return /^#[0-9a-f]{6}$/i.test(hex)}
function updateColorFields(hex){if(!paletteHex(hex))return;paletteState.chosen=hex.toLowerCase();$('paletteHex').value=hex.toUpperCase();const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));$('paletteRGB').value=rgb.join(', ');const [r,g,b]=rgb.map(v=>v/255),hi=Math.max(r,g,b),lo=Math.min(r,g,b),diff=hi-lo;let h=0,s=0,l=(hi+lo)/2;if(diff){s=diff/(1-Math.abs(2*l-1));switch(hi){case r:h=((g-b)/diff)%6;break;case g:h=(b-r)/diff+2;break;default:h=(r-g)/diff+4}h=(h*60+360)%360}$('paletteHSL').value=Math.round(h)+'°, '+Math.round(s*100)+'%, '+Math.round(l*100)+'%'}
function applyPaletteColor(hex,target){if(!paletteHex(hex))return;updateColorFields(hex);const key=target==='stroke'?'stroke':'fill';$(key).value=hex;applyToolbarStyle(key,hex);paletteState.recent=[hex,...paletteState.recent.filter(c=>c!==hex)].slice(0,24);renderPaletteGrid()}
function colorButton(hex){const b=document.createElement('button');b.type='button';b.className='palette-color';b.style.background=hex;b.title=hex+' (ляв: запълване, десен: контур)';b.onclick=()=>applyPaletteColor(hex,'fill');b.oncontextmenu=e=>{e.preventDefault();applyPaletteColor(hex,'stroke')};return b}
function renderPaletteGrid(){const root=$('paletteGrid');root.replaceChildren();const row=(label,colors)=>{const group=document.createElement('div');group.className='palette-group';const name=document.createElement('span');name.textContent=label;group.append(name);const grid=document.createElement('div');grid.className='palette-colors';colors.forEach(c=>grid.append(colorButton(c)));group.append(grid);root.append(group)};if(paletteState.tab==='standard'){row('Основни',PALETTE_BASE);PALETTE_GROUPS.forEach((colors,i)=>row('Нюанси '+(i+1),colors));row('Сива скала',Array.from({length:16},(_,i)=>{const n=Math.round(i*255/15).toString(16).padStart(2,'0');return '#'+n.repeat(3)}))}else row(paletteState.tab==='recent'?'Последно използвани':'Любими',paletteState[paletteState.tab]);document.querySelectorAll('[data-palette-tab]').forEach(b=>b.classList.toggle('active',b.dataset.paletteTab===paletteState.tab))}
function setupPalette(){const quick=$('palette');quick.replaceChildren();PALETTE_BASE.forEach(color=>quick.append(colorButton(color)));const expand=document.createElement('button');expand.type='button';expand.textContent='+ Цветове';expand.onclick=()=>$('palettePopup').classList.toggle('hidden');quick.append(expand);$('showPalette').onclick=expand.onclick;$('closePalette').onclick=()=>$('palettePopup').classList.add('hidden');document.querySelectorAll('[data-palette-tab]').forEach(b=>b.onclick=()=>{paletteState.tab=b.dataset.paletteTab;renderPaletteGrid()});$('paletteHex').onchange=e=>{const c=e.target.value.trim();if(paletteHex(c))updateColorFields(c);else e.target.value=paletteState.chosen};$('paletteApplyFill').onclick=()=>applyPaletteColor(paletteState.chosen,'fill');$('paletteApplyStroke').onclick=()=>applyPaletteColor(paletteState.chosen,'stroke');$('paletteFavorite').onclick=()=>{const c=paletteState.chosen;paletteState.favorites=paletteState.favorites.includes(c)?paletteState.favorites.filter(x=>x!==c):[c,...paletteState.favorites];renderPaletteGrid()};updateColorFields(paletteState.chosen);renderPaletteGrid()}

// Adaptive single-row toolbar: existing tools and property handlers are reused.
function initializeAdaptiveToolbar(){
 const tools=$('tools'),appearance=$('toolbarAppearance');
 if(tools){$('toolbarTools').append(...[...tools.querySelectorAll('button')]);tools.remove();}
 const styleIds=['fill','stroke','strokeWidth','fontSize'];
 styleIds.forEach(id=>{const input=$(id);if(input?.parentElement)appearance.append(input.parentElement)});
 const layerSelect=$('toolbarLayer');
 layerSelect.onchange=()=>{
  const targets=toolbarSelectionObjects(),dest=layerSelect.value;
  if(!page().layers.some(l=>l.id===dest))return;
  if(targets.length){targets.forEach(o=>o.layerId=dest);state.activeLayer=dest;applyLayers();commit()}
  else {state.activeLayer=dest;renderAll()}
 };
 updateAdaptiveToolbar();
}
function updateAdaptiveToolbar(){
 const select=$('toolbarLayer'),title=$('toolbarObject'),appearance=$('toolbarAppearance');
 if(!select||!page())return;
 const objects=toolbarSelectionObjects(),one=objects.length===1?objects[0]:null;
 const activeId=one?.layerId||(objects.length?objects[0]?.layerId:state.activeLayer);
 const mixed=objects.length>1&&objects.some(o=>o.layerId!==activeId);
 select.replaceChildren();
 if(mixed){const option=new Option('Различни слоеве','');select.append(option)}
 for(const l of page().layers)select.append(new Option(l.name,l.id));
 select.value=mixed?'':activeId||'';
 const pageName=page().name||'Страница';
 if(!objects.length){title.textContent=pageName+' · '+(page().format||'Custom');title.title='Свойства на страницата'}
 else if(one){title.textContent=one.itemName||one.type||'Елемент';title.title=title.textContent}
 else{title.textContent=objects.length+' избрани обекта';title.title=title.textContent}
 appearance.hidden=!objects.length;
 const fontLabel=$('fontSize')?.parentElement;
 if(fontLabel)fontLabel.hidden=!objects.length||!objects.every(o=>['text','i-text','textbox'].includes(o.type));
}

function setupUI(){initializeAdaptiveToolbar();document.querySelector('[data-action="save"]').onclick=e=>{e.stopPropagation();save()};document.querySelector('[data-action="save-as"]').onclick=e=>{e.stopPropagation();saveAs()};setupToolbarStyle();$('symbolSaveSelection').onclick=()=>{try{saveSelectedSymbol()}catch(e){notify('Грешка',e.message)}};$('symbolInsert').onclick=()=>insertLibrarySymbol().catch(e=>notify('Грешка',e.message));$('symbolDelete').onclick=()=>{try{deleteLibrarySymbol()}catch(e){notify('Грешка',e.message)}};['showGrid','snapGrid','snapObjects','snapGuides','showRulers','gridStep'].forEach(id=>$(id).onchange=()=>{updateGrid();drawRulers();status('Настройките на изгледа са обновени')});$('newDocFormat').onchange=()=>{$('newDocDimensions').hidden=$('newDocFormat').value!=='Custom'};$('newDocCancel').onclick=()=>$('newDocDialog').close();$('newDocForm').onsubmit=async e=>{e.preventDefault();const format=$('newDocFormat').value,units=$('newDocUnits').value,orientation=$('newDocOrientation').value;let width,height;if(format==='Custom'){width=toPixels(Number($('newDocWidth').value),units);height=toPixels(Number($('newDocHeight').value),units);if(!Number.isFinite(width)||!Number.isFinite(height)||width<10||height<10||width>40000||height>40000){notify('Невалидни размери','Въведете положителни размери на страницата.');return}if(orientation==='landscape'&&width<height||orientation==='portrait'&&width>height)[width,height]=[height,width]}if(state.history.length>1&&!confirm('Нов документ? Незапазените промени ще бъдат загубени.'))return;await newDocument({name:$('newDocName').value.trim()||'Нов документ',format,units,orientation,width,height});$('newDocDialog').close()};$('activeOpacity').oninput=e=>setActiveOpacity(e.target.value);$('activeOpacity').onchange=e=>setActiveOpacity(e.target.value,true);// Bind existing controls once; delegate dynamic effect commands to avoid silent dead buttons.
 // A single delegated handler covers buttons added or moved by ui-layout.js.
 // Do not also assign onclick to these controls: that would execute actions twice.
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');
  if(!b||b.disabled)return;
  action(b.dataset.action);
 });document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));document.querySelectorAll('.sidebar [data-tab]').forEach(b=>b.onclick=()=>showSidebarPanel(b.dataset.tab));$('paper').onchange=changePageSize;$('orientation').onchange=changePageSize;$('pageSelect').onchange=e=>displayPage(+e.target.value);$('countVisible').onchange=renderQuantities;$('countCurrent').onchange=renderQuantities;$('countIncludeExcluded').onchange=renderQuantities;$('countSelected').onclick=()=>setSelectedCountable(true);$('uncountSelected').onclick=()=>setSelectedCountable(false);$('fileOpen').onchange=async e=>{if(e.target.files[0])try{await loadFile(e.target.files[0])}catch(err){notify('Не може да се отвори файлът',err.message)}e.target.value=''};$('fileImport').onchange=async e=>{for(const f of e.target.files){try{await importFile(f)}catch(err){notify(`Неуспешен импорт: ${f.name}`,err.message)}}e.target.value=''};setupPalette();document.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&k==='p'){e.preventDefault();e.stopPropagation();action('print');return;}if((e.ctrlKey||e.metaKey)&&k==='s'){e.preventDefault();e.stopPropagation();action(e.shiftKey?'save-as':'save');return;}if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)||selected()?.isEditing)return;if((e.ctrlKey||e.metaKey)&&k==='n'){e.preventDefault();action('new')}else if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();action('undo')}else if((e.ctrlKey||e.metaKey)&&k==='y'){e.preventDefault();action('redo')}else if((e.ctrlKey||e.metaKey)&&k==='d'){e.preventDefault();action('duplicate')}else if(k==='escape'){e.preventDefault();setTool('select')}else if(k==='enter'&&state.tool==='bezier'){finishBezier()}else if(k==='enter'&&state.tool==='polyline'){finishPolyline()}else if(k==='enter'&&state.tool==='polyline'){finishPolyline()}else if(k==='delete'||k==='backspace'){e.preventDefault();action('delete')}else if(!e.ctrlKey&&!e.metaKey){const map={v:'select',h:'pan',p:'pencil',l:'line',r:'rect',e:'ellipse',t:'text'};if(map[k])setTool(map[k])}})}
window.VectorStudioTextAccess={selection:()=>selected(),changed:()=>commit()};
async function init(){try{requireLib('fabric');canvas=new fabric.Canvas('editor',{backgroundColor:'#ffffff',preserveObjectStacking:true,selection:true,fireRightClick:true});canvas.freeDrawingBrush.width=2;canvas.freeDrawingBrush.color='#2055a2';setupUI();setupDrawing();setupWheelZoom();await newDocument();fit();setTool('select');status('Готово · библиотеки заредени')}catch(e){console.error(e);$('status').textContent='Неуспешно зареждане';notify('Неуспешно стартиране',e.message)}}window.VectorStudioInsertShape=function(shape,name){if(!canvas)throw Error('Редакторът не е готов');setTool('select');const o=add(shape,name);o.setCoords();canvas.setActiveObject(o);canvas.requestRenderAll();return o};
window.addEventListener('load',init);
})();

// Stage 37: show previously silent startup failures with a diagnostic location.
window.addEventListener('error',function(ev){if(!ev.error)return;console.error('Vector Studio startup/runtime',ev.error);const el=document.getElementById('status');if(el)el.textContent='Грешка: '+String(ev.error.message||ev.message)+' ('+(ev.filename||'')+':'+(ev.lineno||'?')+')';});
window.addEventListener('unhandledrejection',function(ev){const error=ev.reason;console.error('Vector Studio promise rejection',error);const el=document.getElementById('status');if(el)el.textContent='Грешка: '+String(error?.message||error);});