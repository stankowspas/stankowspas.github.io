const termsConsentGate=(()=>{const dlg=document.getElementById('terms-dialog'),check=document.getElementById('terms-check'),accept=document.getElementById('terms-accept');let agreed=false;const show=()=>{if(!agreed&&!dlg.open){check.checked=false;accept.disabled=true;dlg.showModal()}};check.addEventListener('change',()=>accept.disabled=!check.checked);accept.addEventListener('click',()=>{if(!check.checked)return;agreed=true;dlg.close();});document.getElementById('terms-decline').addEventListener('click',()=>{check.checked=false;accept.disabled=true;show()});dlg.addEventListener('cancel',e=>{if(!agreed)e.preventDefault()});document.getElementById('file').addEventListener('change',e=>{if(!agreed){e.stopImmediatePropagation();e.target.value='';show()}},true);for(const id of ['convert','save'])document.getElementById(id).addEventListener('click',e=>{if(!agreed){e.stopImmediatePropagation();show()}},true);show();return {get accepted(){return agreed},show}})();
import {AcApDocManager} from '@mlightcad/cad-simple-viewer';
import {AcDbDatabaseConverterManager,AcDbFileType} from '@mlightcad/data-model';
import {AcDbLibreDwgConverter} from '@mlightcad/libredwg-converter';
import {AcApPdfConvertor} from '@mlightcad/cad-pdf-plugin';
const $=id=>document.getElementById(id);
let manager,pdfBlob,pdfUrl,fileName='',selectionOff=[];
const status=s=>{$('status').textContent=s;console.log(s)};
function compare(on){$('pdfPanel').hidden=!on;$('views').classList.toggle('compare',on);$('single').hidden=!on;setTimeout(()=>window.dispatchEvent(new Event('resize')),100)}
$('single').onclick=()=>compare(false);

$('save').onclick=()=>{if(!termsConsentGate.accepted){termsConsentGate.show();return;}if(!pdfBlob)return;let a=document.createElement('a'),u=URL.createObjectURL(pdfBlob);a.href=u;a.download=fileName.replace(/\.dwg$/i,'')+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(u),10000)};
try{
AcDbDatabaseConverterManager.instance.register(AcDbFileType.DWG,new AcDbLibreDwgConverter({timeout:580000,useWorker:true,parserWorkerUrl:'/workers/libredwg-parser-worker.js'}));
manager=AcApDocManager.createInstance({container:$('cad'),webworkerFileUrls:{dwgParser:'/workers/libredwg-parser-worker.js',mtextRender:'/workers/mtext-renderer-worker.js'}});
status('CAD Viewer е готов.');
$('file').onchange=async e=>{if(!termsConsentGate.accepted){e.target.value='';termsConsentGate.show();return}let f=e.target.files?.[0];if(!f)return;fileName=f.name;pdfBlob=null;compare(false);$('convert').disabled=$('save').disabled=true;status('Зареждане: '+f.name);try{const bytes=await f.arrayBuffer();let ok=await manager.openDocument(f.name,bytes,{minimumChunkSize:1000,readOnly:true});const db=manager.context?.doc?.database;
 const n=db?.tables?.blockTable?.modelSpace?.newIterator?.().count ?? 0;
 if(ok!==true && n===0)throw Error('DWG не е прочетен: библиотеката не е възстановила нито един обект. Провери версията на DWG и външните зависимости.');
 if(!db || n===0)throw Error('DWG файлът не съдържа достъпни обекти в Model Space.');
 
 bindInspector();
 if(ok===true){$('convert').disabled=false;status('DWG зареден: '+f.name+' | Model Space: '+n+' обекта.')}
 else{ $('convert').disabled=true; status('ЧАСТИЧЕН DWG ПРОЧИТ: '+n+' обекта. Изгледът е само за проверка. PDF конверсията е блокирана, за да няма загубени елементи.');}
 }catch(e){console.error(e);status('DWG грешка: '+e.message)}};
$('convert').onclick=async()=>{if(!termsConsentGate.accepted){termsConsentGate.show();return;}let original=URL.createObjectURL,captured=null;$('convert').disabled=true;status('Генериране на векторен PDF…');URL.createObjectURL=function(b){if(b instanceof Blob&&b.type==='application/pdf')captured=b;return original.call(URL,b)};
try{await new AcApPdfConvertor().convert(manager.context,{modelSpaceFit:'extents',exportLayouts:false});if(!captured)throw Error('PDF плъгинът не върна PDF Blob');pdfBlob=captured;if(pdfUrl)URL.revokeObjectURL(pdfUrl);pdfUrl=original.call(URL,pdfBlob);$('pdf').src=pdfUrl;compare(true);$('save').disabled=false;status('PDF готов: '+Math.round(pdfBlob.size/1024)+' KB. Провери резултата.')}catch(e){console.error(e);status('PDF грешка: '+e.message)}finally{URL.createObjectURL=original;$('convert').disabled=false}};
}catch(e){console.error(e);status('CAD грешка: '+e.message)}

function bindInspector(){
 for(const off of selectionOff)off();selectionOff=[];
 const set=manager.context?.view?.selectionSet;
 if(!set)return;
 const update=()=>{
  const ids=set.ids;
  if(!ids.length){$('inspector').textContent='Няма маркиран обект.';return}
  if(ids.length>1){$('inspector').textContent='Маркирани обекти: '+ids.length+' | Handles: '+ids.slice(0,6).join(', ');return}
  const id=ids[0],obj=manager.context.doc.database.getObjectById(id);
  if(!obj){$('inspector').textContent='Handle: '+id+' | CAD обектът не е достъпен';return}
  const fields=[['Handle',id],['Тип',obj.constructor?.name],['Layer',obj.layerName??obj.layer],['Цвят',obj.color?.toString?.()],['Linetype',obj.linetype],['Lineweight',obj.lineweight],['Позиция',obj.position],['Начало',obj.startPoint],['Край',obj.endPoint],['Радиус',obj.radius],['Текст',obj.textString],['Block',obj.name]];
  $('inspector').textContent=fields.filter(x=>x[1]!==undefined&&x[1]!==null).map(([k,v])=>k+': '+(typeof v==='object'?JSON.stringify(v):String(v))).join('  |  ');
 };
 for(const event of [set.events.selectionAdded,set.events.selectionRemoved]){
  event.addEventListener(update);
  if(event.removeEventListener)selectionOff.push(()=>event.removeEventListener(update));
 }
 update();
}
