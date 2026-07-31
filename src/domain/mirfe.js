export const mirfeCategories = [
  'Nutrición', 'Riego', 'Raíz', 'Fisiología', 'Floración', 'Ambiente', 'EC/pH', 'Drenaje'
]

export const mirfeStatuses = [
  'Borrador', 'Pendiente aprobación', 'Aprobado', 'Programado',
  'Aplicado', 'En seguimiento', 'Efectivo', 'Sin respuesta', 'Cancelado'
]

export function calculateVpd(tempC, humidity) {
  const es = 0.6108 * Math.exp((17.27 * Number(tempC || 0)) / (Number(tempC || 0) + 237.3))
  return Math.max(0, es * (1 - Number(humidity || 0) / 100))
}

export function deltaEc(input, drain) {
  return Number(drain || 0) - Number(input || 0)
}

export function quantityFromDose(dose, unit, volume) {
  const d = Number(dose || 0), v = Number(volume || 0)
  if (unit === 'mL/100 L' || unit === 'g/100 L') return d * v / 100
  return d * v
}
