const DATA_KEY='cannapa_erp_v1_foundation'
const BACKUP_KEY=`${DATA_KEY}_backup`
const CORRUPT_KEY=`${DATA_KEY}_corrupt`

function browserStorage(){
 if(typeof localStorage==='undefined')throw new Error('Almacenamiento del navegador no disponible')
 return localStorage
}

export function createLocalPersistenceDriver(storage=browserStorage()){
 return{
  kind:'local',
  dataKey:DATA_KEY,
  readRaw(){return storage.getItem(DATA_KEY)},
  writeRaw(raw){storage.setItem(DATA_KEY,raw)},
  preserveBackup(raw,reason='Copia preventiva'){
   if(!raw)return
   storage.setItem(BACKUP_KEY,JSON.stringify({preservedAt:new Date().toISOString(),reason,raw}))
  },
  preserveCorrupt(raw,reason='Datos inválidos'){
   if(!raw)return
   storage.setItem(CORRUPT_KEY,JSON.stringify({preservedAt:new Date().toISOString(),reason,raw}))
  },
  readRecovery(){
   for(const key of[CORRUPT_KEY,BACKUP_KEY]){
    try{const value=JSON.parse(storage.getItem(key)||'null');if(value)return{key,...value}}catch{}
   }
   return null
  }
 }
}

let activeDriver
export function getPersistenceDriver(){
 if(!activeDriver)activeDriver=createLocalPersistenceDriver()
 return activeDriver
}

export function setPersistenceDriver(driver){
 if(!driver||typeof driver.readRaw!=='function'||typeof driver.writeRaw!=='function')throw new Error('Driver de persistencia inválido')
 activeDriver=driver
}

export function resetPersistenceDriver(){activeDriver=undefined}
