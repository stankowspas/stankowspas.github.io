/* Vector Studio - bounded monochrome run-length tracing; no dependencies. */
(function(root){'use strict';
function trace(data,width,height,threshold=128,step=1,maxRects=4000){
 if(!data||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||!Number.isInteger(step)||step<1)throw Error('Невалидно изображение');
 const rects=[];
 for(let y=0;y<height;y+=step){
  let start=-1;const end=Math.min(height,y+step);
  for(let x=0;x<=width;x+=step){
   let dark=false;
   if(x<width){const i=(y*width+x)*4;const alpha=data[i+3]/255;const gray=(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2])*alpha+255*(1-alpha);dark=gray<threshold;}
   if(dark&&start<0)start=x;
   if(!dark&&start>=0){rects.push({x:start,y,width:Math.min(x,width)-start,height:end-y});start=-1;if(rects.length>maxRects)throw Error('Твърде сложен контур — намали детайлността');}
  }
 }
 return rects;
}
root.VStudioTrace={trace};
if(typeof module!=='undefined'&&module.exports)module.exports={trace};
})(typeof globalThis!=='undefined'?globalThis:this);