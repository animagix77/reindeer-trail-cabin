export const tourAreas={
  outside:{label:'Driveway',slug:'driveway',aliases:['property','well','well-casing','splitting','wood-splitting']},
  entry:{label:'Front of house',slug:'front-of-house',aliases:['front-entry','path','front-path']},
  yard:{label:'Back yard',slug:'back-yard',aliases:['fire-pit','porch','covered-porch','grill','deck-grill',
    'cook','grilling','wood','woodpile','deer','backyard-deer','stars','stargazing']},
  hall:{label:'Inside',slug:'inside',aliases:['front-hall','frontbed','front-bedroom','master','master-and-bath',
    'bath','bathroom','primary','master-bedroom','vault','kitchen-vault','kitchenwork','island-cooler','kitchen',
    'living','living-room','bunk','bunk-room','loft','tree','christmas-tree','hearth','propane-furnace']}
};

export function areaFor(name){
  return Object.keys(tourAreas).find(key=>key===name || tourAreas[key].slug===name || tourAreas[key].aliases.includes(name));
}
