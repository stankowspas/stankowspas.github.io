/* Vector Studio CAD bridge: conservative ASCII DXF export of Fabric objects. */
(function(root){'use strict';
function encode(objects){
 if(!Array.isArray(objects))throw Error('Expected objects array');
 const entities=[];const usedLayers=new Set(['0']);const bounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
 const include=(x,y)=>{bounds.minX=Math.min(bounds.minX,x);bounds.maxX=Math.max(bounds.maxX,x);bounds.minY=Math.min(bounds.minY,y);bounds.maxY=Math.max(bounds.maxY,y)};
 const pair=(code,value)=>`${code}\n${String(value).replace(/[\r\n]/g,' ')}\n`;
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const layer=o=>{const name=String(o.cadLayer||'0');if(!name.trim()||/[<>\/\":;?*|=,`\r\n]/.test(name)||name.length>255)throw Error('Invalid DXF layer name');return name;};
 const fmt=n=>{if(!finite(n))throw Error('Non-finite CAD coordinate');return Number(n.toFixed(8))};
 function transform(o,x,y){if(o.cadMatrix){const m=o.cadMatrix;if(!Array.isArray(m)||m.length!==6||!m.every(finite))throw Error('Invalid Fabric transform matrix');const px=['polygon','polyline','path'].includes(o.type)?x-(o.pathOffset?.x||0):x,py=['polygon','polyline','path'].includes(o.type)?y-(o.pathOffset?.y||0):y;return{x:fmt(m[0]*px+m[2]*py+m[4]),y:fmt(-(m[1]*px+m[3]*py+m[5]))};}const sx=finite(o.scaleX)?o.scaleX:1,sy=finite(o.scaleY)?o.scaleY:1,a=(o.angle||0)*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a);let xx=(x-(o.pathOffset?.x||0))*sx,yy=(y-(o.pathOffset?.y||0))*sy;if(o.flipX)xx=-xx;if(o.flipY)yy=-yy;return{x:fmt((o.left||0)+xx*cos-yy*sin),y:fmt(-((o.top||0)+xx*sin+yy*cos))};}
 function poly(o,points,closed=false){if(points.length<2)throw Error('Polyline requires at least 2 points');const pts=points.map(p=>transform(o,p.x,p.y));pts.forEach(p=>include(p.x,p.y));usedLayers.add(layer(o));let out=pair(0,'LWPOLYLINE')+pair(100,'AcDbEntity')+pair(8,layer(o))+pair(100,'AcDbPolyline')+pair(90,pts.length)+pair(70,closed?1:0);for(const p of pts)out+=pair(10,p.x)+pair(20,p.y);entities.push(out);}
 function exportPath(o){
  const commands=o.path;if(!Array.isArray(commands))throw Error('Invalid Fabric path');
  let points=[],cursor={x:0,y:0},start=null;
  const flush=(closed=false)=>{if(points.length>=2)poly(o,points,closed);else if(points.length)throw Error('Invalid path: isolated point');points=[];start=null};
  for(const command of commands){
   const [cmd,...v]=command;const end=(x,y)=>{if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Invalid path point');cursor={x,y};points.push(cursor)};
   if(cmd==='M'){flush();end(v[0],v[1]);start={...cursor}}
   else if(cmd==='L')end(v[0],v[1]);
   else if(cmd==='Q'){const p={...cursor},c={x:v[0],y:v[1]},q={x:v[2],y:v[3]};for(let i=1;i<=24;i++){const t=i/24,u=1-t;end(u*u*p.x+2*u*t*c.x+t*t*q.x,u*u*p.y+2*u*t*c.y+t*t*q.y)}}
   else if(cmd==='C'){const p={...cursor},a={x:v[0],y:v[1]},b={x:v[2],y:v[3]},q={x:v[4],y:v[5]};for(let i=1;i<=24;i++){const t=i/24,u=1-t;end(u*u*u*p.x+3*u*u*t*a.x+3*u*t*t*b.x+t*t*t*q.x,u*u*u*p.y+3*u*u*t*a.y+3*u*t*t*b.y+t*t*t*q.y)}}
   else if(cmd==='Z'||cmd==='z'){const anchor=start;flush(true);if(anchor)cursor=anchor}
   else throw Error('CAD export stopped: unsupported path command ('+cmd+')');
  }
  flush();
 }
 for(const o of objects){if(o.visible===false)continue;const type=o.type;
  if(type==='line'){poly(o,o.cadLinePoints||[{x:o.x1,y:o.y1},{x:o.x2,y:o.y2}]);}
  else if(type==='rect'){const w=o.width||0,h=o.height||0;const x=o.cadMatrix?-w/2:0,y=o.cadMatrix?-h/2:0;poly(o,[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],true);}
  else if(type==='triangle'){const w=o.width||0,h=o.height||0;poly(o,o.cadMatrix?[{x:0,y:-h/2},{x:w/2,y:h/2},{x:-w/2,y:h/2}]:[{x:w/2,y:0},{x:w,y:h},{x:0,y:h}],true);}
  else if(type==='polygon'){poly(o,o.points||[],true);}
  else if(type==='path'){exportPath(o);}
  else if(type==='polyline'){poly(o,o.points||[],Boolean(o.closed));}
  else if(type==='circle'||type==='ellipse'){
   const rx=type==='circle'?o.radius:o.rx,ry=type==='circle'?o.radius:o.ry;
   if(!(rx>0&&ry>0))throw Error('Invalid circle/ellipse radii');
   // Ellipses and circles are conservatively sampled; exact CAD arcs are future work.
   const pts=Array.from({length:96},(_,i)=>{const t=i*2*Math.PI/96;return o.cadMatrix?{x:rx*Math.cos(t),y:ry*Math.sin(t)}:{x:rx+rx*Math.cos(t),y:ry+ry*Math.sin(t)}});poly(o,pts,true);
  }else if(type==='text'||type==='i-text'||type==='textbox'){
   const h=Math.abs((o.fontSize||12)*(o.scaleY||1));if(!finite(h)||h<=0)throw Error('Invalid text height');
   const lines=String(o.text||' ').split(/\r?\n/),lineHeight=Number(o.lineHeight)||1.16;
   if(!finite(lineHeight)||lineHeight<=0)throw Error('Invalid text line height');
   for(let i=0;i<lines.length;i++){
    const p=transform(o,o.cadMatrix?-(o.width||0)/2:0,(o.cadMatrix?-(o.height||0)/2:0)+i*(o.fontSize||12)*lineHeight);
    include(p.x,p.y);usedLayers.add(layer(o));entities.push(pair(0,'TEXT')+pair(100,'AcDbEntity')+pair(8,layer(o))+pair(100,'AcDbText')+pair(10,p.x)+pair(20,p.y)+pair(40,fmt(h))+pair(1,lines[i]||' '));
   }
  }else throw Error(`CAD export stopped: unsupported Fabric object (${type})`);
 }
 if(entities.length===0)throw Error('There are no supported objects to export');
 const minX=fmt(bounds.minX),minY=fmt(bounds.minY),maxX=fmt(bounds.maxX),maxY=fmt(bounds.maxY);
 const header=pair(0,'SECTION')+pair(2,'HEADER')+pair(9,'$ACADVER')+pair(1,'AC1021')+pair(9,'$DWGCODEPAGE')+pair(3,'UTF-8')+pair(9,'$INSUNITS')+pair(70,0)+pair(9,'$EXTMIN')+pair(10,minX)+pair(20,minY)+pair(30,0)+pair(9,'$EXTMAX')+pair(10,maxX)+pair(20,maxY)+pair(30,0)+pair(9,'$LIMMIN')+pair(10,minX)+pair(20,minY)+pair(9,'$LIMMAX')+pair(10,maxX)+pair(20,maxY)+pair(0,'ENDSEC');
 const layerRecords=[...usedLayers].map(name=>pair(0,'LAYER')+pair(100,'AcDbSymbolTableRecord')+pair(100,'AcDbLayerTableRecord')+pair(2,name)+pair(70,0)+pair(62,7)+pair(6,'CONTINUOUS')).join('');
 const tables=pair(0,'SECTION')+pair(2,'TABLES')+pair(0,'TABLE')+pair(2,'LAYER')+pair(5,'2')+pair(100,'AcDbSymbolTable')+pair(70,usedLayers.size)+layerRecords+pair(0,'ENDTAB')+pair(0,'ENDSEC');
 return header+tables+pair(0,'SECTION')+pair(2,'ENTITIES')+entities.join('')+pair(0,'ENDSEC')+pair(0,'EOF');
}
function validate(text){
 if(typeof text!=='string'||!text.endsWith('0\nEOF\n'))throw Error('Invalid DXF: missing EOF');
 const lines=text.split('\n');if(lines.pop()!=='')throw Error('Invalid DXF: incomplete final line');
 if(lines.length%2)throw Error('Invalid DXF: unmatched group code');
 const pairs=[];for(let i=0;i<lines.length;i+=2){const code=Number(lines[i]);if(!/^\d+$/.test(lines[i])||!Number.isInteger(code))throw Error('Invalid DXF: group code');pairs.push([code,lines[i+1]])}
 if(pairs[0]?.[0]!==0||pairs[0]?.[1]!=='SECTION'||pairs.at(-1)?.[1]!=='EOF')throw Error('Invalid DXF: sections');
 let section='',current=null,count=0,hasHeader=false,hasEntities=false;
 const finish=()=>{if(!current)return;const group=code=>current.pairs.filter(p=>p[0]===code).map(p=>p[1]);const type=current.type;
 if(type==='LWPOLYLINE'){if(!group(100).includes('AcDbPolyline'))throw Error('Invalid DXF: polyline subclass');const vertices=Number(group(90)[0]);if(!Number.isInteger(vertices)||vertices<2||group(10).length!==vertices||group(20).length!==vertices)throw Error('Invalid DXF: polyline vertices')}
 else if(type==='TEXT'){if(!group(100).includes('AcDbText')||!group(1).length||!(Number(group(40)[0])>0))throw Error('Invalid DXF: text entity')}
 else throw Error('Invalid DXF: unsupported entity '+type);
 for(const [code,value] of current.pairs)if([10,20,40].includes(code)&&!Number.isFinite(Number(value)))throw Error('Invalid DXF: coordinate');
 count++;current=null};
 for(let i=0;i<pairs.length;i++){const [code,value]=pairs[i];
 if(code===0&&value==='SECTION'){finish();if(pairs[i+1]?.[0]!==2)throw Error('Invalid DXF: section name');section=pairs[i+1][1];if(section==='HEADER')hasHeader=true;if(section==='ENTITIES')hasEntities=true}
 else if(code===0&&value==='ENDSEC'){finish();section=''}
 else if(code===0&&value==='EOF'){finish();if(i!==pairs.length-1)throw Error('Invalid DXF: data after EOF')}
 else if(section==='ENTITIES'&&code===0){finish();current={type:value,pairs:[]}}
 else if(current)current.pairs.push([code,value]);
 }
 if(!hasHeader||!hasEntities||!count)throw Error('Invalid DXF: missing content');
 return {entities:count};
}
root.VectorStudioDXFExport={encode,validate};
})(typeof globalThis!=='undefined'?globalThis:this);