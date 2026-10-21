/* Closed four-cubic approximation of an ellipse, for editable vector paths. */
(function(root){'use strict';
 const K=4*(Math.sqrt(2)-1)/3;
 function ellipsePath(rx,ry){
  if(!Number.isFinite(rx)||!Number.isFinite(ry)||rx<=0||ry<=0)throw Error('Невалидни радиуси на елипсата');
  const x=rx,y=ry,k=K;
  return [['M',x,0],['C',x,k*y,k*x,y,0,y],['C',-k*x,y,-x,k*y,-x,0],
   ['C',-x,-k*y,-k*x,-y,0,-y],['C',k*x,-y,x,-k*y,x,0],['Z']];
 }
 root.VectorEllipsePath=Object.freeze({ellipsePath,K});
})(typeof window!=='undefined'?window:globalThis);