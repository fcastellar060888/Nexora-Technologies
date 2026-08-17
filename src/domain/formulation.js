const FACTORS=Object.freeze({p2o5:0.4364,k2o:0.8301,cao:0.7147,mgo:0.6030,so3:0.4005})
export const FORMULATION_NUTRIENTS=Object.freeze(['n','p','k','ca','mg','s'])
export const FORMULATION_DEVIATION_LIMIT_PERCENT=15
const ZERO_TARGET_TOLERANCE_PPM=1
const num=value=>{const number=Number(value??0);return Number.isFinite(number)?number:0}
const nonNegative=value=>Math.max(0,num(value))
const positiveVolume=value=>{const number=Number(value);if(!Number.isFinite(number)||number<=0)throw new Error('volumeL debe ser mayor que cero.');return number}
const rounded=value=>Number(value.toFixed(4))

function emptyNutrients(){return Object.fromEntries(FORMULATION_NUTRIENTS.map(key=>[key,0]))}
const productField=(product,key)=>product?.[key]??product?.analysis?.[key]
const hasProductField=(product,key)=>product?.[key]!==undefined||product?.analysis?.[key]!==undefined

export function normalizedComposition(product={}){
 const purity=Math.max(0,Math.min(100,num(product.purity??100)))/100
 return{
  n:(hasProductField(product,'n')?nonNegative(productField(product,'n')):nonNegative(productField(product,'nNo3'))+nonNegative(productField(product,'nNh4'))+nonNegative(productField(product,'nUrea')))*purity,
  p:(hasProductField(product,'p')?nonNegative(productField(product,'p')):nonNegative(productField(product,'p2o5'))*FACTORS.p2o5)*purity,
  k:(hasProductField(product,'k')?nonNegative(productField(product,'k')):nonNegative(productField(product,'k2o'))*FACTORS.k2o)*purity,
  ca:(nonNegative(productField(product,'ca'))+nonNegative(productField(product,'cao'))*FACTORS.cao)*purity,
  mg:(nonNegative(productField(product,'mg'))+nonNegative(productField(product,'mgo'))*FACTORS.mgo)*purity,
  s:(nonNegative(productField(product,'s'))+nonNegative(productField(product,'so3'))*FACTORS.so3)*purity
 }
}

export function normalizedWaterComposition(water={}){
 const hasDirectNitrogen=Object.prototype.hasOwnProperty.call(water,'n')
 return{
  n:hasDirectNitrogen?nonNegative(water.n):nonNegative(water.nNo3)+nonNegative(water.nNh4)+nonNegative(water.nUrea),
  p:nonNegative(water.p),k:nonNegative(water.k),ca:nonNegative(water.ca),mg:nonNegative(water.mg),s:nonNegative(water.s)
 }
}

export function netTargets(objective={},water={}){
 const supplied=normalizedWaterComposition(water)
 return Object.fromEntries(FORMULATION_NUTRIENTS.map(key=>[key,Math.max(0,nonNegative(objective[key])-supplied[key])]))
}

export function contributions(product,grams,volumeL){
 const composition=normalizedComposition(product),mass=Number(grams),volume=positiveVolume(volumeL)
 if(!Number.isFinite(mass)||mass<0)throw new Error('grams no puede ser negativo ni no finito.')
 return Object.fromEntries(FORMULATION_NUTRIENTS.map(key=>[key,(mass*(composition[key]/100)*1000)/volume]))
}

function declaredSolubility(product){
 const value=product?.solubilityGramsPerLiter??product?.solubility
 const number=Number(value)
 return Number.isFinite(number)&&number>0?number:Infinity
}

function productDataWarnings(product){
 const warnings=[]
 const numericFields=['purity','n','nNo3','nNh4','nUrea','p','p2o5','k','k2o','ca','cao','mg','mgo','s','so3','solubility','solubilityGramsPerLiter']
 for(const field of numericFields){
  const raw=productField(product,field)
  if(raw===undefined||raw===null||raw==='')continue
  const value=Number(raw)
  if(!Number.isFinite(value)||value<0)warnings.push(`${product.name||product.id||'Producto'}: ${field} debe ser un número no negativo.`)
 }
 if(product?.purity!==undefined&&Number(product.purity)>100)warnings.push(`${product.name||product.id||'Producto'}: purity no puede superar 100%.`)
 return warnings
}

