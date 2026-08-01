import test from'node:test'
import assert from'node:assert/strict'
import{readFile,readdir}from'node:fs/promises'
import path from'node:path'

const forbidden=/\bCann?apa(?:\s+ERP)?\b|canapa-erp-enterprise/gi

async function filesIn(directory){
 const entries=await readdir(directory,{withFileTypes:true})
 const nested=await Promise.all(entries.map(entry=>{
  const location=path.join(directory,entry.name)
  return entry.isDirectory()?filesIn(location):[location]
 }))
 return nested.flat()
}

test('declara la identidad oficial de Nexora en las superficies principales',async()=>{
 const readme=await readFile('README.md','utf8')
 const index=await readFile('index.html','utf8')
 const pkg=JSON.parse(await readFile('package.json','utf8'))
 assert.match(readme,/Nexora Technologies/)
 assert.match(readme,/Nexora One/)
 assert.match(readme,/Nexora OS/)
 assert.match(readme,/fcastellar060888\/Nexora-Technologies/)
 assert.match(index,/<title>Nexora One<\/title>/)
 assert.equal(pkg.name,'nexora-one')
})

test('no conserva la marca anterior en código, documentación ni metadatos públicos',async()=>{
 const candidates=['README.md','index.html',...await filesIn('src'),...await filesIn('docs')]
 const textFiles=candidates.filter(file=>/\.(?:html|md|js|jsx|json|css|mjs|yml|yaml)$/i.test(file))
 const findings=[]
 for(const file of textFiles){
  const content=await readFile(file,'utf8')
  const matches=[...content.matchAll(forbidden)].map(match=>match[0])
  if(matches.length)findings.push(`${file}: ${[...new Set(matches)].join(', ')}`)
 }
 assert.deepEqual(findings,[])
})
