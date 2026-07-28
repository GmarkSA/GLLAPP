import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Tag, Space, Popconfirm, message, Typography, Badge, Modal,
} from 'antd'
import {
  PlusOutlined, EditOutlined, StarOutlined, StarFilled, BankOutlined,
  DatabaseOutlined, DeleteOutlined, StopOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { companiesApi } from '../../../api/companies'
import type { Company } from '../../../store/authStore'
import { useCompanyStore } from '../../../store/companyStore'

function formatOrgId(c: Company): string {
  const country  = (c.countryCode ?? 'ORG').toUpperCase()
  const year     = c.createdAt ? new Date(c.createdAt).getFullYear() : new Date().getFullYear()
  const numMatch = (c.companyNumber ?? '').match(/(\d+)$/)
  const seq      = numMatch ? numMatch[1].padStart(4, '0') : '0001'
  return `${country}${year}${seq}`
}

const { Title } = Typography

const STATUS_COLOR: Record<string, string> = {
  active:    'success',
  suspended: 'warning',
  liquidated:'default',
}
const STATUS_LABEL: Record<string, string> = {
  active:    'Activa',
  suspended: 'Suspendida',
  liquidated:'Liquidada',
}

export default function EmpresasPage() {
  const navigate         = useNavigate()
  const setActiveCompany = useCompanyStore(s => s.setActiveCompany)
  const activeCompanyId  = useCompanyStore(s => s.activeCompany?.id ?? null)
  const [companies, setCompanies]   = useState<Company[]>([])
  const [loading, setLoading]       = useState(false)
  const [migrating, setMigrating]   = useState<string | null>(null)
  const [toggling, setToggling]     = useState<string | null>(null)
  const [deleting, setDeleting]     = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await companiesApi.getAll()
      setCompanies(data)
    } catch {
      message.error('Error al cargar empresas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSetDefault = async (id: string) => {
    try {
      await companiesApi.setDefault(id)
      message.success('Empresa marcada como predeterminada')
      load()
    } catch {
      message.error('Error al cambiar empresa predeterminada')
    }
  }

  const handleSwitch = (company: Company) => {
    setActiveCompany(company)
    message.success(`Empresa activa: ${company.legalName}`)
  }

  const handleToggleStatus = async (company: Company) => {
    const newStatus = company.status === 'active' ? 'suspended' : 'active'
    setToggling(company.id)
    try {
      await companiesApi.update(company.id, { status: newStatus } as any)
      message.success(newStatus === 'suspended' ? 'Empresa bloqueada' : 'Empresa activada')
      load()
    } catch {
      message.error('Error al cambiar estado de la empresa')
    } finally {
      setToggling(null)
    }
  }

  const handleDelete = async (company: Company) => {
    setDeleting(company.id)
    try {
      await companiesApi.remove(company.id)
      message.success(`Empresa "${company.legalName}" eliminada`)
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Error al eliminar la empresa')
    } finally {
      setDeleting(null)
    }
  }

  const handleMigrate = (company: Company) => {
    Modal.confirm({
      title: 'Migrar datos históricos',
      icon: <DatabaseOutlined style={{ color: '#1faec2' }} />,
      content: (
        <div>
          <p>Esto asignará todos los registros sin empresa (cuentas contables, clientes, facturas, proveedores, etc.) a <b>{company.legalName}</b>.</p>
          <p style={{ color: '#6b7280', fontSize: 12 }}>Operación de una sola vez — segura de ejecutar.</p>
        </div>
      ),
      okText: 'Migrar ahora',
      okButtonProps: { style: { background: '#1faec2' } },
      cancelText: 'Cancelar',
      onOk: async () => {
        setMigrating(company.id)
        try {
          const result: Record<string, number> = await companiesApi.migrateLegacy(company.id)
          const total = Object.values(result).filter(v => v > 0).reduce((a, b) => a + b, 0)
          const details = Object.entries(result)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')
          Modal.success({
            title: '¡Migración completada!',
            content: (
              <div>
                <p><b>{total}</b> registros migrados a {company.legalName}.</p>
                {details && <p style={{ fontSize: 12, color: '#6b7280' }}>{details}</p>}
                <p style={{ marginTop: 8 }}>Recarga la página para ver los datos.</p>
              </div>
            ),
            onOk: () => window.location.reload(),
          })
        } catch (e: any) {
          message.error(e?.response?.data?.message ?? 'Error durante la migración')
        } finally {
          setMigrating(null)
        }
      },
    })
  }

  const columns: ColumnsType<Company> = [
    {
      title: '',
      width: 32,
      render: (_: any, r: Company) => r.isDefault
        ? <StarFilled style={{ color: '#ff7f00' }} />
        : <StarOutlined style={{ color: '#9aa1ab' }} />,
    },
    {
      title: 'Empresa',
      dataIndex: 'legalName',
      render: (v: string, r: Company) => (
        <div>
          <Space>
            <BankOutlined style={{ color: '#1faec2' }} />
            <span style={{ fontWeight: 600 }}>{v}</span>
            {r.id === activeCompanyId && <Tag color="#1faec2" style={{ marginLeft: 4 }}>Activa</Tag>}
          </Space>
          {r.tradeName && r.tradeName !== v && (
            <div style={{ color: '#6b7280', fontSize: 11, marginLeft: 20 }}>{r.tradeName}</div>
          )}
        </div>
      ),
    },
    {
      title: 'ID Organización',
      width: 140,
      render: (_: any, r: Company) => (
        <Tag
          color="cyan"
          style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
          onClick={() => { navigator.clipboard.writeText(formatOrgId(r)); message.success('ID copiado') }}
        >
          {formatOrgId(r)}
        </Tag>
      ),
    },
    {
      title: 'NIT / Tax ID',
      width: 130,
      render: (_: any, r: Company) => r.taxId
        ? <span><b style={{ color: '#6b7280' }}>{r.taxIdLabel || 'ID'}:</b> {r.taxId}</span>
        : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'País',
      width: 70,
      render: (_: any, r: Company) => (
        <Space size={4}>
          <Tag style={{ margin: 0, fontSize: 11 }}>{r.countryCode}</Tag>
          <span style={{ color: '#9aa1ab', fontSize: 11 }}>{r.currencyCode}</span>
        </Space>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 110,
      render: (v: string) => <Badge status={STATUS_COLOR[v] as any} text={STATUS_LABEL[v] || v} />,
    },
    {
      title: 'Acciones',
      width: 240,
      render: (_: any, r: Company) => (
        <Space>
          <Button size="small" onClick={() => handleSwitch(r)}>Usar</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/configuracion/empresas/${r.id}`)}>Editar</Button>
          {!r.isDefault && (
            <Popconfirm title="¿Marcar como empresa predeterminada?" onConfirm={() => handleSetDefault(r.id)}>
              <Button size="small" icon={<StarOutlined />} />
            </Popconfirm>
          )}
          <Popconfirm
            title={r.status === 'active' ? '¿Bloquear esta empresa?' : '¿Activar esta empresa?'}
            description={r.status === 'active' ? 'Los usuarios no podrán operar con ella.' : 'Volverá a estar disponible para operar.'}
            onConfirm={() => handleToggleStatus(r)}
            okText="Sí"
            cancelText="No"
          >
            <Button
              size="small"
              icon={r.status === 'active' ? <StopOutlined /> : <CheckCircleOutlined />}
              loading={toggling === r.id}
              title={r.status === 'active' ? 'Bloquear empresa' : 'Activar empresa'}
            />
          </Popconfirm>
          {!r.isDefault && (
            <Popconfirm
              title="¿Eliminar esta empresa?"
              description="Se eliminarán todos sus datos. Esta acción no se puede deshacer."
              onConfirm={() => handleDelete(r)}
              okText="Eliminar"
              okButtonProps={{ danger: true }}
              cancelText="Cancelar"
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={deleting === r.id}
                title="Eliminar empresa"
              />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const handleDiagnose = async () => {
    try {
      const data = await companiesApi.diagnoseData()
      Modal.info({
        title: 'Diagnóstico de datos',
        width: 600,
        content: (
          <pre style={{ fontSize: 11, maxHeight: 400, overflow: 'auto', background: '#fafbfc', padding: 12, borderRadius: 4 }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        ),
      })
    } catch (e: any) {
      const status  = e?.response?.status
      const detail  = e?.response?.data?.message ?? e?.message ?? String(e)
      Modal.error({
        title: `Error diagnóstico (HTTP ${status ?? 'sin respuesta'})`,
        content: <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap' }}>{detail}</pre>,
      })
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Empresas</Title>
        <Button type="primary" icon={<PlusOutlined />} style={{ background: '#1faec2' }}
          onClick={() => navigate('/configuracion/empresas/nueva')}>
          Nueva Empresa
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={companies}
        loading={loading}
        size="small"
        pagination={false}
        rowClassName={(r) => r.id === activeCompanyId ? 'ant-table-row-selected' : ''}
      />
    </div>
  )
}
