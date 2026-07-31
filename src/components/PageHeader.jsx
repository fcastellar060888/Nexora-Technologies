export default function PageHeader({title,subtitle,eyebrow,actions}){
 return <header className="page-header">
  <div className="page-header-copy">
   {eyebrow&&<span className="page-header-eyebrow">{eyebrow}</span>}
   <h2>{title}</h2>
   {subtitle&&<p>{subtitle}</p>}
  </div>
  {actions&&<div className="page-header-actions">{actions}</div>}
 </header>
}
