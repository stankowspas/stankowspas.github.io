export async function sandboxStreamCandidates(urls){
  const out=[];
  for(const raw of Array.isArray(urls)?urls:[]){
    try{const u=new URL(String(raw||'').trim());if(u.protocol==='https:'&&!out.includes(u.href))out.push(u.href)}catch{}
    if(out.length>=4)break;
  }
  return out;
}
