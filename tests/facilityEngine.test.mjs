import test from'node:test'
import assert from'node:assert/strict'
import{CONTAINER_TYPES,FACILITY_TYPES,createProductionPositions,defaultContainerProfile,facilityCapacitySummary,facilityChildren,facilityGraphFromState,facilityNode}from'../src/domain/facilityEngine.js'

const state={sites:[{id:'s1',name:'Villa de Leyva'}],facilityAreas:[{id:'a1',siteId:'s1',name:'Producción'}],houses:[{id:'h1',siteId:'s1',areaId:'a1',name:'Nave 2',dimensionUnit:'m',length:30,width:12}],facilityZones:[{id:'z1',siteId:'s1',houseId:'h1',name:'Parte baja'}],beds:[{id:'b1',houseId:'h1',zoneId:'z1',name:'Cama 1',rows:12,plantsPerRow:13,activePlants:156}],propagationBanks:[{id:'pb1',siteId:'s1',name:'Banco 1',trays:[{id:'t1',label:'Bandeja 30',quantity:4,cellsPerTray:30,usesPlug:true,plugType:'Jiffy'}]}]}

test('proyecta sede área nave zona cama banco y bandeja sin migrar colecciones',()=>{const graph=facilityGraphFromState(state);assert.ok(facilityNode(graph,FACILITY_TYPES.SITE,'s1'));assert.equal(facilityNode(graph,FACILITY_TYPES.HOUSE,'h1').parentId,'AREA:a1');assert.equal(facilityNode(graph,FACILITY_TYPES.BED,'b1').parentId,'ZONE:z1');assert.equal(facilityNode(graph,FACILITY_TYPES.BANK,'pb1').capacity,120);assert.equal(graph.find(x=>x.type===FACILITY_TYPES.TRAY).plugType,'Jiffy')})

test('calcula capacidades productivas y de propagación',()=>{assert.deepEqual(facilityCapacitySummary(state),{sites:1,houses:1,beds:1,banks:1,productionCapacity:156,propagationCapacity:120})})

test('expone hijos jerárquicos',()=>{const graph=facilityGraphFromState(state);assert.equal(facilityChildren(graph,'HOUSE:h1')[0].type,FACILITY_TYPES.ZONE)})

test('crea posiciones productivas con matera de 10 litros configurable',()=>{const positions=createProductionPositions({bedId:'b1',rows:2,plantsPerRow:3});assert.equal(positions.length,6);assert.equal(positions[0].containerType,CONTAINER_TYPES.POT);assert.equal(positions[0].volumeLiters,10);assert.equal(positions[5].id,'b1-F2-P3')})

test('crea perfil predeterminado de contenedor sin fijarlo globalmente',()=>{const profile=defaultContainerProfile();assert.equal(profile.volumeLiters,10);assert.equal(profile.plantsPerContainer,1);assert.equal(profile.type,CONTAINER_TYPES.POT);assert.ok(Object.isFrozen(profile))})
