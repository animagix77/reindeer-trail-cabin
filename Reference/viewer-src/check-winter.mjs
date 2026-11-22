import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {installSnowpack} from './snowpack.js';
import {groundFinish} from './footsteps.js';
import {surface} from './lake-terrain.js';

test('snow grows, moves aside, refills and melts on a sloped outdoor surface',()=>{
  const scene=new T.Scene(),model=new T.Group();
  const parcel=new T.Mesh(new T.PlaneGeometry(10,10).rotateX(-Math.PI/2));
  parcel.name='WalkSurface_ParcelGround';model.add(parcel);
  const space={heights:(x,z)=>[{y:x*.1,label:z>2?'WalkSurface_MainFloor':'WalkSurface_ParcelGround'}]};
  const roof={coverMap:{value:{image:{data:new Uint8Array([0]),width:1,height:1}}},
    coverUV:{value:new T.Vector4(0,0,1,1)},coverY:{value:new T.Vector2(0,10)}};
  const pack=installSnowpack(scene,model,space,roof);
  let time=0;
  for(;time<40;time++)pack.update('snow',time);
  assert.equal(pack.at(0,3,0),0);
  assert.ok(pack.at(0,0,0)>.09);
  const hit=pack.hit(new T.Ray(new T.Vector3(0,1,0),new T.Vector3(0,-1,0)));
  assert.ok(hit);
  assert.ok(pack.scoop(hit.point,new T.Vector3(0,0,-1)));
  assert.ok(pack.at(0,0,0)<.001);
  assert.ok(pack.at(.86,0,.086)>.11);
  for(;time<125;time++)pack.update('snow',time);
  assert.ok(Math.abs(pack.at(0,0,0)-.18)<1e-6);
  for(;time<255;time++)pack.update('rain',time);
  assert.equal(pack.at(0,0,0),0);
  assert.equal(pack.melting,false);
});
test('walking finishes reflect the visible material',()=>{
  for(const [name,kind] of [['Cool-season fescue','grass'],['Leaf litter and low cover','leaves'],
    ['Entry · blue-gray crushed stone','gravel'],['Front motor court · weathered asphalt','pavement'],
    ['Charcoal gray tile','tile']])assert.equal(groundFinish(name),kind);
});
test('run follows measured grade to the beach with a level lake basin and rising far shore',()=>{
  assert.ok(Math.abs(surface(0,0)-9.29)<.05);
  assert.ok(Math.abs(surface(0,50)-2.23)<.05);
  for(const d of [90,120,180,220])assert.equal(surface(0,d),0);
  assert.ok(surface(0,280)>6);
  for(const x of [-8,0,8])for(let d=0;d<=68;d+=.5)assert.ok(surface(x,d)>.4);
});
