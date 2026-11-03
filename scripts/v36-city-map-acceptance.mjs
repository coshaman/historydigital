import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const json = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const [registry, sources, mapFiles, cardFiles] = await Promise.all([
  json('rpg/data/city-districts-v36.json'), json('docs/v36/historical-map-source-register.json'),
  readdir(path.join(root,'rpg/maps')), readdir(path.join(root,'rpg/characters')),
]);
const maps = Object.fromEntries(await Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(async file => { const map=await json(`rpg/maps/${file}`); return [map.mapId,map]; })));
const cards = await Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
const questFiles = await readdir(path.join(root,'rpg/quests'));
const questIds = new Set(await Promise.all(questFiles.filter(file => file.endsWith('.json')).map(async file => (await json(`rpg/quests/${file}`)).id)));
const cardById = new Map(cards.map(card => [card.id,card]));
const sourceById = new Map(sources.sources.map(source => [source.sourceId,source]));
const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js'); const game=globalThis.V33GameState;
const props = object => Object.fromEntries((object.properties ?? []).map(item => [item.name,item.value]));
const objects = map => map.layers.find(layer => layer.name === 'Interactions')?.objects ?? [];
const collision = map => map.layers.find(layer => layer.name === 'Collision')?.data ?? [];
const delta = (a,b) => Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const walkPath = (map,start,target,hosts,actorId) => {
  const steps=[['up',0,-1],['right',1,0],['down',0,1],['left',-1,0]], key=p=>`${p.x},${p.y}`;
  const queue=[{...start,path:[]}], seen=new Set([key(start)]);
  for(let i=0;i<queue.length;i++){
    const item=queue[i]; if(key(item)===key(target)) return item.path;
    for(const [direction,dx,dy] of steps){
      const point={x:item.x+dx,y:item.y+dy}, k=key(point);
      if(seen.has(k)||point.x<0||point.y<0||point.x>=map.width||point.y>=map.height)continue;
      if(collision(map)[point.y*map.width+point.x]!==0||!game.canOccupy(map,point.x,point.y,actorId,hosts))continue;
      seen.add(k);queue.push({...point,path:[...item.path,direction]});
    }
  }
  return null;
};

assert.equal(registry.districts.length,6,'six authored city districts must be playable');
const districtMapIds=new Set(registry.districts.flatMap(district=>district.mapIds));
assert.ok(districtMapIds.size>=14,'district graph must cover at least fourteen city maps');
for(const mapId of districtMapIds) assert.ok(maps[mapId],`district registry map ${mapId} must resolve`);
const cityMaps=Object.values(maps).filter(map=>!['dead-souls','overcoat'].includes(map.mapId));
for(const map of cityMaps) assert.ok(districtMapIds.has(map.mapId),`playable city map ${map.mapId} must appear in exactly one district`);
for(const map of cityMaps){
  assert.equal(registry.districts.filter(district=>district.mapIds.includes(map.mapId)).length,1,`${map.mapId} belongs to exactly one district`);
  for(const exit of objects(map).filter(item=>item.type==='map-exit')){
    const data=props(exit), target=maps[data.targetMapId];
    assert.ok(target,`${map.mapId} exit ${data.exitId} points to a loaded map`);
    const reverse=objects(target).find(item=>item.type==='map-exit'&&props(item).exitId===data.returnExitId);
    assert.ok(reverse,`${map.mapId} exit ${data.exitId} names its actual reverse door`);
    assert.equal(props(reverse).targetMapId,map.mapId,`${map.mapId} exit ${data.exitId} returns to its source map`);
  }
  for(const object of objects(map).filter(item=>item.type==='quest-object')) assert.ok(questIds.has(props(object).questId),`${map.mapId} quest marker ${object.name} resolves to a loaded quest`);
}
const interiorIds=new Set(registry.districts.flatMap(district=>district.interiorMapIds ?? []));
assert.equal(interiorIds.size,8,'eight distinct interiors must be registered');
for(const district of registry.districts){
  for(const mapId of district.mapIds) assert.ok(maps[mapId],`${district.id} references missing map ${mapId}`);
  for(const connection of district.connections){
    const from=maps[connection.fromMapId];
    assert.ok(from,`${district.id} connection begins on an absent map`);
    const exit=objects(from).find(item=>item.type==='map-exit'&&props(item).exitId===connection.exitId);
    assert.ok(exit,`${connection.exitId} must be a physical door object`);
    const data=props(exit), target=maps[connection.toMapId];
    assert.equal(data.targetMapId,connection.toMapId,`${connection.exitId} target must match registry`);
    assert.ok(target,`${connection.exitId} target map missing`);
    const reverse=objects(target).find(item=>item.type==='map-exit'&&props(item).exitId===data.returnExitId);
    assert.ok(reverse,`${connection.exitId} needs a reciprocal exit`);
    assert.equal(props(reverse).targetMapId,from.mapId,`${connection.exitId} reverse door returns to source`);
  }
}
for(const id of interiorIds){
  const map=maps[id], access=map?.metadata?.access;
  assert.ok(map&&access,`${id} must be a real enterable map with access metadata`);
  assert.ok(access.doorId&&access.districtId&&access.subLocationId&&Array.isArray(access.sourceEvidenceIds)&&access.reconstructionBasis,'interior needs door, district, provenance, and reconstruction metadata');
  assert.ok(access.allowedEstates?.length&&access.allowedCharacterIds?.length,'interior access must be role and character constrained');
  assert.ok(Number.isInteger(access.opensMinute)&&Number.isInteger(access.closesMinute),'interior needs operational hours');
  for(const sourceId of access.sourceEvidenceIds) assert.ok(sourceById.has(sourceId),`${id} source ${sourceId} resolves`);
  assert.equal(collision(map)[map.metadata.observerStart.y*map.width+map.metadata.observerStart.x],0,`${id} arrival is walkable`);
}

