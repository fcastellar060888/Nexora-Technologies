import'../styles/state-feedback.css'

const icons={empty:'○',loading:'◌',error:'!',success:'✓',info:'i'}

export default function StateMessage({
 type='empty',
 title,
 message,
 actionLabel,
 onAction,
 compact=false,
 live,
}){
 const role=type==='error'?'alert':'status'
 const ariaLive=live||(type==='error'?'assertive':'polite')
 return <div className={`state-message state-message-${type}${compact?' is-compact':''}`} role={role} aria-live={ariaLive}>
  <span className="state-message-icon" aria-hidden="true">{icons[type]||icons.info}</span>
  <div className="state-message-content">
   {title&&<strong>{title}</strong>}
   {message&&<p>{message}</p>}
   {actionLabel&&onAction&&<button type="button" className="button secondary state-message-action" onClick={onAction}>{actionLabel}</button>}
  </div>
 </div>
}
