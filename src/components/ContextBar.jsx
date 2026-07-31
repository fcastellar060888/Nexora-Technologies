import{useLocation}from'react-router-dom'
import{useStore}from'../services/store'
const rules=[
 [/^\/(companies|users|login|audit|diagnostics|settings)/,['company']],
 [/^\/sites/,['company','site']],
 [/^\/(inventory|costs)/,['company','site']],
 [/^\/irrigation\/(products|water)/,['company','site']],
 [/^\/irrigation\/(objectives|formulation)/,['company','site','genetic','stage']],
 [/^\/production/,['company','site','house','bed','genetic','stage']],
 [/^\/propagation\/mothers/,['company','site','genetic']],
 [/^\/propagation/,['company','site','house','bed','genetic','stage']],
 [/^\/mipe/,['company','site','house','bed','stage','week']],
 [/^\/mirfe/,['company','site','house','bed','genetic','stage','week']]
]
export default function ContextBar(){
 const{pathname}=useLocation();const{state,update}=useStore();const c=state.currentContext||{}
 const visible=(rules.find(([r])=>r.test(pathname))?.[1])||['company','site','house','bed','stage','week']
 const sites=state.sites.filter(x=>!c.companyId||x.companyId===c.companyId),houses=state.houses.filter(x=>!c.siteId||x.siteId===c.siteId),beds=state.beds.filter(x=>!c.houseId||x.houseId===c.houseId)
 function set(patch){update(s=>({...s,currentContext:{...s.currentContext,...patch}}),{audit:false})}
 const field=(name,node)=>visible.includes(name)?node:null
 return <div className="context-bar compact">
  {field('company',<label><span>Empresa</span><select value={c.companyId||''} onChange={e=>{const companyId=e.target.value,siteId=state.sites.find(x=>x.companyId===companyId)?.id||'',houseId=state.houses.find(x=>x.siteId===siteId)?.id||'',bedId=state.beds.find(x=>x.houseId===houseId)?.id||'';set({companyId,siteId,houseId,bedId,plantId:''})}}><option value="">Todas</option>{state.companies.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>)}
  {field('site',<label><span>Sede</span><select value={c.siteId||''} onChange={e=>{const siteId=e.target.value,houseId=state.houses.find(x=>x.siteId===siteId)?.id||'',bedId=state.beds.find(x=>x.houseId===houseId)?.id||'';set({siteId,houseId,bedId,plantId:''})}}><option value="">Todas</option>{sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>)}
  {field('house',<label><span>Nave</span><select value={c.houseId||''} onChange={e=>{const houseId=e.target.value,bedId=state.beds.find(x=>x.houseId===houseId)?.id||'';set({houseId,bedId,plantId:''})}}><option value="">Todas</option>{houses.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>)}
  {field('bed',<label><span>Cama</span><select value={c.bedId||''} onChange={e=>set({bedId:e.target.value,plantId:''})}><option value="">Todas</option>{beds.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>)}
  {field('genetic',<label><span>Genética</span><select value={c.geneticId||''} onChange={e=>set({geneticId:e.target.value})}><option value="">Todas</option>{state.genetics.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>)}
  {field('stage',<label><span>Etapa</span><select value={c.stage||''} onChange={e=>set({stage:e.target.value})}><option value="">Todas</option>{['Madre','Propagación','Vegetativo','Floración temprana','Floración media','Floración final','Cosecha','Poscosecha'].map(x=><option key={x}>{x}</option>)}</select></label>)}
  {field('week',<label><span>Semana</span><input type="number" min="1" value={c.week||1} onChange={e=>set({week:Number(e.target.value)})}/></label>)}
 </div>
}
