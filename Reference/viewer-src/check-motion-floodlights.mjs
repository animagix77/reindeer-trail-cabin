import assert from 'node:assert/strict';
import test from 'node:test';
import {Scene,Group} from 'three';
import {addFloodlightFixtures} from './motion-floodlights.js';
import {installCafeLights} from './cafe-lights.js';

test('the exterior floodlight housings stay unlit',()=>{
  const scene=new Scene();
  addFloodlightFixtures(scene);
  for(const location of ['Front entry','Rear deck']){
    const fixture=scene.getObjectByName(location+' · twin motion floodlight');
    assert(fixture?.children.some(part=>part.isMesh));
  }
  scene.traverse(part=>{
    assert(!part.isLight);
    if(part.isMesh)assert.equal(part.material.emissive.getHex(),0);
  });
});
test('café lights cast steady pools on the deck, pergola and picnic area after dark',()=>{
  const scene=new Scene(), model=new Group();
  for(const name of ['Deck','Pergola','Picnic']){
    const marker=new Group();marker.name='FestoonPool_'+name;marker.position.y=3;model.add(marker);
  }
  const lighting=installCafeLights(scene,model), lamps=scene.children.filter(x=>x.isPointLight);
  assert.equal(lamps.length,3);
  lighting.set(0);
  for(const lamp of lamps){
    assert(lamp.intensity>=28 && lamp.distance>=8);
    assert(lamp.position.y>0 && lamp.position.y<3);
    assert.equal(lamp.castShadow,false);
  }
  lighting.set(1);
  assert(lamps.every(lamp=>lamp.intensity<.5));
});
