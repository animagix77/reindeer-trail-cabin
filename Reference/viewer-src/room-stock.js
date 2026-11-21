// Each visitor reports an increasing count of finished billets for this visit.
// Merging the same report twice is harmless, including during a host change.
export function roomStock(initial,onChange){
  let base=validCount(initial)?initial:0,total=base;
  const counts=new Map();
  function merge(id,count){
    if(typeof id!=='string'||!/^[a-z0-9_-]{1,80}$/i.test(id)||!validCount(count))return false;
    const delta=count-(counts.get(id)||0);
    if(delta<=0||!Number.isSafeInteger(total+delta))return false;
    counts.set(id,count);total+=delta;onChange?.(total);return true;
  }
  return {
    get base(){return base;},get total(){return total;},
    count:id=>counts.get(id)||0,
    merge,
    snapshot(){return Array.from(counts);},
    start(value){base=validCount(value)?value:0;counts.clear();total=base;onChange?.(total);}
  };
}
export function validCount(value){return Number.isSafeInteger(value)&&value>=0;}
