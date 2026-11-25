/* Separate PDF Editor tab; existing Web Office engines remain unchanged. */
(function installPdfEditor(){
 "use strict";
 const doc=document,root=doc.documentElement,nav=doc.querySelector(".mode-tabs"),select=doc.getElementById("modeSelect"),language=doc.getElementById("langSelect");
 if(!nav||!select||!language||doc.getElementById("pdfEditorTab"))return;
 const style=doc.createElement("style");
 style.textContent="#pdfEditorPanel[hidden]{display:none!important}#pdfEditorPanel{flex:1;min-width:0;min-height:420px;border:1px solid var(--edge);border-radius:12px;overflow:hidden;background:var(--panel);box-shadow:0 4px 18px var(--shadow)}#pdfEditorPanel iframe{display:block;width:100%;height:100%;border:0;background:var(--page)}html[data-pdf-editor-active] #textSection,html[data-pdf-editor-active] #fileSection,html[data-pdf-editor-active] #archiveSection,html[data-pdf-editor-active] #helpClassic,html[data-pdf-editor-active] #helpSecure,html[data-pdf-editor-active] #helpFiles,html[data-pdf-editor-active] #cryptorOffice{display:none!important}";
 doc.head.append(style);
 const tab=doc.createElement("button");tab.id="pdfEditorTab";tab.type="button";tab.className="mode-tab";tab.dataset.mode="pdf-editor";tab.setAttribute("role","tab");tab.setAttribute("aria-controls","pdfEditorPanel");tab.setAttribute("aria-selected","false");tab.tabIndex=-1;tab.textContent="PDF Editor";tab.title="PDF Editor";nav.append(tab);
 const option=doc.createElement("option");option.value="pdf-editor";option.textContent="PDF Editor";select.append(option);
 const panel=doc.createElement("section");panel.id="pdfEditorPanel";panel.hidden=true;panel.setAttribute("role","tabpanel");panel.setAttribute("aria-labelledby",tab.id);nav.after(panel);
 let frame;
 const settings=()=>({type:"web-office:pdf-settings",lang:language.value,theme:root.dataset.theme||"dark"});
 function send(){if(frame?.contentWindow)frame.contentWindow.postMessage(settings(),location.origin)}
 function fit(){if(!panel.hidden)panel.style.height=Math.max(420,window.innerHeight-panel.getBoundingClientRect().top-16)+"px"}
 function sync(){
  const active=select.value==="pdf-editor";panel.hidden=!active;root.toggleAttribute("data-pdf-editor-active",active);
  tab.setAttribute("aria-selected",String(active));tab.tabIndex=active?0:-1;tab.title="PDF Editor";
  if(!active)return;
  for(const b of nav.querySelectorAll('[role="tab"]'))if(b!==tab){b.setAttribute("aria-selected","false");b.tabIndex=-1}
  if(!frame){
   frame=doc.createElement("iframe");frame.title="PDF Editor";frame.allow="web-share";
   const url=new URL("pdf-editor/index.html",doc.baseURI);url.searchParams.set("lang",language.value);url.searchParams.set("theme",root.dataset.theme||"dark");
   frame.addEventListener("load",send);frame.src=url.href;panel.append(frame);
  }
  fit();send();
 }
 tab.addEventListener("click",()=>{select.value="pdf-editor";select.dispatchEvent(new Event("change"))});
 nav.addEventListener("click",sync);
 select.addEventListener("change",sync);
 language.addEventListener("change",()=>{tab.title="PDF Editor";send()});
 new MutationObserver(()=>{send();fit()}).observe(root,{attributes:true,attributeFilter:["data-theme","lang"]});
 window.addEventListener("resize",fit);
 nav.addEventListener("keydown",e=>{
  if(e.target!==tab||e.defaultPrevented)return;
  const tabs=[...nav.querySelectorAll('[role="tab"]')],i=tabs.indexOf(tab);let j;
  if(e.key==="ArrowRight")j=(i+1)%tabs.length;else if(e.key==="ArrowLeft")j=(i+tabs.length-1)%tabs.length;else if(e.key==="Home")j=0;else if(e.key==="End")j=tabs.length-1;else return;
  e.preventDefault();tabs[j].click();tabs[j].focus();
 });
 sync();
})();
