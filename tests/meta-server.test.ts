import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Request} from 'express';
import {sendMetaLead} from '../server/meta';
const id='b5d8456d-427b-4d8e-a834-117a1276ddbe';
function request(consent?:string){return {ip:'192.0.2.1',cookies:{_fbp:'fb.1.1792512000000.123456',_fbc:'invalid-cookie'},get:(name:string)=>name==='x-marketing-consent'?consent:name==='user-agent'?'Fixture Browser':''} as unknown as Request;}
test('CAPI wymaga tokenu i aktualnej zgody; przesyła tylko Lead i dane techniczne z identycznym event_id',async()=>{
 const before={...process.env};const native=globalThis.fetch;const calls:{url:string;options:RequestInit}[]=[];
 try{
  process.env.META_PIXEL_ID='1449807230414613';process.env.APP_MODE='production';process.env.APP_ORIGIN='https://czystypomnik.waw.pl';delete process.env.META_CONVERSIONS_API_TOKEN;
  globalThis.fetch=async(url,options)=>{calls.push({url:String(url),options:options!});return Response.json({events_received:1});};
  assert.equal((await sendMetaLead(request('v2'),id)).state,'disabled');process.env.META_CONVERSIONS_API_TOKEN='fixture-only-never-real';
  for(const consent of [undefined,'v1','true'])assert.equal((await sendMetaLead(request(consent),id)).state,'no_consent');assert.equal(calls.length,0);
  assert.equal((await sendMetaLead(request('v2'),id)).state,'sent');assert.equal(calls.length,1);
  const c=calls[0];assert.match(c.url,/^https:\/\/graph.facebook.com\/v\d+\.0\/1449807230414613\/events$/);assert.ok(!c.url.includes('fixture-only'));
  const body=JSON.parse(String(c.options.body));const event=body.data[0];assert.equal(event.event_name,'Lead');assert.equal(event.event_id,'cp-lead-'+id);assert.equal(event.action_source,'website');assert.equal(event.event_source_url,'https://czystypomnik.waw.pl/');
  assert.deepEqual(event.user_data,{client_user_agent:'Fixture Browser',client_ip_address:'192.0.2.1',fbp:'fb.1.1792512000000.123456'});assert.equal(event.custom_data,undefined);assert.equal(body.test_event_code,undefined);
  process.env.META_TEST_EVENT_CODE='TEST_FIXTURE';assert.equal((await sendMetaLead(request('v2'),id)).state,'sent');assert.equal(JSON.parse(String(calls[1].options.body)).test_event_code,'TEST_FIXTURE');
  globalThis.fetch=async()=>Response.json({error:{code:190,message:'do not log response content'}},{status:400});assert.equal((await sendMetaLead(request('v2'),id)).state,'failed');
  globalThis.fetch=async()=>{throw new Error('fixture network failure');};assert.equal((await sendMetaLead(request('v2'),id)).state,'failed');
 }finally{globalThis.fetch=native;for(const key of Object.keys(process.env))if(!(key in before))delete process.env[key];Object.assign(process.env,before);}
});
