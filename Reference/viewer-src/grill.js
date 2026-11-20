import * as T from 'three';
import {makeMeal} from './grill-food.js';
import {cookingSmoke} from './grill-smoke.js';

const recipes={steak:8,chicken:10,vegetables:6};
export function installGrill(scene,model,onChange){
  const hinge=model.getObjectByName('GrillLidHinge');
  const center=model.getObjectByName('GrillSurface')?.getWorldPosition(new T.Vector3());
  if(!hinge || !center)return null;
  const width=model.getObjectByName('GrillWidthAxis').getWorldPosition(new T.Vector3()).sub(center).normalize();
  const up=new T.Vector3(0,1,0);
  const station=new T.Group();
  station.position.copy(center);
  station.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(width,up,width.clone().cross(up)));
  scene.add(station);
  const shaft=width.clone().applyQuaternion(hinge.parent.getWorldQuaternion(new T.Quaternion()).invert());
  const rest=hinge.quaternion.clone();
  const smoke=cookingSmoke();station.add(smoke.volume);
  const jets=new T.InstancedMesh(new T.ConeGeometry(.008,.026,7),
    new T.MeshBasicMaterial({color:'#87bffe',transparent:true,opacity:.78,depthWrite:false}),40);
  const pose=new T.Object3D();
  for(let i=0;i<40;i++){
    pose.position.set(-.24+.16*(i%4),-.061,-.17+.037*Math.floor(i/4));
    pose.updateMatrix();jets.setMatrixAt(i,pose.matrix);
  }
  jets.visible=false;station.add(jets);
  const dishProfile=[[0,0],[.083,0],[.133,.013],[.142,.018],[.141,.021],[.132,.020],[.081,.007],[0,.007]];
  const plate=new T.Mesh(new T.LatheGeometry(dishProfile.map(([r,h])=>new T.Vector2(r,h)),64),
    new T.MeshPhysicalMaterial({color:'#eee6d6',roughness:.30,clearcoat:.38,side:T.DoubleSide}));
  plate.position.set(.516,-.011,0);station.add(plate);
  let lit=false,opened=false,near=false,food=null,served=null,kind=null,lastServed=null;
  let turns=0,done=[0,0],turning=null,previousTime=null,angle=0,signature='';
  function snapshot(){
    const ready=!!food && done.every(n=>n>=1);
    const current=turns%2;
    let message=lit?'Choose something to cook.':'Light the burners to cook.';
    if(lastServed && !food)message='Served '+lastServed+' on the side shelf.';
    if(food)message=ready?'Both sides are browned. Ready to serve.':!lit?'Burners off. Cooking is paused.':
      done[current]>=1?'This side is browned. Flip to cook the other side.':'Searing '+kind+' · '+Math.min(100,Math.floor(done[current]*10)*10)+'% on this side';
    const state={near,lit,busy:!!food,turning:turning!==null,ready,message};
    const key=JSON.stringify(state);
    if(key!==signature){signature=key;onChange(state);}
  }
  function placeFood(){
    if(!food)return;
    const u=turning===null?1:T.MathUtils.clamp(turning/.60,0,1);
    const eased=u*u*(3-2*u);
    food.group.rotation.x=Math.PI*(turns+(turning===null?0:eased));
    food.group.position.set(0,food.halfHeight+.002+(turning===null?0:Math.sin(u*Math.PI)*.12),-.012);
    food.shade(done[0],done[1]);
  }
  function add(type){
    if(!near || food || !lit || !Object.hasOwn(recipes,type))return;
    kind=type;lastServed=null;food=makeMeal(kind);done=[0,0];turns=0;turning=null;
    station.add(food.group);placeFood();snapshot();
  }
  function flip(){
    if(!near || !food || turning!==null)return;
    turning=0;snapshot();
  }
  function serve(){
    if(!near || !food || turning!==null || !done.every(n=>n>=1))return;
    served?.dispose();served=food;food=null;
    served.group.position.copy(plate.position);served.group.position.y+=.008+served.halfHeight;
    lastServed=kind;snapshot();
  }
  function update(camera,mode,seconds){
    const elapsed=previousTime===null?0:Math.max(0,seconds-previousTime);previousTime=seconds;
    near=mode!=='property' && camera.position.distanceToSquared(center)<8.4 && Math.abs(camera.position.y-center.y)<1.35;
    if(!near)opened=false;
    let target=opened || food || lit ? Math.PI*.55:0;
    angle=T.MathUtils.damp(angle,target,8,Math.min(.15,elapsed));
    hinge.quaternion.setFromAxisAngle(shaft,angle).multiply(rest);
    if(food){
      if(turning!==null){turning+=elapsed;if(turning>=.60){turns++;turning=null;}}
      else if(lit)done[turns%2]=Math.min(1,done[turns%2]+elapsed/recipes[kind]);
      placeFood();
    }
    const visible=mode!=='property' && camera.position.distanceToSquared(center)<90;
    jets.visible=lit && visible;
    smoke.update(camera,seconds,visible && lit && food ? .72:0);
    snapshot();
    return (visible && (Math.abs(target-angle)>.002 || lit)) || turning!==null || (lit && food && done[turns%2]<1);
  }
  return {add,flip,serve,update,open(value){opened=value;},light(){if(near){lit=!lit;snapshot();}}};
}
