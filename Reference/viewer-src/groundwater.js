// USGS parameter 72019 measures depth below the ground at the observation well.
const site='USGS-414525074360601';
export const wellSource='https://waterdata.usgs.gov/monitoring-location/'+site+'/';
const endpoint='https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items'
  +'?f=json&monitoring_location_id='+site+'&parameter_code=72019&limit=20';

export async function readGroundwater({signal=AbortSignal.timeout(10000)}={}){
  const response=await fetch(endpoint,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('The USGS observation well is unavailable.');
  const data=await response.json(),now=Date.now();
  let latest=null;
  for(const feature of data.features??[]){
    const sample=feature?.properties;
    if(sample?.monitoring_location_id!==site || sample.parameter_code!=='72019' ||
       sample.unit_of_measure!=='ft' || sample.statistic_id!=='00011')continue;
    const raw=sample.value;
    if(typeof raw!=='number' && (typeof raw!=='string' || !raw.trim()))continue;
    const feet=Number(raw),time=Date.parse(sample.time);
    if(!Number.isFinite(feet) || feet===-999999 || !Number.isFinite(time) || time>now ||
       !/(?:Z|[+-]\d{2}:\d{2})$/i.test(sample.time))continue;
    if(!latest || time>latest.time)latest={feet,time,provisional:sample.approval_status==='Provisional'};
  }
  if(!latest)throw Error('USGS has no usable reading for this well.');
  return {
    feet:latest.feet,observedAt:new Date(latest.time).toISOString(),provisional:latest.provisional,
    stale:now-latest.time>=24*60*60*1000
  };
}
