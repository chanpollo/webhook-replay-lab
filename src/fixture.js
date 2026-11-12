import {redact, digest} from './core.js';

export function validateFixture(fixture) {
  if(!fixture || typeof fixture!=='object' || Array.isArray(fixture) || fixture.version!==1)throw Error('Fixture version 1 required');
  if(Object.keys(fixture).some(key=>!['version','payload','sha256'].includes(key)))throw Error('Unexpected fixture fields');
  if(!fixture.payload || typeof fixture.payload!=='object')throw Error('Fixture payload must be an object or array');
  if(typeof fixture.sha256!=='string' || !/^[a-f0-9]{64}$/.test(fixture.sha256) || digest(fixture.payload)!==fixture.sha256)throw Error('Fixture hash mismatch');
  const payload=redact(fixture.payload);
  if(Buffer.byteLength(JSON.stringify(payload))>65536)throw Error('Sanitized payload exceeds 64 KB');
  return {version:1,payload,sha256:digest(payload),redacted:digest(payload)!==fixture.sha256};
}


export function validateCollection(collection) {
  if(!collection || collection.kind!=='webhook-fixture-collection' || collection.version!==1)throw Error('Collection version 1 required');
  if(Object.keys(collection).some(key=>!['kind','version','name','fixtures'].includes(key)))throw Error('Unexpected collection fields');
  if(typeof collection.name!=='string' || !/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,79}$/.test(collection.name))throw Error('Collection name must be 1–80 simple characters');
  if(!Array.isArray(collection.fixtures) || collection.fixtures.length<1 || collection.fixtures.length>20)throw Error('Collection requires 1–20 fixtures');
  const names=new Set(),fixtures=[];
  let redacted=false;
  for(const entry of collection.fixtures) {
    if(!entry || typeof entry.name!=='string' || !/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,79}$/.test(entry.name) || names.has(entry.name) || Object.keys(entry).some(key=>!['name','fixture'].includes(key)))throw Error('Unique fixture names required');
    names.add(entry.name);const clean=validateFixture(entry.fixture);redacted ||= clean.redacted;
    fixtures.push({name:entry.name,fixture:{version:1,payload:clean.payload,sha256:clean.sha256}});
  }
  const sanitized={kind:collection.kind,version:1,name:collection.name,fixtures};
  if(Buffer.byteLength(JSON.stringify(sanitized))>262144)throw Error('Collection exceeds 256 KB');
  return {collection:sanitized,sha256:digest(sanitized),redacted};
}
