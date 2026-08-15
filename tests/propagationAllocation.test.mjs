import test from'node:test'
import assert from'node:assert/strict'
import{allocateUnitsToBank,availableBankPositions,bankOccupancy,bankTrayPositions}from'../src/domain/propagationAllocation.js'

const bank={id:'bank-1',name:'Banco 1',trays:[{id:'tray-a',quantity:2,cellsPerTray:3},{id:'tray-b',quantity:1,cellsPerTray:2}]}

test('expande tipos de bandeja a posiciones físicas únicas',()=>{
 const positions=bankTrayPositions(bank)
 assert.equal(positions.length,8)
 assert.deepEqual(positions[0],{bankId:'bank-1',trayId:'tray-a',trayIndex:1,traySlot:1})
 assert.deepEqual(positions[7],{bankId:'bank-1',trayId:'tray-b',trayIndex:1,traySlot:2})
})

test('omite posiciones ocupadas por esquejes activos',()=>{
 const units=[{bankId:'bank-1',trayId:'tray-a',trayIndex:1,traySlot:1,status:'Cortado'},{bankId:'bank-1',trayId:'tray-a',trayIndex:1,traySlot:2,status:'Descartado'}]
 const available=availableBankPositions(bank,units)
 assert.equal(available.length,7)
 assert.equal(available.some(position=>position.traySlot===1&&position.trayIndex===1&&position.trayId==='tray-a'),false)
})

test('asigna esquejes secuencialmente y bloquea sobrecapacidad',()=>{
 const units=[{id:'u1'},{id:'u2'}]
 const allocated=allocateUnitsToBank(units,bank,[])
 assert.equal(allocated[0].bankId,'bank-1')
 assert.equal(allocated[1].traySlot,2)
 assert.throws(()=>allocateUnitsToBank(Array.from({length:9},(_,index)=>({id:String(index)})),bank,[]),/solo tiene 8 posiciones libres/)
})

test('calcula capacidad, ocupación y disponibilidad reales',()=>{
 const metrics=bankOccupancy(bank,[{bankId:'bank-1',status:'Cortado'},{bankId:'bank-1',status:'Muerto'},{bankId:'otro',status:'Cortado'}])
 assert.deepEqual(metrics,{capacity:8,occupied:1,available:7,percent:12.5})
})
