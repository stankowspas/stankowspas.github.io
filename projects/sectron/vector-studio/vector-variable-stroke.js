(function(root){'use strict';
 function ribbon(points,startWidth,endWidth){
  if(!Array.isArray(points)||points.length<2||points.length>500)throw Error('Необходими са 2–500 възела');
  if(![startWidth,endWidth].every(w=>Number.isFinite(w)&&w>0&&w<=1000))throw Error('Невалидна ширина');
  const p=points.map(q=>({x:q.x,y:q.y}));
  if(p.some(q=>!Number.isFinite(q.x)||!Number.isFinite(q.y)))throw Error('Невалидни координати');
  let total=0;const lengths=[0],normals=[];
  for(let i=0;i<p.length-1;i++){const dx=p[i+1].x-p[i].x,dy=p[i+1].y-p[i].y,len=Math.hypot(dx,dy);if(len<1e-8)throw Error('Полилинията има нулев сегмент');total+=len;lengths.push(total);normals.push({x:-dy/len,y:dx/len});}
  const left=[],right=[];
  for(let i=0;i<p.length;i++){
   const prev=normals[Math.max(0,i-1)],next=normals[Math.min(normals.length-1,i)];
   let nx,ny,factor=1;
   if(i===0||i===p.length-1){const n=i===0?next:prev;nx=n.x;ny=n.y;}
   else{const sx=prev.x+next.x,sy=prev.y+next.y,slen=Math.hypot(sx,sy);if(slen<1e-7)throw Error('Обратен завой 180° не се поддържа');nx=sx/slen;ny=sy/slen;const dot=nx*next.x+ny*next.y;if(dot<0.25)throw Error('Прекалено остър завой');factor=1/dot;if(factor>4)throw Error('Прекалено голямо съединение');}
   const half=(startWidth+(endWidth-startWidth)*lengths[i]/total)*factor/2;
   left.push({x:p[i].x+nx*half,y:p[i].y+ny*half});right.push({x:p[i].x-nx*half,y:p[i].y-ny*half});
  }
  const out=left.concat(right.reverse());
  function cross(a,b,c){return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)}
  function intersects(a,b,c,d){const ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);return ab1*ab2 < -1e-8&&cd1*cd2 < -1e-8}
  for(let i=0;i<out.length;i++)for(let j=i+2;j<out.length;j++){
   if(i===0&&j===out.length-1)continue;
   if(intersects(out[i],out[(i+1)%out.length],out[j],out[(j+1)%out.length]))throw Error('Получава се самопресичащ се контур');
  }
  return out;
 }
 root.VectorVariableStroke=Object.freeze({ribbon});
})(typeof window==='undefined'?globalThis:window);