export function validateFormula(products=[],items=[],targets={},volumeL){
 const volume=positiveVolume(volumeL),totals=emptyNutrients(),warnings=[]
 const targetValues=Object.fromEntries(FORMULATION_NUTRIENTS.map(key=>[key,nonNegative(targets?.[key])]))
 const productById=new Map()
 for(const product of products||[]){
  const id=String(product?.id??'').trim();if(!id)continue
  const matches=productById.get(id)||[];matches.push(product);productById.set(id,matches)
 }
 const seenItems=new Set(),tankChemistry=new Map()
 for(const item of Array.isArray(items)?items:[]){
  const productId=String(item?.productId??'').trim(),tank=String(item?.tank??'A').trim()||'A'
  const itemKey=`${productId}:${tank}`
  if(seenItems.has(itemKey))warnings.push(`La fórmula repite ${productId||'un producto'} en el tanque ${tank}.`)
  seenItems.add(itemKey)
  const matches=productById.get(productId)||[]
  if(matches.length!==1){warnings.push(matches.length?`El producto ${productId} es ambiguo dentro de la formulación.`:`El producto ${productId||'(sin id)'} no existe en el catálogo activo.`);continue}
  const product=matches[0],grams=Number(item?.grams)
  warnings.push(...productDataWarnings(product))
  if(!Number.isFinite(grams)||grams<=0){warnings.push(`${product.name||productId}: grams debe ser mayor que cero.`);continue}
  const composition=normalizedComposition(product)
  if(FORMULATION_NUTRIENTS.every(key=>composition[key]===0)){warnings.push(`${product.name||productId}: no aporta nutrientes formulables.`);continue}
  const itemContributions=contributions(product,grams,volume)
  FORMULATION_NUTRIENTS.forEach(key=>{totals[key]+=itemContributions[key]})
  const solubility=declaredSolubility(product)
  if(Number.isFinite(solubility)&&grams>solubility*volume+1e-9)warnings.push(`${product.name||productId}: supera la solubilidad declarada.`)
  if(product.tank&&String(product.tank)!==tank)warnings.push(`${product.name||productId}: el tanque ${tank} no coincide con el tanque declarado ${product.tank}.`)
  const chemistry=tankChemistry.get(tank)||{calcium:false,phosphateOrSulfur:false}
  chemistry.calcium ||= composition.ca>0
  chemistry.phosphateOrSulfur ||= composition.p>0||composition.s>0
  tankChemistry.set(tank,chemistry)
 }
 for(const[tank,chemistry]of tankChemistry)if(chemistry.calcium&&chemistry.phosphateOrSulfur)warnings.push(`Tanque ${tank}: separar calcio de fosfatos o sulfatos para evitar precipitación.`)
 const deviations={}
 for(const key of FORMULATION_NUTRIENTS){
  totals[key]=rounded(totals[key])
  const target=targetValues[key]
  deviations[key]=target?rounded(((totals[key]-target)/target)*100):0
  if(target>0&&Math.abs(deviations[key])>FORMULATION_DEVIATION_LIMIT_PERCENT)warnings.push(`${key.toUpperCase()}: desviación ${deviations[key].toFixed(1)}% frente al objetivo neto.`)
  if(target===0&&totals[key]>ZERO_TARGET_TOLERANCE_PPM)warnings.push(`${key.toUpperCase()}: aporta ${totals[key].toFixed(1)} ppm sin objetivo neto.`)
 }
 const uniqueWarnings=[...new Set(warnings)]
 return{totals,deviations,warnings:uniqueWarnings,valid:uniqueWarnings.length===0}
}

export function solveFertigationFormula(products=[],targets={},volumeL){
 const volume=positiveVolume(volumeL)
 const targetValues=Object.fromEntries(FORMULATION_NUTRIENTS.map(key=>[key,nonNegative(targets?.[key])]))
 const requestedNutrients=FORMULATION_NUTRIENTS.filter(key=>targetValues[key]>0)
 if(!requestedNutrients.length)return[]
 const candidates=(products||[]).filter(product=>product?.active!==false&&!productDataWarnings(product).length).map(product=>({product,composition:normalizedComposition(product)})).filter(({composition})=>requestedNutrients.some(key=>composition[key]>0))
 if(!candidates.length)return[]
 const scale=Math.max(...requestedNutrients.map(key=>targetValues[key])),nutrients=FORMULATION_NUTRIENTS
 const columns=candidates.map(({product,composition})=>({
  values:nutrients.map(key=>(composition[key]*10/volume)/(targetValues[key]||scale)),
  maximum:declaredSolubility(product)*volume
 }))
 const grams=Array(candidates.length).fill(0),residual=nutrients.map(key=>targetValues[key]/(targetValues[key]||scale))
 for(let iteration=0;iteration<10000;iteration+=1){
  let largestDelta=0
  for(let columnIndex=0;columnIndex<columns.length;columnIndex+=1){
   const column=columns[columnIndex],previous=grams[columnIndex]
   for(let row=0;row<residual.length;row+=1)residual[row]+=column.values[row]*previous
   const denominator=column.values.reduce((sum,value)=>sum+value*value,0)
   const numerator=column.values.reduce((sum,value,row)=>sum+value*residual[row],0)
   const next=denominator?Math.min(column.maximum,Math.max(0,numerator/denominator)):0
   grams[columnIndex]=next
   for(let row=0;row<residual.length;row+=1)residual[row]-=column.values[row]*next
   largestDelta=Math.max(largestDelta,Math.abs(next-previous))
  }
  if(largestDelta<1e-8)break
 }
 return candidates.map(({product},index)=>({product,index})).filter(({index})=>grams[index]>0.0049).map(({product,index})=>{
  const mass=Number(grams[index].toFixed(2))
  return{productId:product.id,tank:product.tank||'A',grams:mass,estimatedCost:Number((mass*nonNegative(product.cost)/1000).toFixed(2))}
 })
}

// Alias histórico: conserva integraciones existentes, pero delega al solver matricial canónico.
export function calculateSimpleFormula(products,targets,volumeL){return solveFertigationFormula(products,targets,volumeL)}
