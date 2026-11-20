/* Devanagari Cryptor — independent ZIP/TAR/GZIP engine. SPDX-License-Identifier: MIT.
   No server calls, no WebAssembly dependency. */
(function(g){
"use strict";
const dec=new TextDecoder("utf-8",{fatal:true}),enc=new TextEncoder();
const u16=(a,p)=>a[p]|(a[p+1]<<8),u32=(a,p)=>(a[p]|(a[p+1]<<8)|(a[p+2]<<16)|(a[p+3]<<24))>>>0;
const put16=(a,p,n)=>{a[p]=n&255;a[p+1]=(n>>>8)&255;};
const put32=(a,p,n)=>{a[p]=n&255;a[p+1]=(n>>>8)&255;a[p+2]=(n>>>16)&255;a[p+3]=(n>>>24)&255;};
function pathName(raw){
 const p=String(raw||"").replace(/\\/g,"/");
 if(p.length>1024||!p||p.startsWith("/")||/^[a-zA-Z]:/.test(p)||/[\x00-\x1f\x7f]/.test(p))throw Error("Unsafe archive path");
 const bits=p.split("/").filter(Boolean);
 if(!bits.length||bits.some(x=>x===".."||x==="."||x.length>255))throw Error("Unsafe archive path");
 return bits.join("/");
}
const table=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[i]=c>>>0;}
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
async function streamTransform(bytes,kind,compress){
 const name=compress?"CompressionStream":"DecompressionStream";
 if(typeof g[name]!=="function")throw Error(name+" is unsupported by this browser");
 const stream=new Blob([bytes]).stream().pipeThrough(new g[name](kind));
 return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function zipWrite(files,name="archive.zip"){
 if(!files?.length)throw Error("Select files");if(files.length>2000)throw Error("Limit: 2000 files");
 let total=0,offset=0;const chunks=[],central=[],used=new Set();
 for(const item of files){
  const path=pathName(item.pathname||item.file.name);if(used.has(path))throw Error("Duplicate path: "+path);used.add(path);
  const source=new Uint8Array(await item.file.arrayBuffer());total+=source.length;
  if(total>150*1048576)throw Error("Limit: 150 MiB total input");
  const filename=enc.encode(path);if(filename.length>65535)throw Error("Filename too long");
  const checksum=crc32(source);let compressed=source,method=0;
  if(source.length){try{const candidate=await streamTransform(source,"deflate-raw",true);if(candidate.length<source.length){compressed=candidate;method=8;}}catch(e){if(!/not supported|not a valid enum value|unsupported/i.test(String(e)))throw e;}}
  const local=new Uint8Array(30+filename.length);put32(local,0,0x04034b50);put16(local,4,20);put16(local,6,0x800);put16(local,8,method);
  put32(local,14,checksum);put32(local,18,compressed.length);put32(local,22,source.length);put16(local,26,filename.length);local.set(filename,30);
  const center=new Uint8Array(46+filename.length);put32(center,0,0x02014b50);put16(center,4,20);put16(center,6,20);put16(center,8,0x800);put16(center,10,method);
  put32(center,16,checksum);put32(center,20,compressed.length);put32(center,24,source.length);put16(center,28,filename.length);put32(center,42,offset);center.set(filename,46);
  chunks.push(local,compressed);central.push(center);offset+=local.length+compressed.length;
 }
 const centralSize=central.reduce((n,b)=>n+b.length,0);chunks.push(...central);
 const footer=new Uint8Array(22);put32(footer,0,0x06054b50);put16(footer,8,files.length);put16(footer,10,files.length);put32(footer,12,centralSize);put32(footer,16,offset);chunks.push(footer);
 return new File(chunks,name,{type:"application/zip"});
}
async function zipOpen(file){
 if(file.size>250*1048576)throw Error("Limit: 250 MiB archive");
 const bytes=new Uint8Array(await file.arrayBuffer());
 let end=-1;for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(u32(bytes,p)===0x06054b50&&p+22+u16(bytes,p+20)<=bytes.length){end=p;break;}
 if(end<0)throw Error("Invalid ZIP end-of-central-directory record");
 if(u16(bytes,end+4)||u16(bytes,end+6)||u16(bytes,end+8)!==u16(bytes,end+10))throw Error("Multi-disk ZIP unsupported");
 const count=u16(bytes,end+10),centralSize=u32(bytes,end+12),start=u32(bytes,end+16);
 if(count>2000||start+centralSize>end)throw Error("Invalid ZIP directory");
 let ptr=start,total=0;const entries=[],seen=new Set();
 for(let i=0;i<count;i++){
  if(ptr+46>end||u32(bytes,ptr)!==0x02014b50)throw Error("Invalid ZIP directory entry");
  const flags=u16(bytes,ptr+8),method=u16(bytes,ptr+10),crc=u32(bytes,ptr+16),comp=u32(bytes,ptr+20),size=u32(bytes,ptr+24),nameLen=u16(bytes,ptr+28),extra=u16(bytes,ptr+30),comment=u16(bytes,ptr+32),external=u32(bytes,ptr+38),off=u32(bytes,ptr+42);
  if(ptr+46+nameLen+extra+comment>end)throw Error("Truncated ZIP directory");
  if(flags&1)throw Error("Encrypted ZIP requires a separate engine");
  if(size===0xffffffff||comp===0xffffffff||off===0xffffffff)throw Error("ZIP64 requires a separate engine");
  if(method!==0&&method!==8)throw Error("Unsupported ZIP compression method: "+method);
  const raw=dec.decode(bytes.subarray(ptr+46,ptr+46+nameLen));ptr+=46+nameLen+extra+comment;
  if(raw.endsWith("/"))continue;
  if(((external>>>16)&0xf000)===0xa000)throw Error("Symbolic links are not extracted");
  const name=pathName(raw);if(seen.has(name))throw Error("Duplicate path: "+name);seen.add(name);
  if(size>250*1048576)throw Error("Individual item exceeds size limit");
  total+=size;if(total>300*1048576)throw Error("Archive expands beyond 300 MiB limit");
  if(off+30>start||u32(bytes,off)!==0x04034b50)throw Error("Invalid ZIP local header");
  const namel=u16(bytes,off+26),extral=u16(bytes,off+28),dataStart=off+30+namel+extral;
  if(dataStart+comp>start)throw Error("Invalid compressed data range");
  if(dec.decode(bytes.subarray(off+30,off+30+namel))!==raw)throw Error("ZIP filename mismatch");
  const entry={name,path:name,size,extract:async()=>{
    const compressed=bytes.subarray(dataStart,dataStart+comp);
    const result=method===0?compressed:await streamTransform(compressed,"deflate-raw",false);
    if(result.length!==size||crc32(result)!==crc)throw Error("Corrupt ZIP entry: "+name);
    return new File([result],name.split("/").pop(),{type:"application/octet-stream"});
  }};
  entries.push(entry);
 }
 return {entries,close:async()=>{}};
}
function tarOct(buf,offset,len,v){const value=v.toString(8).padStart(len-1,"0")+"\0";buf.set(enc.encode(value).slice(0,len),offset);}
async function tarWrite(files,name="archive.tar",gzip=false){
 if(!files?.length)throw Error("Select files");if(files.length>2000)throw Error("Limit: 2000 files");
 let total=0;const parts=[],used=new Set();
 for(const item of files){
  const path=pathName(item.pathname||item.file.name);if(used.has(path))throw Error("Duplicate path: "+path);used.add(path);
  const data=new Uint8Array(await item.file.arrayBuffer());total+=data.length;if(total>150*1048576)throw Error("Limit: 150 MiB");
  const pathBytes=enc.encode(path);if(pathBytes.length>100)throw Error("TAR path exceeds 100 UTF-8 bytes: "+path);
  const hdr=new Uint8Array(512);hdr.set(pathBytes,0);tarOct(hdr,100,8,0o644);tarOct(hdr,108,8,0);tarOct(hdr,116,8,0);tarOct(hdr,124,12,data.length);tarOct(hdr,136,12,Math.floor(Date.now()/1000));hdr.fill(32,148,156);hdr[156]=48;hdr.set(enc.encode("ustar\0"),257);hdr.set(enc.encode("00"),263);
  let sum=0;for(const b of hdr)sum+=b;tarOct(hdr,148,8,sum);
  parts.push(hdr,data);if(data.length%512)parts.push(new Uint8Array(512-data.length%512));
 }
 parts.push(new Uint8Array(1024));let blob=new Blob(parts,{type:"application/x-tar"});
 if(gzip){const bytes=new Uint8Array(await blob.arrayBuffer());const packed=await streamTransform(bytes,"gzip",true);blob=new Blob([packed],{type:"application/gzip"});}
 return new File([blob],name,{type:blob.type});
}
async function tarOpen(file,gzip=false){
 if(file.size>250*1048576)throw Error("Limit: 250 MiB archive");
 let bytes=new Uint8Array(await file.arrayBuffer());if(gzip)bytes=await streamTransform(bytes,"gzip",false);
 if(bytes.length>300*1048576)throw Error("Expanded archive exceeds 300 MiB");
 const result=[],seen=new Set();let ptr=0;
 while(ptr+512<=bytes.length){
  const hdr=bytes.subarray(ptr,ptr+512);if(hdr.every(x=>x===0))break;
  const u=(offset,len)=>{const k=hdr.subarray(offset,offset+len);const zero=k.indexOf(0);return dec.decode(zero<0?k:k.slice(0,zero));};
  const parseOct=str=>{const v=parseInt(str.trim(),8);if(!Number.isSafeInteger(v)||v<0)throw Error("Invalid TAR size");return v;};
  const nameRaw=u(0,100),prefix=u(345,155),size=parseOct(u(124,12)),flag=hdr[156],reported=parseOct(u(148,8));
  let checksum=0;for(let i=0;i<512;i++)checksum+=(i>=148&&i<156)?32:hdr[i];if(reported!==checksum)throw Error("Invalid TAR checksum");
  ptr+=512;if(ptr+size>bytes.length)throw Error("Truncated TAR file");
  if(flag===0||flag===48){const full=pathName((prefix?prefix+"/":"")+nameRaw);if(seen.has(full))throw Error("Duplicate TAR path: "+full);seen.add(full);
   const start=ptr;result.push({path:full,name:full,size,extract:async()=>new File([bytes.slice(start,start+size)],full.split("/").pop())});
  }else if(flag!==53){throw Error("Unsupported TAR special entry type: "+String.fromCharCode(flag));}
  ptr+=Math.ceil(size/512)*512;if(result.length>2000)throw Error("Too many entries");
 }
 return {entries:result,close:async()=>{}};
}
async function gzipWrite(files,name="archive.gz"){
 if(files.length!==1)throw Error("GZIP requires exactly one file");
 const input=new Uint8Array(await files[0].file.arrayBuffer());if(input.length>150*1048576)throw Error("Limit: 150 MiB");
 const zipped=await streamTransform(input,"gzip",true);
 return new File([zipped],name,{type:"application/gzip"});
}
async function gzipOpen(file){
 if(file.size>250*1048576)throw Error("Limit: 250 MiB");
 const raw=new Uint8Array(await file.arrayBuffer()),bytes=await streamTransform(raw,"gzip",false);
 if(bytes.length>300*1048576)throw Error("Expanded file exceeds 300 MiB");
 const name=pathName(file.name.replace(/\.gz$/i,"")||"decompressed");
 return {entries:[{path:name,name,size:bytes.length,extract:async()=>new File([bytes],name.split("/").pop())}],close:async()=>{}};
}
g.DC_ARCHIVE_CORE={zipWrite,zipOpen,tarWrite,tarOpen,gzipWrite,gzipOpen,crc32,pathName};
})(window);
