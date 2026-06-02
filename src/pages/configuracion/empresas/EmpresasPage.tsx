import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Tag, Space, Popconfirm, message, Typography, Badge, Modal,
} from 'antd'
import {
  PlusOutlined, EditOutlined, StarOutlined, StarFilled, BankOutlined,
  DatabaseOutlined, BugOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { companiesApi } from '../../../api/companies'
import type { Company } from '../../../store/authStore'
import { useCompanyStore } from '../../../store/companyStore'

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

  const handleMigrate = (company: Company) => {
    Modal.confirm({
      title: 'Migrar datos históricos',
      icon: <DatabaseOutlined style={{ color: '#1B3A6B' }} />,
      content: (
        <div>
          <p>Esto asignará todos los registros sin empresa (cuentas contables, clientes, facturas, proveedores, etc.) a <b>{company.legalName}</b>.</p>
          <p style={{ color: '#888', fontSize: 12 }}>Operación de una sola vez — segura de ejecutar.</p>
        </div>
      ),
      okText: 'Migrar ahora',
      okButtonProps: { style: { background: '#1B3A6B' } },
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
                {details && <p style={{ fontSize: 12, color: '#888' }}>{details}</p>}
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
        ? <StarFilled style={{ color: '#faad14' }} />
        : <StarOutlined style={{ color: '#d9d9d9' }} />,
    },
    {
      title: 'Empresa',
      dataIndex: 'legalName',
      render: (v: string, r: Company) => (
        <Space>
          <BankOutlined />
          <span style={{ fontWeight: 500 }}>{v}</span>
          {r.tradeName && <span style={{ color: '#888', fontSize: 12 }}>({r.tradeName})</span>}
          {r.id === activeCompanyId && <Tag color="blue" style={{ marginLeft: 4 }}>Activa</Tag>}
        </Space>
      ),
    },
    { title: 'No.', dataIndex: 'companyNumber', width: 100 },
    {
      title: 'NIT / Tax ID',
      render: (_: any, r: Company) => r.taxId
        ? <span><b>{r.taxIdLabel || 'ID'}:</b> {r.taxId}</span>
        : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'País / Moneda',
      render: (_: any, r: Company) => `${r.countryCode} · ${r.currencyCode}`,
      width: 110,
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 110,
      render: (v: string) => <Badge status={STATUS_COLOR[v] as any} text={STATUS_LABEL[v] || v} />,
    },
    {
      title: 'Acciones',
      width: 260,
      render: (_: any, r: Company) => (
        <Space>
          <Button size="small" onClick={() => handleSwitch(r)}>Usar</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/configuracion/empresas/${r.id}`)}>Editar</Button>
          {!r.isDefault && (
            <Popconfirm title="¿Marcar como empresa predeterminada?" onConfirm={() => handleSetDefault(r.id)}>
              <Button size="small" icon={<StarOutlined />} />
            </Popconfirm>
          )}
          <Button
            size="small"
            icon={<DatabaseOutlined />}
            loading={migrating === r.id}
            onClick={() => handleMigrate(r)}
            title="Migrar datos históricos"
          />
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
          <pre style={{ fontSize: 11, maxHeight: 400, overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        ),
      })
    } catch {
      message.error('Error al obtener diagnóstico')
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Empresas</Title>
        <Space>
          <Button icon={<BugOutlined />} onClick={handleDiagnose} size="small" style={{ color: '#888' }}>
            Diagnóstico
          </Button>
          <Button type="primary" icon={<PlusOutlined />} style={{ background: '#1B3A6B' }}
            onClick={() => navigate('/configuracion/empresas/nueva')}>
            Nueva Empresa
          </Button>
        </Space>
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
