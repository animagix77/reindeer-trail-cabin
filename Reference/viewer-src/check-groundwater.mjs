import test from 'node:test';
import assert from 'node:assert/strict';
import {readGroundwater} from './groundwater.js';

const observation={
  monitoring_location_id:'USGS-414525074360601',parameter_code:'72019',statistic_id:'00011',
  time:'2026-11-20T19:15:00+00:00',value:'9.39',unit_of_measure:'ft',approval_status:'Provisional'
};
const feature=overrides=>({properties:{...observation,...overrides}});

test('Woodbourne depth uses the newest valid instantaneous reading and its observation time',async t=>{
  const data={features:[feature({}),feature({time:'2026-11-20T18:15:00Z',value:'8.61'}),
    feature({monitoring_location_id:'another station'}),feature({unit_of_measure:'m'}),
    feature({time:'2026-11-21T01:00:00Z',value:13}),feature({value:null})]};
  t.mock.method(Date,'now',()=>Date.parse('2026-11-20T20:00:00Z'));
  t.mock.method(globalThis,'fetch',async url=>{
    assert.equal(new URL(url).searchParams.get('parameter_code'),'72019');
    return Response.json(data);
  });
  assert.deepEqual(await readGroundwater(),{
    feet:9.39,observedAt:'2026-11-20T19:15:00.000Z',provisional:true,stale:false
  });
  data.features=[feature({time:'2026-11-18T18:15:00Z',value:'0',approval_status:'Approved'})];
  const old=await readGroundwater();
  assert.equal(old.stale,true);assert.equal(old.feet,0);assert.equal(old.provisional,false);
});

test('absent observations and failed requests produce an unavailable state',async t=>{
  const bad=[{value:-999999},{value:''},{value:'Ice'},{parameter_code:'62611'},
    {monitoring_location_id:'another site'},{unit_of_measure:'m'},{statistic_id:'00003'},
    {time:'2026-11-20T17:15:00'},{time:'wrong date'}].map(feature);
  t.mock.method(globalThis,'fetch',async()=>Response.json({features:bad}));
  await assert.rejects(readGroundwater(),/no usable reading/);
  globalThis.fetch=async()=>new Response(null,{status:503});
  await assert.rejects(readGroundwater(),/unavailable/);
});
