import React from'react'

export function FormCard({title,description,toolbar,children,className=''}){return <section className={`form-card ${className}`.trim()}><header className="form-card-head"><div><h3>{title}</h3>{description&&<p>{description}</p>}</div>{toolbar&&<div className="form-toolbar">{toolbar}</div>}</header>{children}</section>}
export function FormSection({title,description,children,className=''}){return <fieldset className={`form-section-kit ${className}`.trim()}><legend>{title}</legend>{description&&<p className="form-section-description">{description}</p>}{children}</fieldset>}
export function FormGrid({columns=3,children,className=''}){return <div className={`form-kit-grid columns-${columns} ${className}`.trim()}>{children}</div>}
export function FormField({label,required,help,error,children,className=''}){return <label className={`form-kit-field ${error?'has-error':''} ${className}`.trim()}><span>{label}{required&&<b aria-hidden="true"> *</b>}</span>{children}{error?<small role="alert">{error}</small>:help&&<small>{help}</small>}</label>}
export function FormActions({children,sticky=false}){return <div className={`form-kit-actions ${sticky?'sticky':''}`}>{children}</div>}
export function ValidationMessage({children,type='error'}){return <div className={`validation-message ${type}`} role={type==='error'?'alert':'status'}>{children}</div>}
