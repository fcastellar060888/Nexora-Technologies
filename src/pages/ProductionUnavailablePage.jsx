import { Link, useLocation } from 'react-router-dom'

const STAGES = {
  '/production/harvest': 'Cosecha',
  '/production/drying': 'Secado',
  '/production/trimming': 'Manicura',
  '/production/selection': 'Selección',
  '/production/packing': 'Empaque',
  '/production/flow': 'Flujo de producción',
}

export default function ProductionUnavailablePage() {
  const { pathname } = useLocation()
  const stage = STAGES[pathname] ?? 'Producción'

  return (
    <main className="page" aria-labelledby="production-unavailable-title">
      <h1 id="production-unavailable-title">{stage}</h1>
      <p>
        Este módulo de producción todavía no está habilitado. No se redirige a Propagación porque
        representa un dominio operacional diferente.
      </p>
      <p>
        Puedes volver al <Link to="/dashboard">dashboard</Link> sin registrar ni modificar datos de producción.
      </p>
    </main>
  )
}
