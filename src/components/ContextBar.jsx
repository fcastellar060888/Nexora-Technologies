import{useLocation}from'react-router-dom'
import{operationalContextOptions,transitionOperationalContext}from'../domain/operationalContext.js'
import{useStore}from'../services/store'

const rules=[
 [/^\/(companies|users|audit|diagnostics|settings)/,['company']],
 [/^\/sites/,['company','site']],
 [/^\/infrastructure(?:-map|\/operations|$)/,['company','site']],
 [/^\/(inventory|costs)/,['company','site']],
 [/^\/irrigation\/(products|water)/,['company','site']],
 [/^\/irrigation\/(objectives|formulation)/,['company','site','genetic','stage']],
 [/^\/production/,['company','site','house','bed','plant','genetic','stage']],
 [/^\/propagation\/mothers/,['company','site','genetic']],
 [/^\/propagation/,['company','site','house','bed','plant','genetic','stage']],
 [/^\/mipe/,['company','site','house','bed','plant','stage','week']],
 [/^\/mirfe/,['company','site','house','bed','plant','genetic','stage','week']],
 [/^\/(cultivation-map|plant\/)/,['company','site','house','bed','plant']]
]

export default function ContextBar(){
 const{pathname}=useLocation(),{state,update}=useStore(),c=state.currentContext||{},options=operationalContextOptions(state,c)
 const visible=(rules.find(([rule])=>rule.test(pathname))?.[1])||['company','site','house','bed','plant','stage','week']
 function set(patch){update(current=>({...current,currentContext:transitionOperationalContext(current,patch)}),{audit:false,sync:false})}
 const field=(name,node)=>visible.includes(name)?node:null
 return <div className="context-bar compact" aria-label="Contexto operativo">
  {field('company',<label><span>Empresa</span><select aria-label="Empresa activa" value={c.companyId||''} onChange={event=>set({companyId:event.target.value})}><option value="" disabled={options.companies.length>0}>Seleccionar empresa</option>{options.companies.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>)}
  {field('site',<label><span>Sede</span><select aria-label="Sede activa" value={c.siteId||''} onChange={event=>set({siteId:event.target.value})}><option value="">Todas las sedes</option>{options.sites.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>)}
  {field('house',<label><span>Nave</span><select aria-label="Nave activa" value={c.houseId||''} onChange={event=>set({houseId:event.target.value})} disabled={!c.siteId}><option value="">Todas las naves</option>{options.houses.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>)}
  {field('bed',<label><span>Cama</span><select aria-label="Cama activa" value={c.bedId||''} onChange={event=>set({bedId:event.target.value})} disabled={!c.houseId}><option value="">Todas las camas</option>{options.beds.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>)}
  {field('plant',<label><span>Planta</span><select aria-label="Planta activa" value={c.plantId||''} onChange={event=>set({plantId:event.target.value})} disabled={!c.bedId}><option value="">Todas las plantas</option>{options.plants.map(item=><option key={item.id} value={item.id}>{item.code||item.plantCode||item.id}</option>)}</select></label>)}
  {field('genetic',<label><span>Genética</span><select aria-label="Genética activa" value={c.geneticId||''} onChange={event=>set({geneticId:event.target.value})}><option value="">Todas</option>{options.genetics.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>)}
  {field('stage',<label><span>Etapa</span><select aria-label="Etapa activa" value={c.stage||''} onChange={event=>set({stage:event.target.value})}><option value="">Todas</option>{['Madre','Propagación','Vegetativo','Floración temprana','Floración media','Floración final','Cosecha','Poscosecha'].map(item=><option key={item}>{item}</option>)}</select></label>)}
  {field('week',<label><span>Semana</span><input aria-label="Semana activa" type="number" min="1" value={c.week||1} onChange={event=>set({week:Number(event.target.value)})}/></label>)}
 </div>
}
