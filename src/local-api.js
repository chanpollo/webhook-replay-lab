import http from 'node:http';

// Explicit private agent: never inherit global agents or environment proxies.
// All bytes (including bearer credentials) go directly to literal loopback.
export function localJSON({base,path,token,body,maxBytes=16384,timeoutMs=5000}) {
 const url=new URL(base);
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Loopback HTTP base required');
 if(typeof path!=='string'||!/^\/api\/[A-Za-z0-9/_-]+$/.test(path))throw Error('Local API path required');
 if(typeof token!=='string'||!/^[\x21-\x7e]{32,256}$/.test(token))throw Error('Admin token required');
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>32*1024*1024||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw Error('Bounded local request required');
 const serialized=body===undefined?null:JSON.stringify(body);
 if(serialized!==null&&Buffer.byteLength(serialized)>263168)throw Error('Local request exceeds size limit');
 return new Promise((resolve,reject)=>{
  const agent=new http.Agent({keepAlive:false,proxyEnv:{},maxSockets:1});let settled=false,request;
  const done=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);request?.destroy();agent.destroy();if(error)reject(Error('Local API unavailable or invalid'));else resolve(value);};
  const timer=setTimeout(()=>done(true),timeoutMs);
  try{
   request=http.request({hostname:'127.0.0.1',port:url.port||80,path,method:serialized===null?'GET':'POST',agent,maxHeaderSize:16384,headers:{authorization:'Bearer '+token,'content-type':'application/json',...(serialized===null?{}:{'content-length':Buffer.byteLength(serialized)})}},response=>{
    response.once('error',()=>done(true));response.once('aborted',()=>done(true));
    if(response.statusCode<200||response.statusCode>=300){done(null,{status:response.statusCode,data:null});return;}
    const chunks=[];let size=0;
    response.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){done(true);return;}chunks.push(chunk);});
    response.once('end',()=>{if(settled)return;try{done(null,{status:response.statusCode,data:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)))});}catch{done(true);}});
   });
   request.once('error',()=>done(true));request.end(serialized);
  }catch{done(true);}
 });
}
