/* Vector Studio UI v3: move existing controls only, preserve bound events. */
(()=>{'use strict';
const el=(t,c,txt)=>{const e=document.createElement(t);if(c)e.className=c;if(txt)e.textContent=txt;return e};
const act=n=>document.querySelector(`[data-action="${n}"]`);
const ctrl=n=>document.getElementById(n)?.closest('label');
const move=(dest,names)=>names.forEach(n=>{const b=act(n);if(b)dest.appendChild(b)});
const menu=(host,name)=>{const d=el('details','vs-menu'),s=el('summary','',name),b=el('div','vs-menu-content');d.append(s,b);host.append(d);return b};
function init(){
 if(document.querySelector('.vs-menubar'))return;
 const header=document.querySelector('header.top'),nav=header?.querySelector('nav'),options=document.querySelector('.options'),tools=document.querySelector('.tools'),sidebar=document.querySelector('.sidebar'),palette=document.getElementById('palette');
 if(!header||!nav||!options||!tools||!sidebar||!palette)return;
 const bar=el('div','vs-menubar'),brand=document.getElementById('vs-app-brand'),menus=el('div','vs-menus');
 if(!brand)return;
 bar.append(brand,menus);
 const file=menu(menus,'Файл');
 const caption=(container,text)=>container.append(el('div','vs-file-heading',text));
 const inactive=(container,text,explanation)=>{const b=el('button','vs-file-disabled',text);b.type='button';b.disabled=true;b.title=explanation;container.append(b)};
 const item=(container,name,label)=>{const b=act(name);if(b){b.textContent=label;container.append(b)}};
 const submenu=(container,label)=>{const d=el('details','vs-file-submenu');const s=el('summary','',label);const body=el('div','vs-file-submenu-content');d.append(s,body);container.append(d);return body};
 caption(file,'Документ');
 item(file,'new','Създай…');item(file,'open','Отвори…');
 inactive(file,'Последни документи','Все още няма история на отворените документи');
 caption(file,'Записване');
 item(file,'save','Запази .vstudio   Ctrl+S');
 const saveAsButton=el('button','vs-file-command','Запази като…   Ctrl+Shift+S');saveAsButton.type='button';saveAsButton.dataset.action='save-as';file.append(saveAsButton);
 caption(file,'Обмен на файлове');
 const imports=submenu(file,'Импортиране ▸');
 item(imports,'import','Импортиране на файл…');
 const exports=submenu(file,'Експортиране ▸');
 item(exports,'export-pdf','PDF');item(exports,'export-svg','SVG');item(exports,'export-png','PNG');item(exports,'export-docx','Word (DOCX)');
 // DXF is an existing export; do not misrepresent it as working direct DWG.
 item(exports,'export-dxf','DXF (не DWG)');item(exports,'export-xlsx','Excel (количества)');item(exports,'export-csv','CSV (количества)');
 caption(file,'Печат и настройки');
 const printButton=el('button','vs-file-command','Печат…   Ctrl+P');printButton.type='button';printButton.dataset.action='print';file.append(printButton);


 const edit=menu(menus,'Редактиране');
 for(const [name,label] of [['duplicate','Дублирай'],['delete','Изтрий'],['select-all','Избери всички'],['group','Групирай'],['ungroup','Разгрупирай']]){
  const existing=act(name);
  if(existing){existing.textContent=label;edit.append(existing)}
  else{const button=el('button','vs-file-command',label);button.type='button';button.dataset.action=name;edit.append(button)}
 }
 const effects=menu(menus,'Ефекти');
 const effectAction=(action,label)=>{const b=el('button','vs-shape-action',label);b.type='button';b.dataset.action=action;effects.append(b)};
 effectAction('effect-shadow','Външна сянка…');
 effectAction('effect-glow','Светене / Glow…');
 effectAction('effect-block-shadow','Плътна сянка…');
 effectAction('effect-linear','Линеен градиент…');
 effectAction('effect-radial','Радиален градиент…');
 effectAction('effect-pattern','Шарка / Pattern Fill…');
 effectAction('effect-multi-contour','Contour — правоъгълници, окръжности и изпъкнали полигони…');
 effectAction('effect-blend','Blend — фигури и изпъкнали полигони…');
 effectAction('effect-extrude','Extrude — 2D дълбочина на полигони…');
 effectAction('effect-bevel','Bevel — фаска на правоъгълник…');
 effectAction('effect-perspective','Perspective — трапецовидна проекция…');
 effectAction('effect-envelope','Envelope — извити ръбове…');
 effectAction('effect-envelope-polygon','Envelope — извиване на изпъкнал многоъгълник…');
 effectAction('effect-mesh-facets','Mesh — мрежово преливане (фасети)…');
 effectAction('effect-edit-mesh','Редактирай Mesh — клетки и цветове…');
 effectAction('effect-edit-mesh-node','Mesh — цвят и позиция на възел…');
 effectAction('effect-mesh-drag','Mesh — визуално местене на възли (вкл./изкл.)');
 effectAction('effect-inner-shadow','Вътрешна сянка (правоъгълник)…');
 effectAction('effect-feather','Мека периферия / Feather (приближение)…');
 effectAction('effect-transparency','Градиентна прозрачност…');
 effectAction('effect-powerclip','PowerClip — изрязване по форма…');
 effectAction('effect-clear','Премахни ефектите');
 const unavailable=el('div','vs-file-heading','Все още не са внедрени');effects.append(unavailable);
 ['Blur / Motion Blur','Halftone / Mosaic','Noise / Wave'].forEach(label=>inactive(effects,label,'Ефектът изисква допълнителна реализация и тестове'));


 const view=menu(menus,'Изглед');move(view,['fit','zoom-in','zoom-out','add-guide-h','add-guide-v','clear-guides']);
 ['showGrid','snapGrid','snapObjects','snapGuides','showRulers','gridStep'].forEach(id=>{const l=ctrl(id);if(l)view.append(l)});
 const scale=menu(menus,'Мащаб');
 const dimension=el('button','vs-shape-action','Оразмери избрана линия');dimension.type='button';dimension.dataset.action='dimension-line';dimension.title='Измерва геометричната дължина в единиците на страницата и добавя независима размерна анотация';scale.append(dimension);
 scale.append(el('p','vs-unavailable','Оразмеряването е статично. Точен печатен мащаб и калибриране предстоят.'));
 const arrange=menu(menus,'Инструменти');
 const alignMenu=submenu(arrange,'Подреждане и подравняване ▸');
 for(const [key,label] of [['align-left','⇤ Подравни вляво'],['align-center-h','↔ Центрирай хоризонтално'],['align-right','⇥ Подравни вдясно'],['align-top','⤒ Подравни горе'],['align-center-v','↕ Центрирай вертикално'],['align-bottom','⤓ Подравни долу'],['distribute-h','⋯ Разпредели хоризонтално'],['distribute-v','⋮ Разпредели вертикално']]){
  const existing=act(key);
  if(existing){existing.textContent=label;alignMenu.append(existing)}
  else{const button=el('button','vs-shape-action',label);button.type='button';button.dataset.action=key;alignMenu.append(button)}
 }
 const figures=submenu(arrange,'Операции с фигури ▸');
 [['boolean-union','Обедини правоъгълници (Union)'],['boolean-subtract','Изрежи (Subtract)'],['boolean-intersect','Пресечи фигури (Intersect)'],['boolean-exclude','Изключи припокриването (Exclude)']].forEach(([key,title])=>{
  const b=el('button','vs-shape-action',title);b.type='button';b.dataset.action=key;
  b.title=key==='boolean-intersect'?'Две изпъкнали фигури от един слой':key==='boolean-exclude'?'Симетрична разлика на два осево подравнени правоъгълника':'Два осево подравнени правоъгълника от един слой';
  figures.append(b);
 });
 const builder=el('button','vs-shape-action','Shape Builder — обедини 2–12 правоъгълника');builder.type='button';builder.dataset.action='shape-builder-union';builder.title='Обединява избраните осево подравнени правоъгълници. Не поддържа интерактивен избор на региони.';figures.append(builder);
 const region=el('button','vs-shape-action','Shape Builder — извлечи област с мишката');region.type='button';region.dataset.action='shape-builder-region';region.title='Избери 2–12 правоъгълника и щракни в правоъгълна клетка. Оригиналните фигури остават.';figures.append(region);
 const geometry=submenu(arrange,'Редактиране на геометрия ▸');
 const existingNode=act('edit-nodes');if(existingNode)geometry.append(existingNode);
 for(const [key,label] of [['add-node','+ Възел'],['remove-node','− Възел']]){
  const button=el('button','vs-shape-action',label);button.type='button';button.dataset.action=key;geometry.append(button)
 }
 const insertNode=el('button','vs-shape-action','Добави възел в избран сегмент…');insertNode.type='button';insertNode.dataset.action='insert-node-segment';insertNode.title='Добавя възел в средата на сегмент с посочен номер на отворена полилиния.';geometry.append(insertNode);
 const contourBtn=el('button','vs-shape-action','Контур / Offset…');contourBtn.type='button';contourBtn.dataset.action='contour';contourBtn.title='Правоъгълник, окръжност или изпъкнал многоъгълник (3–32 върха)';geometry.append(contourBtn);
 const ellipsePathBtn=el('button','vs-shape-action','Елипса → Безие контур');ellipsePathBtn.type='button';ellipsePathBtn.dataset.action='ellipse-to-path';geometry.append(ellipsePathBtn);
 const splitLine=el('button','vs-shape-action','Раздели права линия…');splitLine.type='button';splitLine.dataset.action='split-line';splitLine.title='Разделя избрана самостоятелна права линия на две части в зададен процент. Не поддържа криви.';geometry.append(splitLine);
 const splitPolyline=el('button','vs-shape-action','Раздели полилиния…');splitPolyline.type='button';splitPolyline.dataset.action='split-polyline';splitPolyline.title='Разделя отворена полилиния на две части по процент от общата дължина.';geometry.append(splitPolyline);
 const knife=el('button','vs-shape-action','Knife — разрежи полилиния с мишката');knife.type='button';knife.dataset.action='knife-polyline';knife.title='Избери отворена полилиния, активирай Knife и щракни върху сегмент. Не поддържа затворени фигури и криви.';geometry.append(knife);
 const knifeBezier=el('button','vs-shape-action','Knife — разрежи Безие крива с мишката');knifeBezier.type='button';knifeBezier.dataset.action='knife-bezier';knifeBezier.title='Поддържа само отворени M/C Безие криви, без запълване.';geometry.append(knifeBezier);
 [['path-break-node','Раздели полилиния при възел…'],['path-simplify','Опрости полилиния…'],['path-reverse','Обърни посоката на полилиния'],['path-join','Съедини две полилинии…']].forEach(([key,title])=>{const b=el('button','vs-shape-action',title);b.type='button';b.dataset.action=key;geometry.append(b)});
 const ribbonBtn=el('button','vs-shape-action','Променлива ширина на полилиния…');ribbonBtn.type='button';ribbonBtn.dataset.action='path-variable-width';ribbonBtn.title='Създава отделен запълнен контур с линейно изменяща се ширина по отворена полилиния (2–500 възела).';geometry.append(ribbonBtn);
 const knifePolygon=el('button','vs-shape-action','Knife — разрежи изпъкнала фигура с 2 щраквания');knifePolygon.type='button';knifePolygon.dataset.action='knife-polygon';knifePolygon.title='Разделя избран изпъкнал многоъгълник или триъгълник с права линия през две точки.';geometry.append(knifePolygon);
 inactive(geometry,'Knife за произволни контури — предстои','Няма внедрено разрязване на произволни криви и затворени фигури');
 const symbols=submenu(arrange,'Символи ▸');
 symbols.append(el('div','vs-file-heading','Библиотеката остава достъпна от панел „Обекти“.'));
 const pattern=el('button','vs-shape-action','Маркери по полилиния…');pattern.type='button';pattern.dataset.action='path-pattern';symbols.append(pattern);
 [['symbol-insert-linked','Вмъкни свързан символ'],['symbol-update-master','Обнови оригинала от избрания екземпляр'],['symbol-refresh-linked','Обнови екземплярите на текущата страница']].forEach(([key,title])=>{const b=el('button','vs-shape-action',title);b.type='button';b.dataset.action=key;symbols.append(b)});
 const precise=submenu(arrange,'Прецизно чертане ▸');
 precise.append(el('div','vs-file-heading','Прихващане към мрежа и обекти: меню „Изглед“.'));
 const snapNode=el('button','vs-shape-action','Прихващане към възли: ИЗКЛ');snapNode.type='button';snapNode.dataset.action='smart-node-snap';snapNode.setAttribute('aria-pressed','false');snapNode.title='При включено прихващане към обекти: прихваща и към върховете на полилинии и многоъгълници.';precise.append(snapNode);const snapMid=el('button','vs-shape-action','Прихващане към среди: ИЗКЛ');snapMid.type='button';snapMid.dataset.action='smart-midpoint-snap';snapMid.setAttribute('aria-pressed','false');snapMid.title='При включено прихващане към обекти: прихваща към средите на сегменти на полилинии и многоъгълници.';precise.append(snapMid);const snapIntersection=el('button','vs-shape-action','Прихващане към пресечни точки: ИЗКЛ');snapIntersection.type='button';snapIntersection.dataset.action='smart-intersection-snap';snapIntersection.setAttribute('aria-pressed','false');snapIntersection.title='При включено прихващане към обекти: прихваща към пресичания между прави сегменти на различни полилинии и многоъгълници.';precise.append(snapIntersection);
 const vectorize=submenu(arrange,'Векторизация ▸');
 const trace=el('button','vs-shape-action','Vector Trace — черно-бяло изображение…');trace.type='button';trace.dataset.action='vector-trace-mono';trace.title='Преобразува тъмните области на избрано PNG/JPG изображение в група редактируеми векторни правоъгълници (до 4000).';vectorize.append(trace);
 const guideButton=act('help');if(guideButton){guideButton.textContent='Ръководство за работа';guideButton.title='Отвори ръководството за работа';guideButton.classList.add('vs-guide-menu-button');menus.append(guideButton)}
 const quick=el('div','vs-quick');move(quick,['undo','redo']);
 const collapse=el('button','vs-collapse','Панел ◀');collapse.type='button';collapse.addEventListener('click',()=>{sidebar.classList.toggle('vs-collapsed');collapse.textContent=sidebar.classList.contains('vs-collapsed')?'Панел ▶':'Панел ◀'});quick.append(collapse);bar.append(quick);
 header.before(bar);
 const adaptive=options.id==='adaptiveToolbar';
 const context=el('div','vs-context'),title=el('span','vs-context-title','Страница'),page=el('div','vs-context-group'),draw=el('div','vs-context-group'),node=el('div','vs-context-group');context.append(title,page,draw,node);if(!adaptive)options.before(context);
 if(!adaptive){['pageSelect','paper','orientation'].forEach(id=>{const l=ctrl(id);if(l)page.append(l)});move(page,['add-page','delete-page']);}
 // Keep color controls OUTSIDE the palette: redraws replace its children.
 if(!adaptive)['fill','stroke','strokeWidth','fontSize'].forEach(id=>{const l=ctrl(id);if(l)draw.append(l)});
 if(!adaptive)move(node,['edit-nodes']);
 const addNode=el('button','vs-node-action','+ Възел');addNode.type='button';addNode.dataset.action='add-node';addNode.title='Добави точка в най-дългия сегмент на избрана полилиния';
 const removeNode=el('button','vs-node-action','− Възел');removeNode.type='button';removeNode.dataset.action='remove-node';removeNode.title='Изтрий последно редактирания възел (или последния) на полилиния';
 if(!adaptive)node.append(addNode,removeNode);
 // Never silently put unrelated actions under File. Preserve remaining controls in their original DOM positions.

 if(adaptive){
  // Move actual existing tool buttons, not copies, into the left end of the single-row bar.
  const host=document.getElementById('toolbarTools');
  if(host){host.append(...tools.querySelectorAll('button'));tools.remove();}
 }else{
 // Left: editing and navigation only. Move existing creation controls (never clone them)
 // into the right-side Elements panel. app.js binds data-tool buttons by document query,
 // so their original click handlers remain identical after DOM relocation.
 const rightPanel=document.getElementById('vsElementsPanel');
 if(rightPanel){
  // Relocate original creation controls only; the existing Elements grid renders them.
  const holding=el('div','vs-element-tool-storage');holding.hidden=true;holding.setAttribute('aria-hidden','true');
  ['line','polyline','bezier','pencil','arrow','rect','ellipse','triangle','text','symbol'].forEach(id=>{
   const btn=tools.querySelector(`[data-tool="${id}"]`);
   if(btn)holding.append(btn);
  });
  rightPanel.append(holding);
  document.getElementById('vsElementsLaunch')?.remove();
 }

 const leftGroups=[['Избор и навигация',['select','pan']],['Редакция',['eyedrop']]];
 const grouped=el('div','vs-toolgroups');let activeGroup;
 leftGroups.forEach(([name,ids])=>{const d=el('details','vs-toolgroup'),summary=el('summary','',name),body=el('div','vs-toolgroup-items');ids.forEach(id=>{const btn=tools.querySelector(`[data-tool="${id}"]`);if(btn){body.append(btn);if(btn.classList.contains('active'))activeGroup=d}});d.append(summary,body);grouped.append(d)});
 if(activeGroup)activeGroup.open=true;
 // Preserve future tools rather than accidentally removing them.
 const remaining=[...tools.querySelectorAll('[data-tool]')];if(remaining.length){const d=el('details','vs-toolgroup'),summary=el('summary','','Други'),body=el('div','vs-toolgroup-items');remaining.forEach(btn=>body.append(btn));d.append(summary,body);grouped.append(d)}
 tools.append(grouped);
 }
 // Do not remove original structural nodes; app may reference them.
 header.classList.add('vs-original-header');if(!adaptive)options.classList.add('vs-original-options');document.body.classList.add('vs-layout-ready');
 const oldAlign=document.querySelector('.align-toolbar');if(oldAlign&&oldAlign.children.length===0)oldAlign.hidden=true;
 const sync=()=>{const current=document.querySelector('[data-tool].active')?.dataset.tool||'select';const selection=!!document.querySelector('#propertiesContent input, #propertiesContent select');const isPage=current==='select'&&!selection;title.textContent=isPage?'Страница':current==='text'?'Текст':current==='select'?'Обект':'Чертане';page.hidden=!isPage;draw.hidden=isPage;node.hidden=current!=='select'};
 document.addEventListener('click',e=>{if(e.target.closest('[data-tool]'))queueMicrotask(sync)});
 document.addEventListener('click',e=>{const item=e.target.closest('.vs-menu-content [data-action]');if(item){item.closest('.vs-file-submenu')?.removeAttribute('open');item.closest('.vs-menu')?.removeAttribute('open')}});
 menus.addEventListener('toggle',()=>{},true);
 menus.addEventListener('click',e=>{if(!e.target.closest('summary'))return;const d=e.target.closest('.vs-menu');if(d)menus.querySelectorAll('.vs-menu[open]').forEach(o=>{if(o!==d)o.open=false})});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')menus.querySelectorAll('.vs-menu[open]').forEach(d=>d.open=false)});
 if(!adaptive)sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();