import test from'node:test'
import assert from'node:assert/strict'
import{calculateSimpleFormula,contributions,netTargets,normalizedComposition,solveFertigationFormula,validateFormula}from'../src/domain/formulation.js'
import{createFertigationFormula}from'../src/domain/irrigationMirfe.js'

test('M31-F005: objetivos netos descuentan todas las formas de nitrógeno del agua',()=>{
 const targets=netTargets({n:180,p:45,k:230,ca:150,mg:50,s:70},{nNo3:20,nNh4:5,p:4,k:10,ca:30,mg:5,s:7})
 assert.deepEqual(targets,{n:155,p:41,k:220,ca:120,mg:45,s:63})
})

test('M31-F005: composición normaliza óxidos y pureza antes de aportar ppm',()=>{
 const composition=normalizedComposition({purity:50,nNo3:20,p2o5:20,k2o:20,cao:20,mgo:20,so3:20})
 assert.equal(composition.n,10)
 assert.equal(composition.p,4.364)
 assert.equal(composition.k,8.301)
 const ppm=contributions({nNo3:10},1000,1000)
 assert.equal(ppm.n,100)
 assert.deepEqual(normalizedComposition({analysis:{n:15.5,p:4,k:20,ca:19,mg:2,s:1}}),{n:15.5,p:4,k:20,ca:19,mg:2,s:1})
})

test('M31-F005: solver matricial resuelve cada nutriente por composición, no por suma global',()=>{
 const products=[{id:'n',name:'N',tank:'A',nNo3:20,cost:1000},{id:'k',name:'K',tank:'B',k2o:10/0.8301,cost:2000}]
 const items=solveFertigationFormula(products,{n:100,p:0,k:100,ca:0,mg:0,s:0},1000)
 assert.deepEqual(items.map(item=>item.productId),['n','k'])
 assert.ok(Math.abs(items[0].grams-500)<0.02)
 assert.ok(Math.abs(items[1].grams-1000)<0.02)
 const validation=validateFormula(products,items,{n:100,p:0,k:100,ca:0,mg:0,s:0},1000)
 assert.equal(validation.valid,true)
 assert.equal(calculateSimpleFormula(products,{n:100,k:100},1000)[0].grams,items[0].grams)
})

test('M31-F005: solver penaliza aportes sin objetivo y elige una alternativa limpia',()=>{
 const products=[{id:'mixed',name:'N + Ca',tank:'A',nNo3:20,ca:20},{id:'pure',name:'N',tank:'B',nNo3:20}]
 const items=solveFertigationFormula(products,{n:100},1000)
 assert.deepEqual(items,[{productId:'pure',tank:'B',grams:500,estimatedCost:0}])
 assert.equal(validateFormula(products,items,{n:100},1000).valid,true)
})

test('M31-F005: solubilidad limita el solver y la desviación pendiente impide validar',()=>{
 const products=[{id:'n',name:'N limitado',tank:'A',nNo3:10,solubility:0.5}]
 const items=solveFertigationFormula(products,{n:100},1000)
 assert.equal(items[0].grams,500)
 const validation=validateFormula(products,items,{n:100},1000)
 assert.equal(validation.valid,false)
 assert.match(validation.warnings.join(' '),/N: desviación -50\.0%/)
})

test('M31-F005: compatibilidad calcio-fosfato dentro del mismo tanque invalida la fórmula',()=>{
 const products=[{id:'ca',name:'Calcio',tank:'A',ca:20},{id:'p',name:'Fosfato',tank:'A',p2o5:20/0.4364}]
 const items=[{productId:'ca',tank:'A',grams:500},{productId:'p',tank:'A',grams:500}]
 const validation=validateFormula(products,items,{n:0,p:100,k:0,ca:100,mg:0,s:0},1000)
 assert.equal(validation.valid,false)
 assert.match(validation.warnings.join(' '),/separar calcio de fosfatos o sulfatos/)
})

test('M31-F005: referencias ausentes, duplicados y cantidades no positivas fallan la validación',()=>{
 const products=[{id:'n',name:'N',tank:'A',nNo3:10}]
 const validation=validateFormula(products,[{productId:'missing',tank:'A',grams:10},{productId:'n',tank:'A',grams:0},{productId:'n',tank:'A',grams:10},{productId:'n',tank:'A',grams:10}],{n:1},1000)
 assert.equal(validation.valid,false)
 assert.match(validation.warnings.join(' '),/no existe/)
 assert.match(validation.warnings.join(' '),/repite/)
 assert.match(validation.warnings.join(' '),/mayor que cero/)
})

test('M31-F005: la entidad canónica no admite estado aprobado con validación advertida',()=>{
 const base={id:'formula-1',organizationId:'org-a',siteId:'site-a',name:'Vegetativo',stage:'Vegetativo',geneticId:'g-1',volumeLiters:1000,items:[{productId:'n',tank:'A',grams:1000}],createdAt:'2026-08-16T13:00:00.000Z'}
 assert.throws(()=>createFertigationFormula({...base,status:'Aprobada',validation:{valid:false,warnings:['N fuera de rango']}}),/solo puede aprobarse/)
 const approved=createFertigationFormula({...base,status:'Aprobada',validation:{valid:true,warnings:[]},approvedBy:'Ana'})
 assert.equal(approved.approvedAt,'2026-08-16T13:00:00.000Z')
 assert.equal(Object.isFrozen(approved.validation),true)
})
