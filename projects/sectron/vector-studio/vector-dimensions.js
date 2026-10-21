/* Exact coordinate-to-unit conversion for measured vector line lengths. */
(function(root){'use strict';
 const factors=Object.freeze({px:1,mm:96/25.4,cm:96/2.54,in:96});
 function measure(x1,y1,x2,y2,unit='mm'){
  if(!Object.prototype.hasOwnProperty.call(factors,unit))throw Error('Unsupported unit');
  if(![x1,y1,x2,y2].every(Number.isFinite))throw Error('Invalid coordinates');
  return Math.hypot(x2-x1,y2-y1)/factors[unit];
 }
 function label(length,unit='mm'){
  if(!Number.isFinite(length)||length<0||!Object.prototype.hasOwnProperty.call(factors,unit))throw Error('Invalid measurement');
  return (Math.round(length*1000)/1000).toLocaleString('bg-BG',{maximumFractionDigits:3})+' '+unit;
 }
 const api={measure,label,factors};
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.VectorDimensions=api;
})(typeof window!=='undefined'?window:globalThis);