/* Vector Studio: dependency-free ASCII DXF R12+ basic geometry reader. No DWG support. */
(function(root){'use strict';
function parse(text){
 if(typeof text!=='string'||text.indexOf('\u0000')!==-1)throw Error('Очаква се текстов ASCII DXF, не двоичен формат.');
 const raw=text.replace(/^\uFEFF/,'').split(/\r\n|\n|\r/);if(raw.at(-1)==='')raw.pop();if(raw.length%2)throw Error('Непълен DXF запис: липсва стойност за групов код.');const pairs=[];
 for(let i=0;i+1<raw.length;i+=2){const code=Number(raw[i].trim());if(!Number.isInteger(code))throw Error('Невалиден DXF групов код на ред '+(i+1));pairs.push([code,raw[i+1].trim()]);}
 let inEntities=false,inBlocks=false,entity=null,sections=[];const entities=[];let units=null;let skippedTypes=[];
 function save(){if(entity){if(!inBlocks){if(['LINE','LWPOLYLINE','CIRCLE','ARC','TEXT','POINT'].includes(entity.type))entities.push(entity);else if(!['SEQEND','VERTEX'].includes(entity.type))skippedTypes.push(entity.type);}entity=null;}}
 for(let i=0;i<pairs.length;i++){
 const [c,v]=pairs[i];
 if(c===0&&v==='SECTION'){save();const n=pairs[i+1];inEntities=!!n&&n[0]===2&&n[1]==='ENTITIES';inBlocks=!!n&&n[0]===2&&n[1]==='BLOCKS';sections.push(n?.[1]);i++;continue;}
 if(c===0&&v==='ENDSEC'){save();inEntities=false;inBlocks=false;continue;}
 if(c===9&&v==='$INSUNITS'&&sections.at(-1)==='HEADER'){const n=pairs[i+1];if(n&&n[0]===70)units=+n[1];}
 if(!inEntities)continue;
 if(c===0){save();if(v!=='ENDSEC'&&v!=='EOF')entity={type:v,props:{},vertices:[]};continue;}
 if(!entity)continue;
 (entity.props[c]??=[]).push(v);
 }
 save();
 const value=(e,c,fallback=0)=>{const s=e.props[c]?.[0];const n=s===undefined?fallback:Number(s);if(!Number.isFinite(n))throw Error('Невалидна координата в DXF');return n;};
 const get=(e,c,def='')=>e.props[c]?.[0]??def;
 const result=[];for(const e of entities){const p=e.props;const common={layer:get(e,8,'0'),color:value(e,62,256),type:e.type};
 if(e.type==='LINE')result.push({...common,x1:value(e,10),y1:value(e,20),x2:value(e,11),y2:value(e,21)});
 else if(e.type==='CIRCLE'||e.type==='ARC'){
 const radius=value(e,40);if(radius<=0)continue;
 result.push({...common,x:value(e,10),y:value(e,20),radius,...(e.type==='ARC'?{start:value(e,50),end:value(e,51)}:{})});}
 else if(e.type==='POINT')result.push({...common,x:value(e,10),y:value(e,20)});
 else if(e.type==='TEXT')result.push({...common,x:value(e,10),y:value(e,20),height:Math.max(1,value(e,40,12)),text:get(e,1,'')});
 else if(e.type==='LWPOLYLINE'){
 const xs=p[10]||[],ys=p[20]||[];if(xs.length!==ys.length)throw Error('Несъответстващи координати в LWPOLYLINE');
 const points=xs.map((x,i)=>({x:Number(x),y:Number(ys[i])}));if(points.some(q=>!Number.isFinite(q.x)||!Number.isFinite(q.y)))throw Error('Невалиден връх на полилиния');
 if((p[42]||[]).some(x=>!Number.isFinite(Number(x))))throw Error('Невалиден bulge параметър на полилиния');if(points.length>=2)result.push({...common,points,closed:(value(e,70,0)&1)!==0,hasBulges:(p[42]||[]).some(x=>Math.abs(Number(x))>1e-10)});
 }}
 return {entities:result,unitCode:units,unsupported:entities.length-result.length+skippedTypes.length,unsupportedTypes:[...new Set(skippedTypes)],total:entities.length+skippedTypes.length};
}
root.VectorStudioDXF={parse};
})(typeof window!=='undefined'?window:globalThis);