/* Convex polygon split by infinite directed line, preserving exact intersections. */
(function(root){'use strict';
 const EPS=1e-8;
 const cross=(a,b,p)=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
 const area=ps=>ps.reduce((s,p,i)=>s+p.x*ps[(i+1)%ps.length].y-ps[(i+1)%ps.length].x*p.y,0)/2;
 function clean(ps){const out=[];for(const p of ps){if(!out.length||Math.hypot(p.x-out.at(-1).x,p.y-out.at(-1).y)>EPS)out.push(p)}if(out.length>1&&Math.hypot(out[0].x-out.at(-1).x,out[0].y-out.at(-1).y)<=EPS)out.pop();return out;}
 function clip(ps,a,b,side){const out=[];for(let i=0;i<ps.length;i++){
 const p=ps[i],q=ps[(i+1)%ps.length],dp=side*cross(a,b,p),dq=side*cross(a,b,q),inp=dp>=-EPS,inq=dq>=-EPS;
 if(inp)out.push({...p});if(inp!==inq){const t=dp/(dp-dq);out.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t})}
 }return clean(out)}
 function split(points,a,b){if(!Array.isArray(points)||points.length<3||points.length>128||![...points,a,b].every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)))throw Error('Невалидна геометрия');
 if(Math.hypot(a.x-b.x,a.y-b.y)<EPS)throw Error('Линията на разреза е твърде къса');
 const ps=clean(points);if(ps.length<3||Math.abs(area(ps))<EPS)throw Error('Дегенериран многоъгълник');
 const turn=Math.sign(area(ps));for(let i=0;i<ps.length;i++){const c=cross(ps[i],ps[(i+1)%ps.length],ps[(i+2)%ps.length]);if(turn*c< -EPS)throw Error('Поддържат се само изпъкнали многоъгълници');}
 const left=clip(ps,a,b,1),right=clip(ps,a,b,-1);if(left.length<3||right.length<3||Math.abs(area(left))<EPS||Math.abs(area(right))<EPS)throw Error('Разрезът не разделя фигурата на две части');
 const original=Math.abs(area(ps)),result=Math.abs(area(left))+Math.abs(area(right));if(Math.abs(original-result)>Math.max(1e-6,original*1e-8))throw Error('Разрезът не запазва площта');
 return [left,right];}
 root.VectorPolygonKnife=Object.freeze({split,area});
})(typeof window!=='undefined'?window:globalThis);