import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Button, Tag, Space, Popconfirm, message, Typography, Badge,
} from 'antd'
import {
  PlusOutlined, EditOutlined, StarOutlined, StarFilled, BankOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { companiesApi } from '../../../api/companies'
import type { Company } from '../../../store/authStore'
import { useAuthStore } from '../../../store/authStore'

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
  const setActiveCompany = useAuthStore(s => s.setActiveCompany)
  const activeCompanyId  = useAuthStore(s => s.activeCompanyId)
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading]     = useState(false)

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
      width: 200,
      render: (_: any, r: Company) => (
        <Space>
          <Button size="small" onClick={() => handleSwitch(r)}>Usar</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/configuracion/empresas/${r.id}`)}>Editar</Button>
          {!r.isDefault && (
            <Popconfirm title="¿Marcar como empresa predeterminada?" onConfirm={() => handleSetDefault(r.id)}>
              <Button size="small" icon={<StarOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Empresas</Title>
        <Button type="primary" icon={<PlusOutlined />} style={{ background: '#1B3A6B' }}
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
