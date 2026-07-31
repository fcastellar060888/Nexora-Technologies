import fs from 'node:fs'
import path from 'node:path'

const src = path.resolve('src')
const errors = []
const warnings = []

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes:true }).flatMap(e => {
    const p = path.join(dir,e.name)
    return e.isDirectory() ? walk(p) : [p]
  })
}

const files = walk(src).filter(x=>/\.(js|jsx)$/.test(x))
const exportsByFile = new Map()

for (const file of files) {
  const text = fs.readFileSync(file,'utf8')
  const names = [...text.matchAll(/export\s+(?:default\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/g)].map(x=>x[1])
  const duplicates = names.filter((x,i)=>names.indexOf(x)!==i)
  if (duplicates.length) errors.push(`${file}: exportaciones duplicadas: ${[...new Set(duplicates)].join(', ')}`)
  exportsByFile.set(file,new Set(names))

  for (const match of text.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    let target = path.resolve(path.dirname(file), match[1])
    const candidates = [target,`${target}.js`,`${target}.jsx`,path.join(target,'index.js'),path.join(target,'index.jsx')]
    if (!candidates.some(fs.existsSync)) errors.push(`${file}: importación local no encontrada ${match[1]}`)
  }


  for (const match of text.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*['"][^'"]+['"]/g)) {
    const imported = match[1].split(',').map(x=>x.trim().split(/\s+as\s+/)[0]).filter(Boolean)
    const dupImports = imported.filter((x,i)=>imported.indexOf(x)!==i)
    if (dupImports.length) errors.push(`${file}: símbolos importados duplicados: ${[...new Set(dupImports)].join(', ')}`)
  }

  if (text.includes('Object.groupBy')) warnings.push(`${file}: usa Object.groupBy; existe fallback, revisar navegadores antiguos.`)
}

const app = fs.readFileSync(path.join(src,'App.jsx'),'utf8')
const routeImports = [...app.matchAll(/import\s+(\w+)\s+from\s+['"](\.\/pages\/[^'"]+)['"]/g)]
for (const [,name,rel] of routeImports) {
  const p = path.resolve(src, rel.replace('./','')) + '.jsx'
  if (!fs.existsSync(p)) errors.push(`App.jsx: página ausente ${name} -> ${rel}`)
}

console.log(`Archivos revisados: ${files.length}`)
warnings.forEach(x=>console.warn(`ADVERTENCIA: ${x}`))
if (errors.length) {
  errors.forEach(x=>console.error(`ERROR: ${x}`))
  process.exit(1)
}
console.log('Auditoría estática: OK')
