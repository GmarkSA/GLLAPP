import axios from 'axios'
import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export type FelDocType =
  | 'fel-xml'
  | 'fel-pdf'
  | 'fel-xml-proveedor'
  | 'fel-pdf-proveedor'

export interface UploadUrlResponse {
  uploadUrl: string
  key: string
  expiresAt: string
}

export interface DownloadUrlResponse {
  downloadUrl: string
  expiresAt: string
}

export interface RequestUploadUrlParams {
  fileName: string
  contentType: string
  docType: FelDocType
  empresaId: string
  empresaNombre?: string
  uuid: string
}

// Ask the backend for a presigned PUT URL. The backend builds the R2 key
// using tenantId from the JWT — never trust a client-supplied tenantId.
export const requestUploadUrl = (
  params: RequestUploadUrlParams,
): Promise<UploadUrlResponse> =>
  api.post('/documents/upload-url', params).then(unwrap)

// Upload a file directly to R2 using the presigned URL.
// Uses plain axios (no auth headers) — R2 validates via the signed URL.
export const uploadToR2 = (
  presignedUrl: string,
  file: Blob,
  contentType: string,
  onUploadProgress?: (percent: number) => void,
): Promise<void> =>
  axios.put(presignedUrl, file, {
    headers: { 'Content-Type': contentType },
    onUploadProgress: onUploadProgress
      ? (e) => {
          const percent = e.total ? Math.round((e.loaded * 100) / e.total) : 0
          onUploadProgress(percent)
        }
      : undefined,
  }).then(() => undefined)

// Ask the backend for a presigned GET URL (1-hour TTL).
// The key contains slashes — pass directly as path segment (NestJS :key(*) captures it).
// Never cache: a new signed URL is generated on every call.
export const requestDownloadUrl = (key: string): Promise<DownloadUrlResponse> =>
  api.get(`/documents/download-url/${key}`).then(unwrap)

export const deleteDocument = (key: string): Promise<void> =>
  api.delete(`/documents/${key}`).then(() => undefined)
