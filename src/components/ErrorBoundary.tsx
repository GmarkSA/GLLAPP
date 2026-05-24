import { Component, type ReactNode } from 'react'
import { Button, Result } from 'antd'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <Result
          status="error"
          title="Error en la página"
          subTitle={this.state.error.message}
          extra={[
            <pre key="stack" style={{
              textAlign: 'left', background: '#f5f5f5', padding: 16,
              borderRadius: 8, fontSize: 12, maxHeight: 300, overflow: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {this.state.error.stack}
            </pre>,
            <Button key="reload" type="primary" onClick={() => window.location.reload()}>
              Recargar página
            </Button>,
          ]}
        />
      )
    }
    return this.props.children
  }
}
