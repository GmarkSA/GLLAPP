import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export type BankAccountType = 'checking' | 'savings' | 'credit_card' | 'petty_cash' | 'investment' | 'other'
export type BankAccountStatus = 'active' | 'inactive'
export type TransactionType = 'credit' | 'debit'
export type TransactionStatus = 'pending' | 'reconciled' | 'excluded'

export interface BankAccount {
  id:                string
  name:              string
  description?:      string
  type:              BankAccountType
  status:            BankAccountStatus
  isPrimary:         boolean
  bankName?:         string
  branchName?:       string
  accountNumber?:    string
  routingNumber?:    string
  swiftCode?:        string
  iban?:             string
  currency:          string
  openingBalance:    number
  openingBalanceDate?: string
  currentBalance:    number
  bankBalance?:      number
  glAccountId?:      string
  glAccountCode?:    string
  glAccountName?:    string
  contactPerson?:    string
  contactPhone?:     string
  contactEmail?:     string
  feedsEnabled:      boolean
  feedsLastRefreshAt?: string
  lastStatementDate?:  string
  uncategorizedCount?: number
  notes?:            string
  createdAt:         string
  updatedAt:         string
}

export interface BankTransaction {
  id:               string
  bankAccountId:    string
  transactionDate:  string
  description:      string
  type:             TransactionType
  amount:           number
  runningBalance?:  number
  status:           TransactionStatus
  reference?:       string
  matchedInvoiceId?: string
  matchedPaymentId?: string
  matchedJournalEntryId?: string
  accountId?:       string
  importedAt:       string
}

export interface BankSummary {
  totalAccounts:  number
  totalBalance:   number
  accountsByType: Record<string, { count: number; balance: number; currency: string }>
  accounts:       BankAccount[]
}

const BASE = '/bancos/cuentas'

// ── Cuentas ───────────────────────────────────────────────────────────────────
export const getBankAccounts = (params?: { search?: string; status?: string; type?: string }) =>
  api.get(BASE, { params }).then(unwrap) as Promise<BankAccount[]>

export const getBankSummary = () =>
  api.get(`${BASE}/resumen`).then(unwrap) as Promise<BankSummary>

export const getBankAccount = (id: string) =>
  api.get(`${BASE}/${id}`).then(unwrap) as Promise<BankAccount>

export const createBankAccount = (dto: Partial<BankAccount>) =>
  api.post(BASE, dto).then(unwrap) as Promise<BankAccount>

export const updateBankAccount = (id: string, dto: Partial<BankAccount>) =>
  api.patch(`${BASE}/${id}`, dto).then(unwrap) as Promise<BankAccount>

export const deleteBankAccount = (id: string) =>
  api.delete(`${BASE}/${id}`)

export const activateBankAccount = (id: string) =>
  api.post(`${BASE}/${id}/activar`).then(unwrap) as Promise<BankAccount>

export const deactivateBankAccount = (id: string) =>
  api.post(`${BASE}/${id}/desactivar`).then(unwrap) as Promise<BankAccount>

export const refreshBankBalance = (id: string) =>
  api.post(`${BASE}/${id}/actualizar-saldo`).then(unwrap) as Promise<{ balance: number }>

// ── Movimientos ───────────────────────────────────────────────────────────────
export const getTransactions = (id: string, params?: {
  page?: number; limit?: number; search?: string; status?: string;
  fromDate?: string; toDate?: string;
}) =>
  api.get(`${BASE}/${id}/movimientos`, { params }).then(unwrap) as Promise<{
    data: BankTransaction[]; total: number; page: number; limit: number;
  }>

export const addTransaction = (id: string, dto: Partial<BankTransaction>) =>
  api.post(`${BASE}/${id}/movimientos`, dto).then(unwrap) as Promise<BankTransaction>

export const updateTransaction = (id: string, txId: string, dto: Partial<BankTransaction>) =>
  api.patch(`${BASE}/${id}/movimientos/${txId}`, dto).then(unwrap) as Promise<BankTransaction>

export const deleteTransaction = (id: string, txId: string) =>
  api.delete(`${BASE}/${id}/movimientos/${txId}`)

export const importStatement = (id: string, rows: Partial<BankTransaction>[]) =>
  api.post(`${BASE}/${id}/importar`, { rows }).then(unwrap) as Promise<{ imported: number; skipped: number }>

export const syncBankAccount = (id: string) =>
  api.post(`${BASE}/${id}/sincronizar`).then(unwrap)

// ── Helpers ───────────────────────────────────────────────────────────────────
export const ACCOUNT_TYPE_CONFIG: Record<BankAccountType, { label: string; color: string; icon: string }> = {
  checking:    { label: 'Cuenta Monetaria',    color: '#1677ff', icon: '🏦' },
  savings:     { label: 'Cuenta de Ahorro',    color: '#52c41a', icon: '💰' },
  credit_card: { label: 'Tarjeta de Crédito',  color: '#ff4d4f', icon: '💳' },
  petty_cash:  { label: 'Caja Chica',          color: '#fa8c16', icon: '💵' },
  investment:  { label: 'Inversión',           color: '#722ed1', icon: '📈' },
  other:       { label: 'Otra',                color: '#8c8c8c', icon: '🏛️'  },
}

export const BANK_NAMES_GT = [
  'Banco Industrial (BI)',
  'Banco de Desarrollo Rural (Banrural)',
  'G&T Continental',
  'BAC Credomatic',
  'Banco Agromercantil (BAM)',
  'Banco de los Trabajadores (Bantrab)',
  'Banco Promerica',
  'Banco Ficohsa',
  'Banco Azteca',
  'Banco Inmobiliario',
  'Citi Guatemala',
  'HSBC Guatemala',
  'Banco de América Central (BAC)',
  'Vivibanco',
  'Otro',
]
