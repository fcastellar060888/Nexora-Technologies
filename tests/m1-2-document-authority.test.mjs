import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{
 MAX_DOCUMENT_BYTES,DOCUMENT_STATUS,archiveDocument,documentStoragePath,listDocuments,resolveDocumentScope,sha256Document,uploadDocument,validateDocumentFile
}from'../src/services/documentAuthority.js'

const file=(body='abc',type='application/pdf',name='evidence.pdf')=>{const bytes=new TextEncoder().encode(body);return{name,type,size:bytes.byteLength,arrayBuffer:async()=>bytes.buffer}}
const state={companies:[{id:'org-a'},{id:'org-b'}],memberships:[{companyId:'org-a'}],sites:[{id:'site-a',companyId:'org-a'},{id:'site-b',companyId:'org-b'}],currentContext:{companyId:'org-a',siteId:'site-a'}}

test('M12-F003: document scope rejects cross-tenant site and organization',()=>{
 assert.deepEqual(resolveDocumentScope(state,{}),{organizationId:'org-a',siteId:'site-a'})
 assert.throws(()=>resolveDocumentScope(state,{organizationId:'org-b'}),/otra organización/)
 assert.throws(()=>resolveDocumentScope(state,{siteId:'site-b'}),/otra organización/)
})

test('M12-F004: file validation enforces type, non-empty content and 25 MB cap',()=>{
 assert.equal(validateDocumentFile(file()).name,'evidence.pdf')
 assert.throws(()=>validateDocumentFile(file('abc','text/html','x.html')),/Tipo de archivo no permitido/)
 assert.throws(()=>validateDocumentFile({name:'x.pdf',type:'application/pdf',size:0,arrayBuffer:async()=>new ArrayBuffer(0)}),/vacío/)
 assert.throws(()=>validateDocumentFile({name:'x.pdf',type:'application/pdf',size:MAX_DOCUMENT_BYTES+1,arrayBuffer:async()=>new ArrayBuffer(1)}),/25 MB/)
})

test('M12-F004: checksum is stable SHA-256 and storage path is tenant-prefixed',async()=>{
 assert.equal(await sha256Document(file()),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
 const path=documentStoragePath({organizationId:'org-a',siteId:'site-a',entityType:'plant',entityId:'plant-1',documentId:'doc-1',fileName:'Foto 1.pdf'})
 assert.equal(path,'org-a/site-a/plant/plant-1/doc-1/Foto-1.pdf')
})

test('M12-F004: enterprise upload persists pending metadata before bytes and activates after storage',async()=>{
 const calls=[]
 const jsonRequest=async(path,options={})=>{
  calls.push(['json',options.method||'GET',path,options.body?.status])
  if(options.method==='PATCH')return[{id:'doc-1',organization_id:'org-a',site_id:'site-a',entity_type:'plant',entity_id:'plant-1',name:'evidence.pdf',mime_type:'application/pdf',size_bytes:3,checksum_sha256:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',storage_bucket:'documents',storage_path:'org-a/site-a/plant/plant-1/doc-1/evidence.pdf',status:'active'}]
  return null
 }
 const binaryRequest=async(path,options={})=>{calls.push(['binary',options.method,path,options.headers?.['x-upsert']]);return{}}
 const document=await uploadDocument({state,file:file(),entityType:'plant',entityId:'plant-1',documentId:'doc-1'},{enabled:true,jsonRequest,binaryRequest})
 assert.equal(document.status,DOCUMENT_STATUS.ACTIVE)
 assert.deepEqual(calls.map(call=>call.slice(0,2)),[['json','POST'],['binary','POST'],['json','PATCH']])
 assert.equal(calls[0][3],'pending')
 assert.equal(calls[1][3],'true')
})

test('M12-F003: listing filters same entity id from another organization defensively',async()=>{
 const rows=[
  {id:'a',organization_id:'org-a',entity_type:'plant',entity_id:'same',name:'a.pdf',mime_type:'application/pdf',size_bytes:1,status:'active'},
  {id:'b',organization_id:'org-b',entity_type:'plant',entity_id:'same',name:'b.pdf',mime_type:'application/pdf',size_bytes:1,status:'active'}
 ]
 const result=await listDocuments({state,entityType:'plant',entityId:'same'},{enabled:true,jsonRequest:async()=>rows})
 assert.deepEqual(result.map(item=>item.id),['a'])
})

test('M12-F004: archive changes lifecycle metadata and never requires physical delete',async()=>{
 const current={id:'doc-1',organizationId:'org-a',siteId:'site-a',status:'active'}
 const archived=await archiveDocument({state,document:current},{enabled:true,jsonRequest:async(path,options)=>[{...current,organization_id:'org-a',site_id:'site-a',status:options.body.status,archived_at:options.body.archived_at}]})
 assert.equal(archived.status,DOCUMENT_STATUS.ARCHIVED)
 assert.ok(archived.archivedAt)
 await assert.rejects(archiveDocument({state,document:{...current,organizationId:'org-b'}},{enabled:false}),/otra organización/)
})

test('M12-F003/F004 re-audit: uploader cannot serialize bytes into Store',async()=>{
 const source=await readFile(new URL('../src/components/AttachmentUploader.jsx',import.meta.url),'utf8')
 assert.match(source,/uploadDocument/)
 assert.match(source,/DOCUMENT_UPLOAD_REQUESTED/)
 assert.match(source,/DOCUMENT_ATTACHED/)
 assert.doesNotMatch(source,/FileReader/)
 assert.doesNotMatch(source,/readAsDataURL/)
 assert.doesNotMatch(source,/state\.attachments/)
 assert.doesNotMatch(source,/\bupdate\s*\(/)
 assert.doesNotMatch(source,/dataUrl/)
})

test('M12-F003/F004 re-audit: SQL uses private bucket, org RLS and no DELETE policy',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20260815010000_documents_authority.sql',import.meta.url),'utf8')
 assert.match(sql,/create table if not exists public\.documents/)
 assert.match(sql,/organization_id uuid not null/)
 assert.match(sql,/checksum_sha256/)
 assert.match(sql,/alter table public\.documents enable row level security/)
 assert.match(sql,/public\.is_org_member\(organization_id\)/)
 assert.match(sql,/values \(\s*'documents',\s*'documents',\s*false,/s)
 assert.doesNotMatch(sql,/for delete to authenticated/i)
})
