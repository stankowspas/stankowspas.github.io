/* Pure algorithms for editable open polyline operations. */
(function(root){'use strict';
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 function valid(p){if(!Array.isArray(p)||p.length<2||p.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y)))throw Error('Невалидна полилиния');}
 function simplify(points,tol){valid(points);if(!(tol>0))throw Error('Невалиден толеранс');
  function keep(a,b){let best=-1,idx=-1;const dx=points[b].x-points[a].x,dy=points[b].y-points[a].y,len=dx*dx+dy*dy;
   for(let i=a+1;i<b;i++){const p=points[i];const t=len?Math.max(0,Math.min(1,((p.x-points[a].x)*dx+(p.y-points[a].y)*dy)/len)):0;const d=Math.hypot(p.x-points[a].x-t*dx,p.y-points[a].y-t*dy);if(d>best){best=d;idx=i}}
   if(best>tol){selected.add(idx);keep(a,idx);keep(idx,b)} }
  const selected=new Set([0,points.length-1]);keep(0,points.length-1);return [...selected].sort((a,b)=>a-b).map(i=>({...points[i]}));}
 function join(a,b,tol){valid(a);valid(b);if(!(tol>0))throw Error('Невалиден толеранс');const variants=[[a,b],[a.slice().reverse(),b],[a,b.slice().reverse()],[a.slice().reverse(),b.slice().reverse()]];let best=null;for(const [x,y] of variants){const d=dist(x.at(-1),y[0]);if(!best||d<best.d)best={x,y,d}}if(best.d>tol)throw Error('Краищата са твърде далеч');return best.d<=1e-9 ? [...best.x.map(p=>({...p})),...best.y.slice(1).map(p=>({...p}))] : [...best.x.map(p=>({...p})),...best.y.map(p=>({...p}))];}
 function sample(points,spacing,limit=200){valid(points);if(!(spacing>0)||!Number.isInteger(limit)||limit<1)throw Error('Невалидни настройки');const segments=points.slice(1).map((p,i)=>dist(points[i],p)),total=segments.reduce((a,b)=>a+b,0);if(!total)return [];const count=Math.min(limit,Math.floor(total/spacing)),out=[];for(let n=1;n<=count;n++){let remaining=n*spacing;for(let i=0;i<segments.length;i++){if(remaining<=segments[i]){const t=segments[i]?remaining/segments[i]:0;out.push({x:points[i].x+(points[i+1].x-points[i].x)*t,y:points[i].y+(points[i+1].y-points[i].y)*t});break}remaining-=segments[i]}}return out;}
 function splitAtVertex(points,index){valid(points);if(!Number.isInteger(index)||index<1||index>=points.length-1)throw Error('Избери вътрешен възел');
  const first=points.slice(0,index+1).map(p=>({...p})),second=points.slice(index).map(p=>({...p}));
  return [first,second];}
 root.VectorPathTools=Object.freeze({simplify,join,sample,splitAtVertex});
})(typeof window!=='undefined'?window:globalThis);