import { useState } from 'react'
import { Button, Tooltip, message } from 'antd'
import { FilePdfOutlined, FileTextOutlined, DownloadOutlined, LoadingOutlined } from '@ant-design/icons'
import { requestDownloadUrl, type FelDocType } from '../api/storage'

interface DocumentLinkProps {
  documentKey: string | undefined
  label?: string
  docType?: FelDocType
  showDownload?: boolean
}

const ICON_MAP: Record<string, React.ReactNode> = {
  'fel-pdf':            <FilePdfOutlined />,
  'fel-pdf-proveedor':  <FilePdfOutlined />,
  'fel-xml':            <FileTextOutlined />,
  'fel-xml-proveedor':  <FileTextOutlined />,
}

export default function DocumentLink({
  documentKey,
  label,
  docType,
  showDownload = true,
}: DocumentLinkProps) {
  const [loading, setLoading] = useState(false)

  if (!documentKey) {
    return (
      <Button size="small" disabled type="link" style={{ padding: 0, fontSize: 12 }}>
        {label ?? 'Sin archivo'}
      </Button>
    )
  }

  const icon = loading
    ? <LoadingOutlined />
    : (docType ? ICON_MAP[docType] : null) ?? <DownloadOutlined />

  const handleClick = async () => {
    setLoading(true)
    try {
      const { downloadUrl } = await requestDownloadUrl(documentKey)
      window.open(downloadUrl, '_blank', 'noopener,noreferrer')
    } catch {
      message.error('No se pudo acceder al documento')
    } finally {
      setLoading(false)
    }
  }

  const displayLabel = label ?? (docType?.includes('pdf') ? 'PDF' : 'XML')

  if (!showDownload) {
    return (
      <Tooltip title={documentKey}>
        <Button
          size="small"
          type="link"
          icon={icon}
          loading={loading}
          onClick={handleClick}
          style={{ padding: 0, fontSize: 12 }}
        >
          {displayLabel} ↗
        </Button>
      </Tooltip>
    )
  }

  return (
    <Tooltip title={documentKey}>
      <Button
        size="small"
        type="link"
        icon={icon}
        loading={loading}
        onClick={handleClick}
        style={{ padding: 0, fontSize: 12, fontWeight: docType?.includes('pdf') ? 600 : undefined }}
      >
        {displayLabel} ↗
      </Button>
    </Tooltip>
  )
}
