import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')

test('M12-F002: UsersPage separates enterprise identity from standalone local profiles',async()=>{
 const source=await read('src/pages/UsersPage.jsx')
 assert.match(source,/memberships/)
 assert.match(source,/user\?\.remote/)
 assert.match(source,/La sesión activa proviene de la identidad empresarial/)
 assert.match(source,/Gestionado externamente/)
})

test('M12-F002: local profile mutations use the audited command boundary',async()=>{
 const source=await read('src/pages/UsersPage.jsx')
 assert.match(source,/executeCoreOperationCommand/)
 assert.match(source,/CORE_OPERATION_REQUESTED|executeCoreOperationCommand/)
 assert.match(source,/USER_CREATED/)
 assert.match(source,/USER_SESSION_SELECTED/)
 assert.match(source,/USER_DEACTIVATED/)
})

test('M12-F002: user identity is never physically deleted from the local store',async()=>{
 const source=await read('src/pages/UsersPage.jsx')
 assert.doesNotMatch(source,/users\s*:\s*[^\n]*\.filter\s*\(/)
 assert.doesNotMatch(source,/USER_DELETED/)
 assert.match(source,/archivedAt/)
 assert.match(source,/archivado sin eliminar su historial/)
})

test('M12-F002: enterprise mode cannot silently fall back to local-installation ownership',async()=>{
 const source=await read('src/pages/UsersPage.jsx')
 assert.match(source,/if\(!enterpriseMode&&state\.companies\.length===0\)return'local-installation'/)
 assert.match(source,/throw new Error\('No se puede demostrar la organización del perfil\.'\)/)
})
