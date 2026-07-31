const FACTORS={p2o5:0.4364,k2o:0.8301,cao:0.7147,mgo:0.6030,so3:0.4005}
const keys=['n','p','k','ca','mg','s']
const num=v=>Number(v||0)

export function normalizedComposition(p){
 const purity=Math.max(0,Math.min(100,num(p.purity||100)))/100
 return{
  n:(num(p.nNo3)+num(p.nNh4)+num(p.nUrea))*purity,
  p:num(p.p2o5)*FACTORS.p2o5*purity,
  k:num(p.k2o)*FACTORS.k2o*purity,
  ca:(num(p.ca)+num(p.cao)*FACTORS.cao)*purity,
  mg:(num(p.mg)+num(p.mgo)*FACTORS.mgo)*purity,
  s:(num(p.s)+num(p.so3)*FACTORS.so3)*purity
 }
}
export function netTargets(objective,water){
 return Object.fromEntries(keys.map(k=>[k,Math.max(0,num(objective?.[k])-num(water?.[k]))]))
}
export function contributions(product,grams,volumeL){
 const c=normalizedComposition(product),g=num(grams),v=Math.max(1,num(volumeL))
 return Object.fromEntries(keys.map(k=>[k,(g*(c[k]/100)*1000)/v]))
}
export function validateFormula(products,items,targets,volumeL){
 const totals=Object.fromEntries(keys.map(k=>[k,0]));const warnings=[]
 for(const item of items){
  const p=products.find(x=>x.id===item.productId);if(!p)continue
  const c=contributions(p,item.grams,volumeL);keys.forEach(k=>totals[k]+=c[k])
  const maxSol=num(p.solubility)
  if(maxSol>0&&num(item.grams)>maxSol*num(volumeL))warnings.push(`${p.name}: supera la solubilidad declarada.`)
  if((p.tank==='A'&&(num(p.p2o5)>0||num(p.s)>0||num(p.so3)>0))&&(num(p.ca)>0||num(p.cao)>0))warnings.push(`${p.name}: revisar calcio con fosfatos/sulfatos en el mismo concentrado.`)
 }
 const deviations=Object.fromEntries(keys.map(k=>[k,targets[k]?((totals[k]-targets[k])/targets[k])*100:0]))
 keys.forEach(k=>{if(targets[k]>0&&Math.abs(deviations[k])>15)warnings.push(`${k.toUpperCase()}: desviación ${deviations[k].toFixed(1)}% frente al objetivo neto.`)})
 return{totals,deviations,warnings,valid:warnings.length===0}
}
export function calculateSimpleFormula(products,targets,volumeL){
 const active=products.filter(x=>x.active!==false)
 return active.map(p=>{
  const c=normalizedComposition(p),score=keys.reduce((s,k)=>s+c[k],0)
  if(score<=0)return null
  const targetSum=keys.reduce((s,k)=>s+num(targets[k]),0)
  const grams=(targetSum*num(volumeL))/(score*10*Math.max(1,active.length))
  return{productId:p.id,tank:p.tank||'A',grams:Number(grams.toFixed(2)),estimatedCost:Number((grams*num(p.cost)/1000).toFixed(2))}
 }).filter(Boolean)
}
