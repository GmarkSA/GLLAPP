import { useRef, useState } from 'react'
import { Button, Tooltip, message as antdMessage } from 'antd'
import { PaperClipOutlined, FileOutlined, CloseCircleFilled } from '@ant-design/icons'
import type { AdjuntoRef, SupportAttachment } from '../../api/support'

const esImagen = (t?: string) => !!t && t.startsWith('image/')
const esAudio  = (t?: string) => !!t && t.startsWith('audio/')
const tamano = (n?: number) =>
  !n ? '' : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`

const MAX = 10 * 1024 * 1024 // 10 MB

/** Render de solo lectura de los adjuntos de un mensaje. */
export function MessageAttachments({ attachments }: { attachments?: SupportAttachment[] }) {
  if (!attachments?.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {attachments.map((a, i) => {
        if (esImagen(a.type)) return (
          <a key={i} href={a.url} target="_blank" rel="noopener noreferrer">
            <img src={a.url} alt={a.name} style={{ maxWidth: 170, maxHeight: 170, borderRadius: 8, display: 'block' }} />
          </a>
        )
        if (esAudio(a.type)) return (
          <audio key={i} controls src={a.url} style={{ height: 34, maxWidth: 230 }} />
        )
        return (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: 'inherit', maxWidth: 230 }}
          >
            <FileOutlined />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
          </a>
        )
      })}
    </div>
  )
}

/** Botón "adjuntar" + input oculto: sube cada archivo y notifica onUploaded(ref). */
export function AdjuntarButton({
  uploader, onUploaded, color = '#1faec2',
}: {
  uploader: (file: File) => Promise<AdjuntoRef>
  onUploaded: (ref: AdjuntoRef) => void
  color?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setSubiendo(true)
    try {
      for (const f of Array.from(files)) {
        if (f.size > MAX) { antdMessage.warning(`${f.name} supera 10 MB`); continue }
        try { onUploaded(await uploader(f)) }
        catch { antdMessage.error(`No se pudo subir ${f.name}`) }
      }
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={e => onFiles(e.target.files)} />
      <Tooltip title="Adjuntar imagen, documento o audio">
        <Button icon={<PaperClipOutlined />} loading={subiendo} onClick={() => inputRef.current?.click()} style={{ color }} />
      </Tooltip>
    </>
  )
}

/** Chips de los adjuntos pendientes (antes de enviar el mensaje). */
export function PendingStrip({ pendientes, onQuitar }: { pendientes: AdjuntoRef[]; onQuitar: (i: number) => void }) {
  if (!pendientes.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0' }}>
      {pendientes.map((a, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eef2f7', borderRadius: 8, padding: '3px 8px', fontSize: 12 }}>
          <FileOutlined />
          <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
          <span style={{ color: '#9aa1ab' }}>{tamano(a.size)}</span>
          <CloseCircleFilled style={{ color: '#c3cad6', cursor: 'pointer' }} onClick={() => onQuitar(i)} />
        </span>
      ))}
    </div>
  )
}
