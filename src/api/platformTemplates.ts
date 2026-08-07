import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export interface PlatformTemplate {
  id:               string
  sourceTenantId:   string
  sourceCompanyId:  string
  displayName:      string
  description:      string
  icon:             string
  isActive:         boolean
  createdAt:        string
}

export const platformTemplatesApi = {
  list:   ()                  => api.get('/admin/platform-templates').then(unwrap) as Promise<PlatformTemplate[]>,
  save:   (dto: Partial<PlatformTemplate> & { sourceTenantId: string; sourceCompanyId: string; displayName: string }) =>
    api.post('/admin/platform-templates', dto).then(unwrap) as Promise<PlatformTemplate>,
  remove: (id: string)        => api.delete(`/admin/platform-templates/${id}`),
}
