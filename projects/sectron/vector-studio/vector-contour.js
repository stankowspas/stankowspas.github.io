/* Conservative exact outward/inward offsets for axis-aligned rectangles and circles. */
(function(root){'use strict';
 function contourRect(r,d){
  if(!Number.isFinite(d)||![r.x1,r.y1,r.x2,r.y2].every(Number.isFinite)||r.x2<=r.x1||r.y2<=r.y1)throw Error('Невалиден правоъгълник или отстояние');
  const x1=r.x1-d,y1=r.y1-d,x2=r.x2+d,y2=r.y2+d;
  if(x2-x1<=1e-8||y2-y1<=1e-8)throw Error('Отстоянието премахва правоъгълника');
  return{x1,y1,x2,y2};
 }
 function contourCircle(c,d){
  if(!Number.isFinite(d)||![c.x,c.y,c.radius].every(Number.isFinite)||c.radius<=0)throw Error('Невалидна окръжност или отстояние');
  const radius=c.radius+d;
  if(radius<=1e-8)throw Error('Отстоянието премахва окръжността');
  return{x:c.x,y:c.y,radius};
 }

 // Exact parallel-edge offset for strictly convex polygons; rejects collapsed/unstable results.
 function contourConvex(points,d){
  if(!Array.isArray(points)||points.length<3||points.length>32||!Number.isFinite(d)||d===0)throw Error('Невалиден многоъгълник или отстояние');
  const n=points.length, eps=1e-8;
  if(!points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))throw Error('Невалидни върхове');
  let twiceArea=0;
  for(let i=0;i<n;i++){const a=points[i],b=points[(i+1)%n];twiceArea+=a.x*b.y-b.x*a.y;}
  if(Math.abs(twiceArea)<eps)throw Error('Нулева площ');
  const orientation=Math.sign(twiceArea), edges=[];
  for(let i=0;i<n;i++){
   const a=points[i],b=points[(i+1)%n],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
   if(len<eps)throw Error('Повтарящи се върхове');
   const c=points[(i+2)%n],cross=dx*(c.y-b.y)-dy*(c.x-b.x);
   if(cross*orientation<eps)throw Error('Формата не е строго изпъкнала');
   edges.push({x:a.x+orientation*dy/len*d,y:a.y-orientation*dx/len*d,dx,dy});
  }
  const result=[];
  for(let i=0;i<n;i++){
   const a=edges[(i+n-1)%n],b=edges[i],den=a.dx*b.dy-a.dy*b.dx;
   if(Math.abs(den)<eps)throw Error('Нестабилно отместване');
   const t=((b.x-a.x)*b.dy-(b.y-a.y)*b.dx)/den;
   const x=a.x+t*a.dx,y=a.y+t*a.dy;
   if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Невалиден резултат');
   result.push({x,y});
  }
  let area=0;
  for(let i=0;i<n;i++){
   const a=result[i],b=result[(i+1)%n],c=result[(i+2)%n];
   const cr=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
   if(cr*orientation<eps)throw Error('Отстоянието свива или обръща многоъгълника');
   area+=a.x*b.y-b.x*a.y;
  }
  if(area*orientation<=eps)throw Error('Отстоянието премахва многоъгълника');
  return result;
 }
 root.VectorContour=Object.freeze({contourRect,contourCircle,contourConvex});
})(typeof window!=='undefined'?window:globalThis);