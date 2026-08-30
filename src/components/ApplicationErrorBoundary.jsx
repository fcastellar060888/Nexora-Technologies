import React from 'react'

function defaultErrorReporter(error, info) {
  console.error('[Nexora] Uncaught application error', error, {
    componentStack: info?.componentStack || '',
  })
}

export class ApplicationErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    const reporter = typeof this.props.onError === 'function'
      ? this.props.onError
      : defaultErrorReporter

    reporter(error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-error-boundary" role="alert" aria-live="assertive">
          <h1>Nexora One no pudo completar esta vista</h1>
          <p>Se aisló un error inesperado para evitar que la aplicación continúe en un estado inconsistente.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Recargar aplicación
          </button>
        </main>
      )
    }

    return this.props.children
  }
}

export default ApplicationErrorBoundary
