/* Exact orthogonal boolean regions for two axis-aligned filled rectangles. */
(function(root){'use strict';
 function rectBoolean(a,b,op){
  if(!['union','intersect','subtract','exclude'].includes(op))throw Error('Unknown operation');
  for(const r of [a,b])if(![r.x1,r.y1,r.x2,r.y2].every(Number.isFinite)||r.x2<=r.x1||r.y2<=r.y1)throw Error('Invalid rectangle');
  const xs=[...new Set([a.x1,a.x2,b.x1,b.x2])].sort((x,y)=>x-y);
  const ys=[...new Set([a.y1,a.y2,b.y1,b.y2])].sort((x,y)=>x-y);
  const inside=(r,x,y)=>x>=r.x1&&x<r.x2&&y>=r.y1&&y<r.y2;
  let pending=[],output=[];
  for(let j=0;j<ys.length-1;j++){
   const active=[];
   for(let i=0;i<xs.length-1;i++){
    const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2;
    const p=inside(a,x,y),q=inside(b,x,y);
    if(op==='union'?(p||q):op==='intersect'?(p&&q):(op==='exclude'?(p!==q):(p&&!q))){
     const previous=active[active.length-1];
     if(previous&&previous.x2===xs[i])previous.x2=xs[i+1];
     else active.push({x1:xs[i],x2:xs[i+1],y1:ys[j],y2:ys[j+1]});
    }
   }
   const next=[];
   for(const r of active){const same=pending.find(p=>p.x1===r.x1&&p.x2===r.x2&&p.y2===r.y1);if(same){same.y2=r.y2;next.push(same)}else next.push(r)}
   for(const r of pending)if(!next.includes(r))output.push(r);
   pending=next;
  }
  output.push(...pending);
  return output;
 }

 // Shape Builder, limited to union of 2–12 axis-aligned rectangles.
 function rectUnionMany(rectangles){
  if(!Array.isArray(rectangles)||rectangles.length<2||rectangles.length>12)throw Error('Select 2–12 rectangles');
  for(const r of rectangles)if(!r||![r.x1,r.y1,r.x2,r.y2].every(Number.isFinite)||r.x2<=r.x1||r.y2<=r.y1)throw Error('Invalid rectangle');
  const xs=[...new Set(rectangles.flatMap(r=>[r.x1,r.x2]))].sort((a,b)=>a-b);
  const ys=[...new Set(rectangles.flatMap(r=>[r.y1,r.y2]))].sort((a,b)=>a-b);
  const output=[];let pending=[];
  for(let j=0;j<ys.length-1;j++){
   const active=[];
   for(let i=0;i<xs.length-1;i++){
    const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2;
    if(rectangles.some(r=>x>=r.x1&&x<r.x2&&y>=r.y1&&y<r.y2)){
     const last=active.at(-1);
     if(last&&last.x2===xs[i])last.x2=xs[i+1];
     else active.push({x1:xs[i],y1:ys[j],x2:xs[i+1],y2:ys[j+1]});
    }
   }
   const next=[];
   for(const r of active){const old=pending.find(p=>p.x1===r.x1&&p.x2===r.x2&&p.y2===r.y1);if(old){old.y2=r.y2;next.push(old)}else next.push(r)}
   output.push(...pending.filter(p=>!next.includes(p)));pending=next;
  }
  return output.concat(pending);
 }

 // Return the elementary rectangular region under a clicked point.
 // The result is additive: source objects remain unchanged.
 function rectRegionAtPoint(rectangles,point){
  if(!Array.isArray(rectangles)||rectangles.length<2||rectangles.length>12)throw Error('Select 2–12 rectangles');
  if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))throw Error('Invalid point');
  for(const r of rectangles)if(!r||![r.x1,r.x2,r.y1,r.y2].every(Number.isFinite)||r.x2<=r.x1||r.y2<=r.y1)throw Error('Invalid rectangle');
  const xs=[...new Set(rectangles.flatMap(r=>[r.x1,r.x2]))].sort((a,b)=>a-b);
  const ys=[...new Set(rectangles.flatMap(r=>[r.y1,r.y2]))].sort((a,b)=>a-b);
  const find=(coords,v)=>coords.findIndex((n,i)=>i<coords.length-1&&v>=n&&v<coords[i+1]);
  const i=find(xs,point.x),j=find(ys,point.y);
  if(i<0||j<0)return null;
  const contained=rectangles.some(r=>point.x>=r.x1&&point.x<r.x2&&point.y>=r.y1&&point.y<r.y2);
  return contained?{x1:xs[i],y1:ys[j],x2:xs[i+1],y2:ys[j+1]}:null;
 }

 // Exact convex polygon intersection (Sutherland–Hodgman), coordinates in canvas space.
 // Returns a single convex boundary. Curves and concave inputs must be rejected by caller.
 function convexIntersection(subject,clip){
  const eps=1e-8;
  const check=(points)=>{
   if(!Array.isArray(points)||points.length<3||!points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))throw Error('Invalid polygon');
   let direction=0;
   for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],c=points[(i+2)%points.length];
    const turn=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
    if(Math.abs(turn)>eps){if(direction&&turn*direction< -eps)throw Error('Concave polygon unsupported');direction=Math.sign(turn)}
   }
   if(!direction)throw Error('Degenerate polygon');
   let area=0;
   for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a.x*b.y-b.x*a.y}
   if(Math.abs(area)<eps)throw Error('Degenerate polygon');
   return Math.sign(area);
  };
  check(subject);const winding=check(clip);
  const cross=(a,b,p)=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
  let output=subject.map(p=>({x:p.x,y:p.y}));
  for(let i=0;i<clip.length;i++){
   if(output.length===0)break;
   const a=clip[i],b=clip[(i+1)%clip.length],input=output;output=[];
   const inside=p=>cross(a,b,p)*winding>=-eps;
   const intersection=(p,q)=>{
    const fp=cross(a,b,p),fq=cross(a,b,q),t=fp/(fp-fq);
    return {x:p.x+t*(q.x-p.x),y:p.y+t*(q.y-p.y)};
   };
   for(let j=0;j<input.length;j++){
    const current=input[j],previous=input[(j+input.length-1)%input.length];
    const cIn=inside(current),pIn=inside(previous);
    if(cIn!==pIn)output.push(intersection(previous,current));
    if(cIn)output.push(current);
   }
   output=output.filter((p,j,all)=>j===0||Math.hypot(p.x-all[j-1].x,p.y-all[j-1].y)>eps);
   if(output.length>1&&Math.hypot(output[0].x-output.at(-1).x,output[0].y-output.at(-1).y)<=eps)output.pop();
  }
  if(output.length<3)return [];
  let area=0;
  for(let i=0;i<output.length;i++){const a=output[i],b=output[(i+1)%output.length];area+=a.x*b.y-b.x*a.y}
  return Math.abs(area)<eps?[]:output;
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={rectBoolean,rectUnionMany,rectRegionAtPoint,convexIntersection};
 root.VectorBoolean={rectBoolean,rectUnionMany,rectRegionAtPoint,convexIntersection};
})(typeof window!=='undefined'?window:globalThis);