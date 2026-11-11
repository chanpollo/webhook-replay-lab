import test from 'node:test';
import assert from 'node:assert/strict';
import {activity,attemptsOf,filterAttempts,outcomeKey} from '../src/analytics.js';
const now=1800000000000;
const event=(at,attempts=[])=>({id:'event-1',label:'Synthetic order',createdAt:at,payload:{},attempts});
test('empty analytics has zero counts and missing latency, not fabricated values',()=>{
 const result=activity([],now);assert.equal(result.captures,0);assert.equal(result.attempts.length,0);assert.equal(result.medianMs,null);assert.equal(result.buckets.length,12);assert.ok(result.buckets.every(b=>b.captures===0&&b.attempts===0));
});
test('capture and attempt windows use their own timestamps and exact boundaries',()=>{
 const data=[event(now-3600001,[{at:now,id:'a',outcome:'blocked'},{at:now-3600000,id:'b',outcome:'unknown_delivery'},{at:now+1,id:'future',outcome:'sending'}]),{...event(now),id:'new'}, {...event(now-3600000),id:'boundary'}];
 const result=activity(data,now,1);assert.equal(result.captures,1);assert.deepEqual(result.attempts.map(a=>a.id),['a']);assert.equal(result.counts.blocked,1);assert.equal(result.buckets.reduce((sum,b)=>sum+b.captures,0),1);assert.equal(result.buckets.reduce((sum,b)=>sum+b.attempts,0),1);
});
test('each outcome remains distinct and HTTP status is not business success',()=>{
 for(const [input,expected] of [[{outcome:'response_received',status:202},'http_ok'],[{outcome:'response_received',status:302},'http_error'],[{outcome:'response_received',status:500},'http_error'],[{outcome:'response_received'},'unclassified'],[{outcome:'response_received',status:999},'unclassified'],[{outcome:'unknown_delivery'},'unknown'],[{outcome:'blocked'},'blocked'],[{outcome:'validating'},'active'],[{outcome:'sending'},'active']])assert.equal(outcomeKey(input),expected);
});
test('median uses recorded response durations only, including zero',()=>{
 const attempts=[0,10,30,100].map(durationMs=>({at:now,outcome:'response_received',status:200,durationMs}));attempts.push({at:now,outcome:'unknown_delivery',durationMs:999},{at:now,outcome:'response_received',durationMs:-1},{at:now,outcome:'response_received'});
 const data=activity([event(now,attempts)],now);assert.equal(data.medianMs,20);assert.equal(data.durationCount,4);assert.equal(data.attempts.length,7);
});
test('history is newest first, filterable by event, attempt and destination, without mutation',()=>{
 const records=[event(now,[{id:'attempt-a',at:now-1,url:'https://stage.example/hook',outcome:'unknown_delivery'},{id:'attempt-b',at:now,url:'https://other.example/hook',outcome:'blocked'}])];const before=JSON.stringify(records),all=attemptsOf(records);
 assert.equal(all[0].id,'attempt-b');assert.equal(filterAttempts(all,'STAGE','unknown').length,1);assert.equal(filterAttempts(all,'synthetic').length,2);assert.equal(filterAttempts(all,'event-1').length,2);assert.equal(filterAttempts(all,'attempt-a')[0].id,'attempt-a');assert.equal(filterAttempts(all,'absent').length,0);assert.equal(JSON.stringify(records),before);
});
test('deleted or capped records cannot contribute phantom totals',()=>{
 const records=[event(now,Array.from({length:20},(_,i)=>({id:String(i),at:now,outcome:'blocked'})))];assert.equal(activity(records,now).attempts.length,20);assert.equal(activity([],now).attempts.length,0);
});