const doorCases=[
  ['nevsky','nevsky-bookshop-lane','bookseller_lev'],['market-quay','market-canal-road','carter_roman'],['courtyard','courtyard-workyard','seamstress_anna'],
  ['bookshop-lane','bookshop-lane-bookshop','bookseller_lev'],
  ['market-quay','market-bakery','baker_fyodor'],
  ['nevsky','nevsky-printshop-door','printer_ekaterina'],['nevsky','nevsky-chancery-door','clerk_alexei'],['nevsky','nevsky-police-door','police_sergeant_ivan'],
  ['courtyard','courtyard-inn','innkeeper_irina'],['workyard','workyard-sewing','seamstress_anna'],
  ['workyard','workyard-communal','yardkeeper_semyon'],
];
let physicallyEntered=0, physicallyExited=0;
for(const [outsideId,exitId,hostId] of doorCases){
  const card=cardById.get(hostId), state=game.createInitialState({maps,hostCards:cards,startMapId:outsideId});
  state.world.currentMapId=outsideId; state.player.embodiment=hostId;
  state.player.position={...maps[outsideId].metadata.observerStart};
  state.hosts[hostId].mapId=outsideId; state.hosts[hostId].position={...state.player.position};
  const outside=maps[outsideId], exit=objects(outside).find(item=>item.type==='map-exit'&&props(item).exitId===exitId), target=maps[props(exit).targetMapId];
  assert.ok(card.allowedMaps.includes(target.mapId),`${hostId} is allowed to travel into ${target.mapId}`);
  const targetTile={x:Math.floor(exit.x/16),y:Math.floor(exit.y/16)}, path=walkPath(outside,state.player.position,targetTile,state.hosts,hostId);
  assert.ok(path,`${outsideId} door ${exitId} is reachable by walking`);
  for(const direction of path){const moved=game.moveActor(state,direction,outside,maps);assert.equal(moved.moved,true,`${exitId} walking path stays open`);Object.assign(state,moved.state);}
  const entered=game.transitionMap(state,exitId,maps);
  assert.equal(entered.ok,true,`${exitId} enter: ${entered.reason}`); physicallyEntered++;
  const inside=maps[entered.state.world.currentMapId], back=objects(inside).find(item=>item.type==='map-exit'&&props(item).targetMapId===outsideId);
  assert.ok(back,`${inside.mapId} has a return door`);
  const backTile={x:Math.floor(back.x/16),y:Math.floor(back.y/16)}, backPath=walkPath(inside,entered.state.player.position,backTile,entered.state.hosts,hostId);
  assert.ok(backPath,`${inside.mapId} return door is reachable by walking`);
  let returnedState=entered.state;
  for(const direction of backPath){const moved=game.moveActor(returnedState,direction,inside,maps);assert.equal(moved.moved,true,`${inside.mapId} return route remains walkable`);returnedState=moved.state;}
  const exited=game.transitionMap(returnedState,props(back).exitId,maps);
  assert.equal(exited.ok,true,`${inside.mapId} exit: ${exited.reason}`); assert.equal(exited.state.world.currentMapId,outsideId); physicallyExited++;
}

const meaningfulInteractions=cityMaps.flatMap(map=>objects(map).filter(object=>{
  if(object.type==='quest-object') return questIds.has(props(object).questId);
  if(object.type==='inspectable') return typeof props(object).storyTextKo==='string'&&props(object).storyTextKo.trim().length>=24;
  if(object.type==='source') return typeof props(object).sourceId==='string'&&props(object).sourceId.length>0;
  if(object.type==='clue') return typeof props(object).evidenceId==='string'&&props(object).evidenceId.length>0;
  return Boolean(props(object).serviceId||props(object).interactionId);
}));
assert.ok(meaningfulInteractions.length>=70,`at least 70 city interactions need a resolvable quest, cited source, clue, service, or authored inspection; found ${meaningfulInteractions.length}`);

const roomDoor=objects(maps['bookshop-lane']).find(item=>item.type==='map-exit'&&props(item).targetMapId==='bookshop-interior');
const denied=game.createInitialState({maps,hostCards:cards,startMapId:'bookshop-lane'});
denied.player.position={x:Math.floor(roomDoor.x/16),y:Math.floor(roomDoor.y/16)}; denied.player.embodiment='clerk_alexei';
denied.hosts.clerk_alexei.mapId='bookshop-lane'; denied.hosts.clerk_alexei.position={...denied.player.position};
assert.equal(game.transitionMap(denied,props(roomDoor).exitId,maps).reason,'host_lacks_access','unlisted clerk cannot enter a private shop');
const afterHours=game.createInitialState({maps,hostCards:cards,startMapId:'bookshop-lane'});
afterHours.player.position={x:Math.floor(roomDoor.x/16),y:Math.floor(roomDoor.y/16)}; afterHours.player.embodiment='bookseller_lev';
afterHours.hosts.bookseller_lev.mapId='bookshop-lane'; afterHours.hosts.bookseller_lev.position={...afterHours.player.position}; afterHours.world.clockMinutes=1200;
assert.equal(game.transitionMap(afterHours,props(roomDoor).exitId,maps).reason,'closed_hours','shop entrance closes at the authored closing time');
console.log(JSON.stringify({status:'PASS',districts:registry.districts.length,cityMaps:districtMapIds.size,allCityMapExitsReciprocal:true,questMarkersResolve:true,enterableInteriors:interiorIds.size,physicalEntries:physicallyEntered,physicalReturns:physicallyExited,meaningfulInteractions:meaningfulInteractions.length,roleAccessDenial:true,closedHourDenial:true,sourceEvidenceVerified:true},null,2));
