import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {createPocketServer} from '../bridge.mjs';
test('uploads are bounded and bound to a thread; attachments send once without accepting arbitrary paths',async()=>{
 const deliveries=[],uploads=[];let records={};const uuid='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 const upstream=http.createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;deliveries.push(JSON.parse(body));res.setHeader('content-type','application/json');res.end('{}')});await new Promise(r=>upstream.listen(18895,'127.0.0.1',r));
 let service,port=18894;const start=async()=>service=await createPocketServer({port,upstream:'http://127.0.0.1:18895',journalStore:{load:async()=>records,save:async r=>{records=r}},attachments:{upload:async(thread,bytes,name,mime)=>{uploads.push({thread,bytes,name,mime});return {id:uuid,name,sizeBytes:bytes.length}},resolve:async(thread,ids)=>{await new Promise(r=>setTimeout(r,10));assert.equal(thread,'t');if(ids.some(id=>id!==uuid))throw Object.assign(Error('Unknown attachment'),{status:400});return [{type:'localFile',name:'doc.pdf',path:'/safe/doc.pdf',sizeBytes:4,mimeType:'application/pdf'}]}}});
 const send=payload=>fetch(`http://127.0.0.1:${port}/api/thread/t/send`,{method:'POST',headers:{connection:'close','content-type':'application/json','x-pocket-request':'1'},body:JSON.stringify(payload)});
 try{await start();const u=await fetch('http://127.0.0.1:18894/api/thread/t/attachments',{method:'POST',headers:{'x-pocket-request':'1','x-pocket-filename':encodeURIComponent('../doc.pdf'),'content-type':'application/pdf'},body:'%PDF'});assert.equal(u.status,200);assert.equal(uploads[0].name,'.._doc.pdf');assert.equal(uploads[0].bytes.toString(),'%PDF');
 const bad=await fetch('http://127.0.0.1:18894/api/thread/t/attachments',{method:'POST',headers:{origin:'https://bad.example','x-pocket-request':'1'},body:'bad'});assert.equal(bad.status,403);assert.equal(uploads.length,1);
 const message={id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',text:'',attachmentIds:[uuid],path:'/etc/passwd'};
 await Promise.all([send(message),send(message)]);assert.equal(deliveries.length,1);assert.deepEqual(deliveries[0].input,[{type:'localFile',path:'/safe/doc.pdf',name:'doc.pdf',mimeType:'application/pdf',sizeBytes:4}]);
 await service.close();port=18896;await start();await send(message);assert.equal(deliveries.length,1);assert.equal((await send({...message,text:'changed'})).status,409);
 assert.equal((await send({id:'cccccccc-cccc-cccc-cccc-cccccccccccc',text:'',attachmentIds:['/etc/passwd']})).status,400);
 assert.equal((await send({id:'cccccccc-cccc-cccc-cccc-cccccccccccc',text:'',attachmentIds:['dddddddd-dddd-dddd-dddd-dddddddddddd']})).status,400);assert.equal(records['cccccccc-cccc-cccc-cccc-cccccccccccc'],undefined);
 }finally{await service?.close();await new Promise(r=>upstream.close(r))}
});
