export default function PageHeader({title,subtitle,actions}){return <div className="page-header"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{actions&&<div>{actions}</div>}</div>}
