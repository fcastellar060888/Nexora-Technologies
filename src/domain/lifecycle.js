import{addCivilDays,businessDate,elapsedCivilDays,operationalToday}from'./timeAuthority.js'
import{defineRuleSet,evaluateRuleSet}from'./ruleEngine.js'

export const LOT_PHASES=['Propagación','Vegetativo','Floración','Cosecha','Secado','Manicura','Selección','Empaque','Finalizado']
export const DEFAULT_PHASE_DAYS={Propagación:14,Vegetativo:21,Floración:63,Cosecha:1,Secado:12,Manicura:5,Selección:2,Empaque:2,Finalizado:0}
export function dateOnly(value=new Date(),timeZone='UTC'){return businessDate(value,timeZone)}
export function addDays(date,days){return addCivilDays(date,Number(days||0))}
export function elapsedDays(start,today=dateOnly()){if(!start)return 0;return Math.max(0,elapsedCivilDays(dateOnly(start),dateOnly(today)))}

const numericDays=value=>{const days=Number(value);return Number.isFinite(days)&&days>=0?days:null}
export function phaseTargetDecision(state,lot,phase=lot.phase){
 const phaseName=String(phase||'').trim(),geneticId=String(lot?.geneticId||'').trim()
 const rules=[]
 const lotOverride=numericDays(lot?.phaseTargetDays)
 if(lotOverride!==null)rules.push({id:`lot:${lot?.id||'current'}:${phaseName}`,value:lotOverride,priority:300,conditions:{phase:phaseName},metadata:{source:'lot-override'}})
 ;(state?.phaseTargets||[]).forEach((target,index)=>{
  if(target?.active===false||String(target?.phase||'').trim()!==phaseName)return
  const days=numericDays(target?.days);if(days===null)return
  const targetGenetic=String(target?.geneticId||'').trim()
  if(targetGenetic&&targetGenetic!==geneticId)return
  rules.push({
   id:String(target?.id||`phase-target:${phaseName}:${targetGenetic||'general'}:${index}`),
   value:days,
   priority:targetGenetic?200:100,
   conditions:targetGenetic?{phase:phaseName,geneticId:targetGenetic}:{phase:phaseName},
   metadata:{source:targetGenetic?'genetic-target':'general-target'}
  })
 })
 const ruleSet=defineRuleSet({id:`lifecycle.phase-days.${phaseName||'unknown'}`,defaultValue:numericDays(DEFAULT_PHASE_DAYS[phaseName])??0,rules})
 return evaluateRuleSet(ruleSet,{phase:phaseName,geneticId})
}
export function targetDays(state,lot,phase=lot.phase){return Number(phaseTargetDecision(state,lot,phase).value)}
export function lotTiming(state,lot,today=''){const reference=today?dateOnly(today):operationalToday(state,{siteId:lot.siteId});const objective=targetDays(state,lot);const elapsed=elapsedDays(lot.phaseStartedAt||lot.startedAt,reference);const remaining=objective-elapsed;return{objective,elapsed,remaining,week:Math.floor(elapsed/7)+1,dueDate:addDays(lot.phaseStartedAt||lot.startedAt,objective),status:remaining<0?'Vencido':remaining<=2?'Urgente':remaining<=7?'Próximo':'En tiempo'}}
export function renewalTiming(entity,today=''){const reference=today?dateOnly(today,entity.timezone||'UTC'):dateOnly(new Date(),entity.timezone||'UTC');const objective=Number(entity.renewalDays||180);const elapsed=elapsedDays(entity.cycleStartedAt||entity.startDate,reference);const remaining=objective-elapsed;return{objective,elapsed,remaining,week:Math.floor(elapsed/7)+1,dueDate:addDays(entity.cycleStartedAt||entity.startDate,objective),status:remaining<0?'Vencida':remaining<=7?'Urgente':remaining<=30?'Próxima':'En tiempo'}}
export function nextPhase(current){const i=LOT_PHASES.indexOf(current);return LOT_PHASES[Math.min(i+1,LOT_PHASES.length-1)]}
export function survivalMetrics(units){const total=units.length,alive=units.filter(x=>!['Muerto','Descartado'].includes(x.status)).length,rooted=units.filter(x=>['Enraizado','Trasplantado a vegetativo'].includes(x.status)).length,dead=units.filter(x=>x.status==='Muerto').length,discarded=units.filter(x=>x.status==='Descartado').length;const pct=n=>total?Math.round(n/total*1000)/10:0;return{total,alive,rooted,dead,discarded,survivalPct:pct(alive),rootingPct:pct(rooted),mortalityPct:pct(dead),discardPct:pct(discarded)}}
export function lotCode(site,genetic,date,sequence){const a=(site?.name||'SED').slice(0,3).toUpperCase().replace(/\W/g,''),g=(genetic?.name||'GEN').replace(/\W/g,'').slice(0,6).toUpperCase();return `LP-${a}-${g}-${String(date).replaceAll('-','')}-${String(sequence).padStart(3,'0')}`}

export const productiveLotTiming=lotTiming
