import { Component, type ReactNode } from 'react'
import { Button, Result } from 'antd'

interface Props { children: ReactNode }
interface State { error: Error | null; isChunkError: boolean }

const CHUNK_ERROR_PATTERNS = [
  'dynamically imported module',
  'Loading chunk',
  'Failed to fetch',
  'Importing a module script failed',
]

function isChunkLoadError(error: Error): boolean {
  return CHUNK_ERROR_PATTERNS.some(p => error.message?.includes(p))
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, isChunkError: false }

  static getDerivedStateFromError(error: Error): State {
    return { error, isChunkError: isChunkLoadError(error) }
  }

  componentDidCatch(error: Error) {
    // Si es un error de chunk stale (deployment nuevo), recargar automáticamente
    if (isChunkLoadError(error)) {
      window.location.reload()
    }
  }

  render() {
    const { error, isChunkError } = this.state

    if (!error) return this.props.children

    if (isChunkError) {
      // Mostramos mensaje mientras se recarga (componentDidCatch ya lanzó el reload)
      return (
        <Result
          status="info"
          title="Actualizando la aplicación..."
          subTitle="Se detectó una versión nueva. La página se recargará en un momento."
        />
      )
    }

    return (
      <Result
        status="error"
        title="Error en la página"
        subTitle="Ocurrió un error inesperado. Recarga la página para continuar."
        extra={[
          <Button key="reload" type="primary" onClick={() => window.location.reload()}>
            Recargar página
          </Button>,
        ]}
      />
    )
  }
}
