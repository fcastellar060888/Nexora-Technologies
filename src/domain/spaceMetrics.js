const positive=value=>Math.max(0,Number(value)||0)

export function lengthToMeters(value,unit='m'){
 const length=positive(value)
 return unit==='cm'?length/100:length
}

export function areaSquareMeters(length,width,unit='m'){
 return lengthToMeters(length,unit)*lengthToMeters(width,unit)
}

export function plantDensity(plants,areaM2){
 const area=positive(areaM2)
 return area>0?positive(plants)/area:0
}

export function bankCapacity(trays=[]){
 return trays.reduce((total,tray)=>total+positive(tray.quantity)*positive(tray.cellsPerTray),0)
}

export function occupancyPercent(plants,capacity){
 const max=positive(capacity)
 return max>0?Math.min(100,positive(plants)/max*100):0
}

export function formatArea(area){return `${positive(area).toFixed(2)} m²`}
export function formatDensity(value){return `${positive(value).toFixed(2)} plantas/m²`}
