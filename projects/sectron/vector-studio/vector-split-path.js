/* Pure geometry for splitting an open polyline by distance along its path. */
(function(root){'use strict';
 function split(points,fraction){
  if(!Array.isArray(points)||points.length<2||!Number.isFinite(fraction)||fraction<=0||fraction>=1)throw Error('Невалидна полилиния или процент');
  if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw Error('Невалидни координати');
  const distances=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y));
  if(distances.some(d=>d<1e-8))throw Error('Полилинията има повтарящи се съседни точки');
  const length=distances.reduce((a,b)=>a+b,0),target=length*fraction;
  let traversed=0;
  for(let i=0;i<distances.length;i++){
   const end=traversed+distances[i];
   if(target<=end||i===distances.length-1){
    const t=Math.max(0,Math.min(1,(target-traversed)/distances[i]));
    const p={x:points[i].x+(points[i+1].x-points[i].x)*t,y:points[i].y+(points[i+1].y-points[i].y)*t};
    const left=[...points.slice(0,i+1),p],right=[p,...points.slice(i+1)];
    // Avoid zero-length endpoint segments when split coincides with an existing node.
    if(t<1e-8)left.pop();
    if(t>1-1e-8)right.shift();
    return [left,right];
   }
   traversed=end;
  }
  throw Error('Няма точка за разделяне');
 }
 function cutNearest(points,position,tolerance){
  if(!Array.isArray(points)||points.length<2||!Number.isFinite(position?.x)||!Number.isFinite(position?.y))throw Error('Невалидна геометрия');
  let best=null;
  for(let i=0;i<points.length-1;i++){
   const a=points[i],b=points[i+1],dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;
   if(d2<1e-12)continue;
   const t=Math.max(0,Math.min(1,((position.x-a.x)*dx+(position.y-a.y)*dy)/d2));
   const q={x:a.x+dx*t,y:a.y+dy*t},distance=Math.hypot(position.x-q.x,position.y-q.y);
   if(!best||distance<best.distance)best={index:i,t,q,distance};
  }
  if(!best||best.distance>tolerance)throw Error('Щракни близо до сегмент от полилинията');
  if(best.t<1e-5||best.t>1-1e-5)throw Error('Избери точка във вътрешността на сегмент, не върху възел');
  return [points.slice(0,best.index+1).concat([best.q]),[best.q].concat(points.slice(best.index+1))];
 }
 function bezierPoint(a,b,c,d,t){
  const u=1-t;return {x:u*u*u*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t*t*t*d.x,y:u*u*u*a.y+3*u*u*t*b.y+3*u*t*t*c.y+t*t*t*d.y};
 }
 function mix(a,b,t){return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
 function splitCubic(a,b,c,d,t){
  const ab=mix(a,b,t),bc=mix(b,c,t),cd=mix(c,d,t),abc=mix(ab,bc,t),bcd=mix(bc,cd,t),mid=mix(abc,bcd,t);
  return [[a,ab,abc,mid],[mid,bcd,cd,d]];
 }
 // Supported source format: one M command followed only by C commands (open path).
 function cutBezier(commands,position,tolerance){
  if(!Array.isArray(commands)||commands.length<2||commands[0][0]!=='M'||commands.slice(1).some(c=>c[0]!=='C'))throw Error('Knife за Безие поддържа само отворен контур M + C');
  let current={x:commands[0][1],y:commands[0][2]},best=null;
  const segments=[];
  for(let k=1;k<commands.length;k++){
   const c=commands[k],p1={x:c[1],y:c[2]},p2={x:c[3],y:c[4]},end={x:c[5],y:c[6]};
   segments.push([current,p1,p2,end]);current=end;
  }
  for(let i=0;i<segments.length;i++){
   const seg=segments[i];let candidate={t:0,d2:Infinity};
   // Coarse sampling, then golden-section optimization around closest sample.
   for(let j=0;j<=120;j++){
    const t=j/120,q=bezierPoint(...seg,t),d2=(q.x-position.x)**2+(q.y-position.y)**2;
    if(d2<candidate.d2)candidate={t,d2};
   }
   let low=Math.max(0,candidate.t-1/120),high=Math.min(1,candidate.t+1/120);
   const distance2=t=>{const q=bezierPoint(...seg,t);return (q.x-position.x)**2+(q.y-position.y)**2;};
   for(let j=0;j<45;j++){
    const a=low+(high-low)*.382,b=low+(high-low)*.618;
    if(distance2(a)<distance2(b))high=b;else low=a;
   }
   const t=(low+high)/2,d2=distance2(t);
   if(!best||d2<best.d2)best={i,t,d2};
  }
  if(!best||Math.sqrt(best.d2)>tolerance)throw Error('Щракни близо до кривата');
  if(best.t<1e-5||best.t>1-1e-5)throw Error('Избери вътрешността на сегмент, не възел');
  const halves=splitCubic(...segments[best.i],best.t);
  const asCubic=part=>['C',part[1].x,part[1].y,part[2].x,part[2].y,part[3].x,part[3].y];
  const left=[commands[0],...commands.slice(1,best.i+1),asCubic(halves[0])];
  const right=[['M',halves[1][0].x,halves[1][0].y],asCubic(halves[1]),...commands.slice(best.i+2)];
  return [left,right];
 }
 root.VectorSplitPath=Object.freeze({split,cutNearest,cutBezier,bezierPoint});
})(typeof window!=='undefined'?window:globalThis);