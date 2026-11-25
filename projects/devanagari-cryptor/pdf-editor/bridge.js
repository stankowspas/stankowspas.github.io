/* Mount the original local PDF engine inside the native Office workspace. */
(function () {
 "use strict";
 window.WebOfficePdfMount=function(mountPoint,{doc,root,lang,shadowHost,onLoad}){
  const frame=doc.createElement("iframe");
  frame.title="PDF Editor";frame.allow="web-share";
  frame.style.cssText="display:block;width:100%;height:100%;border:0;background:transparent";
  const collapsed=()=>shadowHost.hasAttribute("data-ribbon-collapsed");
  const settings=()=>({type:"web-office:pdf-settings",lang:lang.value,theme:root.dataset.theme||"dark",ribbonCollapsed:collapsed()});
  const send=()=>{if(frame.contentWindow)frame.contentWindow.postMessage(settings(),window.origin==="null"?"*":window.origin)};
  const url=new URL("pdf-editor/index.html",doc.baseURI);
  url.searchParams.set("embedded","1");
  url.searchParams.set("lang",lang.value);
  url.searchParams.set("theme",root.dataset.theme||"dark");
  url.searchParams.set("ribbonCollapsed",String(collapsed()));
  frame.name=url.searchParams.toString();
  frame.addEventListener("load",()=>{send();onLoad?.()});
  const observer=new MutationObserver(send);
  observer.observe(shadowHost,{attributes:true,attributeFilter:["data-ribbon-collapsed"]});
  frame.src=url.href;
  mountPoint.append(frame);
  return {update:send,destroy(){observer.disconnect();frame.remove()}};
 };
})();
