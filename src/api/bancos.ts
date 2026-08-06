import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

export type BankAccountType = 'checking' | 'savings' | 'credit_card' | 'petty_cash' | 'investment' | 'other'
export type BankAccountStatus = 'active' | 'inactive'
export type TransactionType = 'credit' | 'debit'
export type TransactionStatus = 'pending' | 'categorized' | 'matched' | 'reconciled' | 'excluded' | 'voided'
export type BankTransferStatus = 'draft' | 'posted' | 'voided'
export type BankRuleApplyTo = 'all' | 'credit' | 'debit'
export type BankRuleMatchMode = 'all' | 'any'

export interface BankAccount {
  id: string
  companyId: string
  name: string
  description?: string
  type: BankAccountType
  status: BankAccountStatus
  isPrimary: boolean
  bankName?: string
  branchName?: string
  accountNumber?: string
  routingNumber?: string
  swiftCode?: string
  iban?: string
  currency: string
  openingBalance: number
  openingBalanceDate?: string
  currentBalance: number
  bankBalance?: number
  glAccountId?: string
  glAccountCode?: string
  glAccountName?: string
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
  feedsEnabled: boolean
  feedsLastRefreshAt?: string
  lastStatementDate?: string
  uncategorizedCount?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface BankTransaction {
  id: string
  companyId: string
  bankAccountId: string
  transactionDate: string
  description: string
  type: TransactionType
  amount: number
  currency?: string
  exchangeRate?: number
  baseAmount?: number
  runningBalance?: number
  status: TransactionStatus
  reference?: string
  matchedInvoiceId?: string
  matchedPaymentId?: string
  matchedJournalEntryId?: string
  accountId?: string
  accountCode?: string
  accountName?: string
  sourceDocumentType?: string
  sourceDocumentId?: string
  importedAt: string
}

export interface BankSummary {
  totalAccounts: number
  totalBalance: number
  accountsByType: Record<string, { count: number; balance: number; currency: string }>
  accounts: BankAccount[]
}

export interface BankTransferDto {
  companyId: string
  fromAccountId: string
  toAccountId: string
  amount: number
  currency: string
  exchangeRate?: number
  transferDate: string
  reference?: string
  notes?: string
}

export interface BankTransfer extends BankTransferDto {
  id: string
  status: BankTransferStatus
  createdAt: string
}

export interface BankImportBatch {
  id: string
  companyId: string
  bankAccountId: string
  fileName?: string
  fileType?: string
  totalRows: number
  importedCount: number
  skippedCount: number
  rulesAppliedCount?: number
  status: 'completed' | 'failed'
  createdAt: string
}

export interface BankRuleCondition {
  field: 'description' | 'reference' | 'amount' | 'type' | 'currency'
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'gt' | 'gte' | 'lt' | 'lte'
  value: string | number
}

export interface BankRuleAction {
  accountId?: string
  accountCode?: string
  accountName?: string
  sourceDocumentType?: string
  sourceDocumentId?: string
  costCenterId?: string
  projectId?: string
  status?: TransactionStatus
}

export interface BankRule {
  id: string
  companyId: string
  name: string
  isActive: boolean
  bankAccountId?: string
  applyTo: BankRuleApplyTo
  matchMode: BankRuleMatchMode
  conditions: BankRuleCondition[]
  action: BankRuleAction
  timesApplied: number
  lastAppliedAt?: string
  createdAt: string
  updatedAt: string
}

export interface ReconciliationSummary {
  pending: number
  matched?: number
  categorized?: number
  reconciled: number
  excluded?: number
  total: number
}

const BASE = '/bancos/cuentas'
const RECONCILIATION_BASE = '/bancos/conciliacion'
const TRANSFERS_BASE = '/bancos/transferencias'
const RULES_BASE = '/bancos/reglas'

export const moneyGT = (n: number) =>
  `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const money = (n: number, currency = 'GTQ') =>
  `${currency === 'GTQ' ? 'Q' : currency} ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const getBankAccounts = (params?: { search?: string; status?: string; type?: string; companyId?: string }) =>
  api.get(BASE, { params }).then(unwrap) as Promise<BankAccount[]>

export const getBankSummary = (params?: { companyId?: string }) =>
  api.get(`${BASE}/resumen`, { params }).then(unwrap) as Promise<BankSummary>

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

export const getTransactions = (id: string, params?: {
  page?: number
  limit?: number
  search?: string
  status?: string
  type?: string
  fromDate?: string
  toDate?: string
}) =>
  api.get(`${BASE}/${id}/movimientos`, { params }).then(unwrap) as Promise<{
    data: BankTransaction[]
    total: number
    page: number
    limit: number
  }>

export const addTransaction = (id: string, dto: Partial<BankTransaction>) =>
  api.post(`${BASE}/${id}/movimientos`, dto).then(unwrap) as Promise<BankTransaction>

export const updateTransaction = (id: string, txId: string, dto: Partial<BankTransaction>) =>
  api.patch(`${BASE}/${id}/movimientos/${txId}`, dto).then(unwrap) as Promise<BankTransaction>

export const deleteTransaction = (id: string, txId: string) =>
  api.delete(`${BASE}/${id}/movimientos/${txId}`)

export const importStatement = (id: string, dto: {
  rows: Partial<BankTransaction>[]
  fileName?: string
  fileType?: string
}) =>
  api.post(`${BASE}/${id}/importar`, dto).then(unwrap) as Promise<{ imported: number; skipped: number; importBatchId?: string }>

export const getImportHistory = (id: string, params?: { page?: number; limit?: number }) =>
  api.get(`${BASE}/${id}/importaciones`, { params }).then(unwrap) as Promise<{
    data: BankImportBatch[]
    total: number
    page: number
    limit: number
  }>

export const syncBankAccount = (id: string) =>
  api.post(`${BASE}/${id}/sincronizar`).then(unwrap)

export const getReconciliationSummary = (accountId: string) =>
  api.get(`${RECONCILIATION_BASE}/${accountId}/resumen`).then(unwrap) as Promise<ReconciliationSummary>

export const getPendingReconciliation = (accountId: string, params?: { page?: number; limit?: number; search?: string; status?: string }) =>
  api.get(`${RECONCILIATION_BASE}/${accountId}/pendientes`, { params }).then(unwrap) as Promise<{
    data: BankTransaction[]
    total: number
    page: number
    limit: number
  }>

export const unreconcileTransaction = (dto: { transactionId: string }) =>
  api.post(`${RECONCILIATION_BASE}/desconciliar`, dto).then(unwrap)

// ── Historial de períodos conciliados ──────────────────────────────────────────

export interface ReconciliationPeriod {
  id: string
  bankAccountId: string
  year: number
  month: number
  status: 'draft' | 'closed' | 'approved'
  saldoBanco: number
  saldoSistema: number
  diferencia: number
  totalCredito: number
  totalDebito: number
  totalTransactions: number
  reconciledCount: number
  pendingCount: number
  closedById?: string
  closedByName?: string
  approvedById?: string
  approvedByName?: string
  closedAt?: string
  approvedAt?: string
  notes?: string
  createdAt: string
}

export const listReconciliationPeriods = (accountId: string) =>
  api.get(`${RECONCILIATION_BASE}/${accountId}/periodos`).then(unwrap) as Promise<ReconciliationPeriod[]>

export const saveReconciliationPeriod = (accountId: string, dto: {
  month: number; year: number
  saldoBanco: number; saldoSistema: number; diferencia: number
  totalCredito: number; totalDebito: number
  totalTransactions: number; reconciledCount: number; pendingCount: number
  notes?: string
}) =>
  api.post(`${RECONCILIATION_BASE}/${accountId}/periodos`, dto).then(unwrap) as Promise<ReconciliationPeriod>

export const approveReconciliationPeriod = (accountId: string, periodId: string) =>
  api.patch(`${RECONCILIATION_BASE}/${accountId}/periodos/${periodId}/aprobar`).then(unwrap) as Promise<ReconciliationPeriod>

export const autoMatchReconciliation = (accountId: string) =>
  api.post(`${RECONCILIATION_BASE}/auto-match/${accountId}`).then(unwrap) as Promise<{ matched: number; message?: string }>

export const reconcileTransaction = (dto: {
  transactionId: string
  invoiceId?: string
  paymentId?: string
  journalEntryId?: string
  accountId?: string
}) =>
  api.post(`${RECONCILIATION_BASE}/conciliar`, dto).then(unwrap)

export const createBankTransfer = (dto: BankTransferDto) =>
  api.post(TRANSFERS_BASE, dto).then(unwrap) as Promise<BankTransfer>

export const getBankTransfers = (params?: { page?: number; limit?: number; search?: string }) =>
  api.get(TRANSFERS_BASE, { params }).then(unwrap) as Promise<{
    data: BankTransfer[]
    total: number
    page: number
    limit: number
  }>

export const getBankRules = (params?: { page?: number; limit?: number; search?: string; bankAccountId?: string; isActive?: boolean }) =>
  api.get(RULES_BASE, { params }).then(unwrap) as Promise<{
    data: BankRule[]
    total: number
    page: number
    limit: number
  }>

export const createBankRule = (dto: Partial<BankRule>) =>
  api.post(RULES_BASE, dto).then(unwrap) as Promise<BankRule>

export const updateBankRule = (id: string, dto: Partial<BankRule>) =>
  api.patch(`${RULES_BASE}/${id}`, dto).then(unwrap) as Promise<BankRule>

export const deleteBankRule = (id: string) =>
  api.delete(`${RULES_BASE}/${id}`)

export const applyBankRules = (dto: { bankAccountId?: string; ruleId?: string; transactionIds?: string[] }) =>
  api.post(`${RULES_BASE}/aplicar`, dto).then(unwrap) as Promise<{ reviewed: number; applied: number }>

export const ACCOUNT_TYPE_CONFIG: Record<BankAccountType, { label: string; color: string; icon: string }> = {
  checking: { label: 'Cuenta monetaria', color: '#1faec2', icon: 'B' },
  savings: { label: 'Cuenta de ahorro', color: '#2ea172', icon: 'A' },
  credit_card: { label: 'Tarjeta de credito', color: '#e5484d', icon: 'T' },
  petty_cash: { label: 'Caja chica', color: '#ff7f00', icon: 'C' },
  investment: { label: 'Inversion', color: '#6b7280', icon: 'I' },
  other: { label: 'Otra', color: '#6b7280', icon: 'O' },
}

export const TRANSACTION_STATUS_CONFIG: Record<TransactionStatus, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: '#ff7f00' },
  categorized: { label: 'Categorizada', color: '#1faec2' },
  matched: { label: 'Con coincidencia', color: '#6b7280' },
  reconciled: { label: 'Conciliada', color: '#2ea172' },
  excluded: { label: 'Excluida', color: 'default' },
  voided: { label: 'Anulada', color: '#e5484d' },
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
  'Banco de America Central (BAC)',
  'Vivibanco',
  'Otro',
]
