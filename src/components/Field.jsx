import{useId}from'react'

export default function Field({label,children,help='',error='',required=false,full=false,className=''}){
 const generatedId=useId()
 const helpId=help?`${generatedId}-help`:undefined
 const errorId=error?`${generatedId}-error`:undefined
 const describedBy=[helpId,errorId].filter(Boolean).join(' ')||undefined
 const control=children&&typeof children==='object'&&children.props
  ?{...children,props:{...children.props,'aria-describedby':children.props['aria-describedby']||describedBy,'aria-invalid':children.props['aria-invalid']??Boolean(error),required:children.props.required??required}}
  :children
 return <label className={`field ${full?'full':''} ${error?'invalid':''} ${className}`.trim()}>
  <span>{label}{required&&<span className="field-required" aria-hidden="true"> *</span>}</span>
  {control}
  {help&&<small id={helpId} className="field-help">{help}</small>}
  {error&&<small id={errorId} className="field-error" role="alert">{error}</small>}
 </label>
}
