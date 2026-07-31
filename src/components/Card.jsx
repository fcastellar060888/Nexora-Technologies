export default function Card({title,subtitle,actions,children,className='',flush=false}){
 return <section className={`card ${flush?'flush':''} ${className}`.trim()}>
  {(title||subtitle||actions)&&<div className="card-heading">
   <div className="card-heading-copy">{title&&<h3>{title}</h3>}{subtitle&&<p>{subtitle}</p>}</div>
   {actions&&<div className="card-heading-actions">{actions}</div>}
  </div>}
  <div className="card-body">{children}</div>
 </section>
}
