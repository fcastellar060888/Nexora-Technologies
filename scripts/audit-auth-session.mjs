import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const root=process.cwd()
const policy=JSON.parse(await readFile(path.join(root,'config/auth-session-policy.json'),'utf8'))
if(policy.storage!=='sessionStorage')throw new Error('Auth policy must require sessionStorage')
if(policy.localStorageAuthTokensAllowed!==false)throw new Error('Auth policy must forbid localStorage auth tokens')
if(policy.refreshSingleFlight!==true)throw new Error('Auth policy must require refresh single-flight')
if(policy.crossTabLogout!=='BroadcastChannel')throw new Error('Auth policy must require cross-tab logout propagation')

const sourceFiles=[]
async function walk(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name)
    if(entry.isDirectory())await walk(full)
    else if(/\.(?:js|jsx|mjs|cjs|ts|tsx)$/.test(entry.name))sourceFiles.push(full)
  }
}
await walk(path.join(root,'src'))

const violations=[]
for(const file of sourceFiles){
  const relative=path.relative(root,file).replaceAll('\\','/')
  const text=await readFile(file,'utf8')
  const lines=text.split(/\r?\n/)
  lines.forEach((line,index)=>{
    const lower=line.toLowerCase()
    if(/localstorage\s*\.\s*setitem/.test(lower)&&(lower.includes('token')||lower.includes('session')||lower.includes('auth'))){
      violations.push(`${relative}:${index+1}: auth/session data must not be written to localStorage`)
    }
    if(/console\s*\.\s*(?:log|debug|info|warn|error)/.test(lower)&&/(access_token|refresh_token|authorization\s*:|bearer\s+)/.test(lower)){
      violations.push(`${relative}:${index+1}: token-bearing auth data must not be logged`)
    }
  })
}

const supabase=await readFile(path.join(root,'src/services/supabase.js'),'utf8')
const authStorage=await readFile(path.join(root,'src/services/authSessionStorage.js'),'utf8')
for(const required of ['createAuthSessionStorage','refreshPromise','authSession.clear({broadcast:true})']){
  if(!supabase.includes(required))violations.push(`src/services/supabase.js: missing hardened auth invariant ${required}`)
}
for(const required of ['sessionStorageRef','removeLegacyLocalSessions','BroadcastChannel','Memory-only fallback']){
  if(!authStorage.includes(required))violations.push(`src/services/authSessionStorage.js: missing policy invariant ${required}`)
}
if(/safeWrite\s*\(\s*localStorageRef/.test(authStorage))violations.push('src/services/authSessionStorage.js: localStorage write detected')

if(violations.length){
  console.error('Auth session audit failed:')
  for(const violation of violations)console.error(`- ${violation}`)
  process.exit(1)
}
console.log(`Auth session audit: OK (${sourceFiles.length} source files checked; localStorage token persistence forbidden).`)
