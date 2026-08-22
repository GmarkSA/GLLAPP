import { useRef, useState, type ReactNode, type DragEvent, type ClipboardEvent } from 'react'
import { Button, Tooltip, message as antdMessage } from 'antd'
import { PaperClipOutlined, FileOutlined, CloseCircleFilled } from '@ant-design/icons'
import type { AdjuntoRef, SupportAttachment } from '../../api/support'
import { getApiError } from '../../api/axios'

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


/**
 * Sube una lista de archivos (botón, arrastrar o pegar) validando el tamaño y
 * mostrando el motivo real si el servidor rechaza la subida.
 */
export async function subirArchivos(
  files: FileList | File[] | null,
  uploader: (file: File) => Promise<AdjuntoRef>,
  onUploaded: (ref: AdjuntoRef) => void,
): Promise<void> {
  if (!files || !('length' in files) || !files.length) return
  for (const f of Array.from(files as ArrayLike<File>)) {
    if (f.size > MAX) { antdMessage.warning(`${f.name} supera 10 MB`); continue }
    try { onUploaded(await uploader(f)) }
    catch (e: any) { antdMessage.error(`No se pudo subir ${f.name}: ${getApiError(e, 'error del servidor')}`) }
  }
}

/**
 * Zona que acepta arrastrar-y-soltar archivos y pegar imágenes del portapapeles
 * (Ctrl/Cmd+V). Envuelve el área de redacción; al arrastrar resalta el borde.
 */
export function DropPasteZone({
  uploader, onUploaded, children, hint = 'Soltá la imagen o el archivo aquí',
}: {
  uploader: (file: File) => Promise<AdjuntoRef>
  onUploaded: (ref: AdjuntoRef) => void
  children: ReactNode
  hint?: string
}) {
  const [over, setOver] = useState(false)
  const onDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setOver(false)
    await subirArchivos(e.dataTransfer?.files ?? null, uploader, onUploaded)
  }
  const onPaste = async (e: ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData?.items ?? [])
    const files = items.filter(i => i.kind === 'file').map(i => i.getAsFile()).filter((f): f is File => !!f)
    if (!files.length) return
    e.preventDefault()
    await subirArchivos(files, uploader, onUploaded)
  }
  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!over) setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onPaste={onPaste}
      style={{
        position: 'relative', borderRadius: 10,
        outline: over ? '2px dashed #1faec2' : '2px dashed transparent',
        outlineOffset: 4, transition: 'outline-color 0.15s',
      }}
    >
      {children}
      {over && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 10, pointerEvents: 'none',
          background: 'rgba(31,174,194,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#1faec2', fontWeight: 600, fontSize: 13,
        }}>
          {hint}
        </div>
      )}
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
    try { await subirArchivos(files, uploader, onUploaded) }
    finally {
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
