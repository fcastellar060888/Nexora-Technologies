const DAY_MS=86400000
const DATE=/^(\d{4})-(\d{2})-(\d{2})$/
const text=value=>String(value??'').trim()

function assertTimeZone(timeZone='UTC'){
 const zone=text(timeZone)||'UTC'
 try{new Intl.DateTimeFormat('en-US',{timeZone:zone}).format(new Date(0))}catch{throw new Error(`Zona horaria inválida: ${zone}`)}
 return zone
}

export function parseCivilDate(value){
 const match=DATE.exec(text(value))
 if(!match)throw new Error('La fecha civil debe usar YYYY-MM-DD.')
 const year=Number(match[1]),month=Number(match[2]),day=Number(match[3])
 const stamp=Date.UTC(year,month-1,day)
 const date=new Date(stamp)
 if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)throw new Error('La fecha civil no existe.')
 return{year,month,day,epochDay:Math.trunc(stamp/DAY_MS)}
}

export function businessDate(value=new Date(),timeZone='UTC'){
 if(typeof value==='string'&&DATE.test(value)){parseCivilDate(value);return value}
 const instant=value instanceof Date?value:new Date(value)
 if(Number.isNaN(instant.getTime()))throw new Error('Timestamp inválido.')
 const formatter=new Intl.DateTimeFormat('en-US',{timeZone:assertTimeZone(timeZone),year:'numeric',month:'2-digit',day:'2-digit'})
 const parts=Object.fromEntries(formatter.formatToParts(instant).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]))
 const result=`${parts.year}-${parts.month}-${parts.day}`
 parseCivilDate(result)
 return result
}

export function addCivilDays(date,days){
 const parsed=parseCivilDate(date),delta=Number(days)
 if(!Number.isInteger(delta))throw new Error('Los días deben ser un entero.')
 return new Date((parsed.epochDay+delta)*DAY_MS).toISOString().slice(0,10)
}

export function elapsedCivilDays(start,end){
 return parseCivilDate(end).epochDay-parseCivilDate(start).epochDay
}

export function operationalTimeZone(state={},siteId=''){
 const id=text(siteId||state?.currentContext?.siteId)
 const site=(state?.sites||[]).find(item=>item.id===id)
 const organizationId=text(site?.companyId||site?.organizationId||state?.currentContext?.companyId)
 const company=(state?.companies||[]).find(item=>item.id===organizationId)
 return assertTimeZone(site?.timezone||company?.timezone||'UTC')
}

export function operationalToday(state={},options={}){
 return businessDate(options.now||new Date(),operationalTimeZone(state,options.siteId))
}
