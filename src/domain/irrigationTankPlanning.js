export const MAX_IRRIGATION_TANK_CAPACITY_LITERS=1000
export const MAX_IRRIGATION_APPLICATIONS_PER_DAY=10000
export const MAX_IRRIGATION_PREPARATIONS_PER_PLAN=10000

const text=value=>String(value??'').trim()
const positive=(value,label)=>{const number=Number(value);if(!Number.isFinite(number)||number<=0)throw new Error(`${label} debe ser mayor que cero.`);return number}
const nonNegative=(value,label)=>{const number=Number(value);if(!Number.isFinite(number)||number<0)throw new Error(`${label} no puede ser negativo.`);return number}
const stable=value=>Number(Number(value).toFixed(9))

export function irrigationApplicationCount(value){
 const count=positive(value,'applicationsPerDay')
 if(!Number.isSafeInteger(count))throw new Error('applicationsPerDay debe ser un entero positivo seguro.')
 if(count>MAX_IRRIGATION_APPLICATIONS_PER_DAY)throw new Error(`applicationsPerDay no puede superar ${MAX_IRRIGATION_APPLICATIONS_PER_DAY}.`)
 return count
}

export function irrigationTankCapacityLiters(value=MAX_IRRIGATION_TANK_CAPACITY_LITERS){
 const capacity=positive(value,'tankCapacityLiters')
 if(capacity>MAX_IRRIGATION_TANK_CAPACITY_LITERS)throw new Error(`tankCapacityLiters no puede superar ${MAX_IRRIGATION_TANK_CAPACITY_LITERS} L.`)
 return capacity
}

export function scaleFertigationQuantity(quantity,{formulaVolumeLiters,preparationVolumeLiters}={}){
 const amount=positive(quantity,'La cantidad de fórmula'),formulaVolume=positive(formulaVolumeLiters,'formulaVolumeLiters'),preparationVolume=irrigationTankCapacityLiters(preparationVolumeLiters)
 return stable(amount*preparationVolume/formulaVolume)
}

export function planIrrigationTankLoads({planId='',pulseVolumeLiters,applicationsPerDay,tankCapacityLiters=MAX_IRRIGATION_TANK_CAPACITY_LITERS}={}){
 const id=text(planId),pulse=stable(nonNegative(pulseVolumeLiters,'pulseVolumeLiters')),applications=irrigationApplicationCount(applicationsPerDay),capacity=irrigationTankCapacityLiters(tankCapacityLiters)
 const preparationsPerApplication=pulse?Math.ceil(pulse/capacity):0,loadSchedule=[]
 const preparationCount=preparationsPerApplication*applications
 if(!Number.isSafeInteger(preparationCount)||preparationCount>MAX_IRRIGATION_PREPARATIONS_PER_PLAN)throw new Error(`El plan no puede superar ${MAX_IRRIGATION_PREPARATIONS_PER_PLAN} preparaciones.`)
 let sequence=0
 for(let applicationSequence=1;applicationSequence<=applications;applicationSequence+=1){
  let remaining=pulse
  for(let loadSequence=1;loadSequence<=preparationsPerApplication;loadSequence+=1){
   const volumeLiters=stable(Math.min(capacity,remaining));remaining=stable(remaining-volumeLiters);sequence+=1
   loadSchedule.push(Object.freeze({id:id?`${id}:application:${applicationSequence}:load:${loadSequence}`:`application:${applicationSequence}:load:${loadSequence}`,sequence,applicationSequence,loadSequence,volumeLiters,tankCapacityLiters:capacity,status:'PLANNED'}))
  }
 }
 const dailyVolumeLiters=stable(pulse*applications),scheduledVolume=stable(loadSchedule.reduce((sum,item)=>sum+item.volumeLiters,0))
 if(Math.abs(scheduledVolume-dailyVolumeLiters)>1e-6)throw new Error('El plan de cargas no conserva el volumen diario.')
 const preparationFrequency=Object.freeze({basis:'PER_APPLICATION',applicationsPerDay:applications,preparationsPerApplication,preparationsPerDay:loadSchedule.length})
 return Object.freeze({tankCapacityLiters:capacity,applicationCount:applications,pulseVolumeLiters:pulse,dailyVolumeLiters,preparationsPerApplication,preparationCount:loadSchedule.length,preparationFrequency,lastLoadVolumeLiters:loadSchedule.at(-1)?.volumeLiters||0,loadSchedule:Object.freeze(loadSchedule)})
}
