import '../styles/date-time-controls.css'

export default function DateTimeFields({value='',onChange,dateLabel='Fecha',timeLabel='Hora',required=false,disabled=false}){
 const [date='',time='']=String(value||'').split('T')
 const emit=(nextDate,nextTime)=>onChange?.(nextDate&&nextTime?`${nextDate}T${nextTime}`:nextDate?`${nextDate}T00:00`:nextTime?`${new Date().toISOString().slice(0,10)}T${nextTime}`:'')
 return <div className="date-time-fields" role="group" aria-label={`${dateLabel} y ${timeLabel}`}>
  <label className="date-time-subfield"><span>{dateLabel}</span><input type="date" value={date} required={required} disabled={disabled} onChange={event=>emit(event.target.value,time)}/></label>
  <label className="date-time-subfield"><span>{timeLabel}</span><input type="time" value={time} required={required} disabled={disabled} onChange={event=>emit(date,event.target.value)}/></label>
 </div>
}
