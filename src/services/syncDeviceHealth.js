import{authenticatedRequest}from'./supabase.js'

export async function reportDeviceHealth({companyId,deviceId,status,reason='',durationMs=0,pushed=0,pulled=0,error=''}){
 if(!companyId||!deviceId)return null
 return authenticatedRequest('/rest/v1/rpc/record_sync_device_health',{
  method:'POST',
  body:{p_organization_id:companyId,p_device_id:deviceId,p_status:status,p_reason:reason,p_duration_ms:Math.max(0,Math.round(durationMs)),p_pushed:Math.max(0,Number(pushed)||0),p_pulled:Math.max(0,Number(pulled)||0),p_error:error||''}
 })
}

export async function loadOrganizationDeviceHealth(companyId){
 if(!companyId)return[]
 return authenticatedRequest(`/rest/v1/sync_device_health?organization_id=eq.${encodeURIComponent(companyId)}&select=*&order=last_seen_at.desc`)
}

export function normalizeRemoteDeviceHealth(rows=[]){
 return(Array.isArray(rows)?rows:[]).map(row=>({
  companyId:row.organization_id,deviceId:row.device_id,userId:row.user_id||'',status:row.status,
  totalAttempts:Number(row.total_attempts||0),totalSuccesses:Number(row.total_successes||0),totalFailures:Number(row.total_failures||0),
  consecutiveFailures:Number(row.consecutive_failures||0),lastError:row.last_error||'',lastReason:row.last_reason||'',
  lastDurationMs:Number(row.last_duration_ms||0),lastPushed:Number(row.last_pushed||0),lastPulled:Number(row.last_pulled||0),
  lastSeenAt:row.last_seen_at||'',updatedAt:row.updated_at||''
 }))
}
