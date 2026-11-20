/* zip.js 2.25.0 standalone adapter, standard WinZip AES-256, BSD-3-Clause.
   No workers, network calls or WebAssembly. */
(function(){
"use strict";
const z=window.zip, core=window.DC_ARCHIVE_CORE;
if(!z||!core)throw Error("ZIP library unavailable");
z.configure({useWebWorkers:false,useCompressionStream:true});
const MAX_INPUT=150*1048576,MAX_ZIP=250*1048576,MAX_TOTAL=300*1048576,MAX_ENTRIES=2000;
const err=e=>{
 const s=String(e?.message||e);
 if(/ERR_INVALID_PASSWORD|invalid password/i.test(s))return Error("Неправилна парола за ZIP / Incorrect ZIP password.");
 if(/ERR_INVALID_AUTHENTICATION_CODE|authentication code/i.test(s))return Error("Неправилна парола или повреден ZIP / Authentication error.");
 return e instanceof Error?e:new Error(s);
};
async function zipWrite(files,name="archive.zip",password=""){
 if(!Array.isArray(files)||files.length<1||files.length>MAX_ENTRIES)throw Error("Choose 1 to 2000 files.");
 if(password&&!globalThis.crypto?.getRandomValues)throw Error("Cryptographic random numbers unavailable.");
 let total=0;const seen=new Set();
 const writer=new z.ZipWriter(new z.BlobWriter("application/zip"),{
  password:password||undefined,encryptionStrength:3,level:6,useWebWorkers:false
 });
 try{
  for(const f of files){
   const p=core.pathName(f.pathname||f.file.name);
   if(seen.has(p))throw Error("Duplicate entry: "+p);seen.add(p);
   total+=f.file.size;if(total>MAX_INPUT)throw Error("Input exceeds 150 MiB.");
   await writer.add(p,new z.BlobReader(f.file),{
    password:password||undefined,encryptionStrength:3,level:6,useWebWorkers:false
   });
  }
  const blob=await writer.close();
  return new File([blob],name,{type:"application/zip"});
 }catch(e){try{await writer.close()}catch(_){}throw err(e);}
}
async function zipOpen(file,password=""){
 if(file.size>MAX_ZIP)throw Error("Archive exceeds 250 MiB.");
 const reader=new z.ZipReader(new z.BlobReader(file),{password:password||undefined,useWebWorkers:false});
 try{
  const items=await reader.getEntries({checkAmbiguity:true});
  if(items.length>MAX_ENTRIES)throw Error("Too many ZIP entries.");
  const seen=new Set();let total=0;const entries=[];
  for(const it of items){
   if(it.directory)continue;
   const p=core.pathName(it.filename),size=Number(it.uncompressedSize);
   if(seen.has(p))throw Error("Duplicate ZIP path: "+p);seen.add(p);
   if(!Number.isSafeInteger(size)||size<0||size>MAX_ZIP)throw Error("Unsafe file size: "+p);
   total+=size;if(total>MAX_TOTAL)throw Error("Archive expands beyond 300 MiB.");
   if(it.encrypted&&!password)throw Error("Въведете парола за защитения ZIP архив.");
   const unixType=(it.externalFileAttributes>>>16)&0xf000;
   if(unixType&&unixType!==0x8000)throw Error("Special file cannot be extracted: "+p);
   entries.push({name:p,path:p,size,extract:async()=>{
    try{
     const result=await it.getData(new z.BlobWriter(),{
      password:password||undefined,checkSignature:true,checkCrc32:true,useWebWorkers:false
     });
     if(result.size!==size)throw Error("Extracted file size mismatch: "+p);
     return new File([result],p.split("/").pop(),{type:"application/octet-stream"});
    }catch(e){throw err(e);}
   }});
  }
  return {entries,close:async()=>reader.close()};
 }catch(e){try{await reader.close()}catch(_){}throw err(e);}
}
core.zipWrite=zipWrite;core.zipOpen=zipOpen;core.zipEngine="zip.js 2.25.0 with AES-256";
})();
