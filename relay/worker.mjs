const MAX=50*1024*1024,DAY=86400000;
const valid=id=>/^[a-f0-9-]{36}$/.test(id||'');
const json=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store'}});
async function bounded(request){let size=0;const reader=request.body?.getReader(),chunks=[];if(!reader)throw Error('Empty upload');try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX+1024*1024)throw Error('Maximum upload size is 50 MB');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}return new Blob(chunks)}
export default {async fetch(request,env){
 const path=new URL(request.url).pathname;
 const expected=request.method==='POST'&&path==='/upload'?env.UPLOAD_KEY:env.READ_KEY;
 if(!expected||request.headers.get('authorization')!==`Bearer ${expected}`)return json({error:'Unauthorized'},401);
 try{
 if(request.method==='POST'&&path==='/upload'){
 const raw=await bounded(request);const type=request.headers.get('content-type')||'';let files=[];
 if(type.startsWith('multipart/form-data')){const form=await new Response(raw,{headers:{'content-type':type}}).formData();files=[...form.values()].filter(v=>typeof v!=='string');const text=form.get('text');if(typeof text==='string'&&text)files.push(new File([text],'shared-text.txt',{type:'text/plain'}))}else{files=[new File([raw],request.headers.get('x-filename')||'shared-file',{type:type||'application/octet-stream'})]}
 if(!files.length||files.length>20||files.reduce((n,f)=>n+f.size,0)>MAX)return json({error:'Share 1–20 files, up to 50 MB total per upload'},400);
 const id=crypto.randomUUID(),at=Date.now(),items=[];
 for(const f of files){const fileId=crypto.randomUUID(),name=f.name.replace(/[\/\\\x00-\x1f]/g,'_').slice(0,200)||'shared-file';await env.UPLOADS.put(`files/${fileId}`,f.stream(),{httpMetadata:{contentType:f.type||'application/octet-stream'},customMetadata:{createdAt:String(at)}});items.push({id:fileId,name,mimeType:f.type||'application/octet-stream',sizeBytes:f.size})}
 await env.UPLOADS.put(`batches/${id}`,JSON.stringify({id,createdAt:at,expiresAt:at+DAY,files:items}),{customMetadata:{createdAt:String(at)}});
 return json({id});
 }
 const batch=path.match(/^\/batch\/([a-f0-9-]+)$/);
 if(batch&&valid(batch[1])){const obj=await env.UPLOADS.get('batches/'+batch[1]);if(!obj)return json({error:'Share expired or not found'},404);const data=await obj.json();if(data.expiresAt<Date.now())return json({error:'Share expired'},410);if(request.method==='GET')return json(data);if(request.method==='DELETE'){await env.UPLOADS.delete([...data.files.map(f=>'files/'+f.id),'batches/'+batch[1]]);return json({ok:true})}}
 const file=path.match(/^\/file\/([a-f0-9-]+)$/);
 if(file&&valid(file[1])&&request.method==='GET'){const obj=await env.UPLOADS.get('files/'+file[1]);if(!obj||Number(obj.customMetadata?.createdAt)+DAY<Date.now())return json({error:'File expired'},404);return new Response(obj.body,{headers:{'content-type':'application/octet-stream','cache-control':'no-store','content-length':String(obj.size)}})}
 return json({error:'Not found'},404);
 }catch(e){return json({error:e.message||'Upload failed'},400)}
}};
