import {LibreDwg,Dwg_File_Type} from 'https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.7.17/dist/libredwg-web.js';
let parserPromise;
const p=(v)=>({x:Number(v?.x)||0,y:Number(v?.y)||0});
const point=(v)=>[Number(v?.x)||0,-(Number(v?.y)||0)];
let layerColors=new Map();
function convertEntity(e){
 const layer=e.layer||'0',layerColor=layerColors.get(layer);
 const inherited=e.colorIndex===256||e.colorIndex===0||e.colorIndex==null;
 const ci=inherited?(layerColor?.ci??7):e.colorIndex;
 const rgb=!inherited&&e.color&&e.color!==0xffffff?e.color:0;
 const base={h:String(e.handle||''),layer,ci,rgb};
 switch(e.type){
 case 'LINE':return {...base,type:'LINE',x1:e.startPoint?.x||0,y1:-(e.startPoint?.y||0),x2:e.endPoint?.x||0,y2:-(e.endPoint?.y||0)};
 case 'LWPOLYLINE':case 'POLYLINE2D':{
  const vertices=e.vertices||[];
  return {...base,type:'POLYLINE',pts:vertices.map(point),bulges:vertices.map(v=>v.bulge||0),closed:!!(e.flag&1)};
 }
 case 'CIRCLE':return {...base,type:'CIRCLE',x:e.center?.x||0,y:-(e.center?.y||0),r:e.radius||0};
 case 'ARC':return {...base,type:'ARC',x:e.center?.x||0,y:-(e.center?.y||0),r:e.radius||0,a1:e.startAngle||0,a2:e.endAngle||0};
 case 'INSERT':return {...base,type:'INSERT',block:e.name||'',x:e.insertionPoint?.x||0,y:-(e.insertionPoint?.y||0),sx:e.xScale??1,sy:e.yScale??1,rotation:e.rotation||0};
 case 'TEXT':case 'MTEXT':{
  const position=e.startPoint||e.insertionPoint||{};
  return {...base,type:'TEXT',x:position.x||0,y:-(position.y||0),text:String(e.text||'').slice(0,500)};
 }
 default:return null;
 }
}
export async function readDwg(file){
 if(!file?.name?.toLowerCase().endsWith('.dwg'))throw Error('Избери DWG файл.');
 parserPromise??=LibreDwg.create('https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.7.17/wasm');
 const parser=await parserPromise;
 const bytes=new Uint8Array(await file.arrayBuffer());
 const dwg=parser.dwg_read_data(bytes,Dwg_File_Type.DWG);
 let db;
 try{db=parser.convert(dwg)}finally{try{parser.dwg_free(dwg)}catch{}}
 layerColors=new Map((db.tables?.LAYER?.entries||[]).map(l=>[l.name,{ci:Math.abs(l.colorIndex||7)}]));
 const blocks={};
 const definitions=new Map((db.tables?.BLOCK_RECORD?.entries||[]).map(b=>[b.name,b]));
 const entries=(db.tables?.BLOCK_RECORD?.entries||[]).find(e=>e.name==='*Model_Space')?.entities||db.entities||[];
 const objects=[];
 for(const e of entries){const v=convertEntity(e);if(v)objects.push(v)}
 const toVisit=new Set(objects.filter(e=>e.type==='INSERT').map(e=>e.block));
 let scans=0;
 while(toVisit.size&&scans<10000){
  const name=toVisit.values().next().value;toVisit.delete(name);
  if(Object.prototype.hasOwnProperty.call(blocks,name))continue;
  scans++;
  const source=definitions.get(name);
  if(!source){blocks[name]={items:[],baseX:0,baseY:0};continue}
  const items=[];
  for(const e of source.entities||[]){const v=convertEntity(e);if(v){items.push(v);if(v.type==='INSERT'&&!Object.prototype.hasOwnProperty.call(blocks,v.block))toVisit.add(v.block)}}
  blocks[name]={items,baseX:source.basePoint?.x||0,baseY:-(source.basePoint?.y||0)};
 }
 return {file:file.name,objects,blocks};
}
export async function saveExcel(rows,drawing){
 const ExcelJS=window.ExcelJS;
 if(!ExcelJS)throw Error('ExcelJS не е заредена.');
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Количествена сметка');
 sheet.columns=[
 {header:'№',key:'number',width:7},{header:'CAD символ',key:'symbol',width:16},
 {header:'Наименование',key:'name',width:45},{header:'CAD блок',key:'block',width:35},
 {header:'Мярка',key:'unit',width:13},{header:'Количество',key:'quantity',width:18},
 {header:'RAW INSERT',key:'raw',width:18}];
 sheet.getRow(1).eachCell(c=>{c.font={bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF263D57'}};c.alignment={vertical:'middle'}});
 sheet.getRow(1).height=24;
 for(let i=0;i<rows.length;i++){
  const r=rows[i],row=sheet.addRow({number:i+1,name:r.name,block:r.block,unit:r.unit,quantity:r.quantity,raw:r.raw??''});
  row.alignment={vertical:'middle'};row.height=74;
  if(r.symbol?.startsWith('data:image/png;base64,')){
   const imageId=book.addImage({base64:r.symbol,extension:'png'});
   sheet.addImage(imageId,{tl:{col:1,row:i+1},ext:{width:94,height:94}});
  }
 }
 sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter={from:'A1',to:'G'+(rows.length+1)};
 const data=await book.xlsx.writeBuffer();
 return new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}