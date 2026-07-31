import{useStore}from'../services/store'
import{hasPermission}from'../services/permissions'
export default function PermissionButton({permission,children,className='button primary',onClick,type='button',disabled=false,title=''}) {
 const{state}=useStore()
 const allowed=hasPermission(state,permission)
 return <button type={type} className={className} disabled={disabled||!allowed} title={!allowed?'Tu rol no permite esta acción':title} onClick={onClick}>{children}</button>
}
