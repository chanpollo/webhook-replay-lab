// Run with the trusted Node installation's bundled semver; no project dependencies.
const fs=require('node:fs'),crypto=require('node:crypto');
const semver=require(process.env.SEMVER_MODULE);
const version=process.argv[2],file=process.argv[3];
if(!semver.valid(version)||!file)throw Error('Usage: NODE_VERSION FEED_JSON; SEMVER_MODULE required');
const raw=fs.readFileSync(file),data=JSON.parse(raw),unresolved=[],unparsed=[];let matched=0,patched=0;
if(!data||Array.isArray(data)||typeof data!=='object'||!Object.keys(data).length)throw Error('Empty or invalid advisory feed');
for(const[id,x]of Object.entries(data)){
 if(!semver.validRange(x.vulnerable)||x.patched&&!semver.validRange(x.patched)){unparsed.push(id);continue;}
 if(semver.satisfies(version,x.vulnerable)){matched++;if(x.patched&&semver.satisfies(version,x.patched))patched++;else unresolved.push({id,cve:x.cve,ref:x.ref,vulnerable:x.vulnerable,patched:x.patched});}
}
console.log(JSON.stringify({node:version,sourceSha256:crypto.createHash('sha256').update(raw).digest('hex'),entries:Object.keys(data).length,matchedMajorRanges:matched,coveredByPatchedRanges:patched,unresolved,unparsed},null,2));
if(unresolved.length||unparsed.length)process.exitCode=1;
