export function pctLoss(input, output) {
  const i = Number(input || 0), o = Number(output || 0)
  return i > 0 ? ((i - o) / i) * 100 : 0
}
export function unitCost(totalCost, grams) {
  return Number(grams || 0) > 0 ? Number(totalCost || 0) / Number(grams || 0) : 0
}
