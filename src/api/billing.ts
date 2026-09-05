import api from './axios'

const unwrap = (r: any) => r.data?.data ?? r.data

// ── Tipos ────────────────────────────────────────────────────────────────────

export type BillingCurrency = 'USD' | 'GTQ'
export type CardType = 'visa' | 'mastercard'
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing' | 'procesando_pago'
export type PaymentResult = 'approved' | 'declined' | 'pending' | 'error'

export interface PlanConfig {
  plan: string
  displayName: string
  priceMonthly: number
  currency: string
  maxCompanies: number
  maxUsers: number
  maxBranches: number
  features: string[]
  isActive: boolean
}

export interface SubscriptionInfo {
  id: string
  tenantId: string
  plan: string
  status: SubscriptionStatus
  monthlyPrice: number
  currency: string
  billingCurrency: BillingCurrency
  billingAmountLocal: number
  currentPeriodStart?: string
  currentPeriodEnd?: string
  nextChargeAt?: string
  lastChargedAt?: string
  lastChargeStatus?: string
  qpayproCardToken?: string
  qpayproCardLast4?: string
  qpayproCardBrand?: string
  cardHolderName?: string
  idSuscripcionQpaypro?: number
  idTokenTarjetaQpaypro?: number
  cancelledAt?: string
  maxCompanies: number
}

export interface SubscriptionPayment {
  id: string
  result: PaymentResult
  amount: number
  currency: BillingCurrency
  plan: string
  qpayproTransactionId?: string
  qpayproResponseCode?: string
  qpayproResponseMessage?: string
  cardLast4?: string
  cardBrand?: string
  chargedAt: string
  felUuid?: string
  felSerie?: string
  felNumero?: string
  felInvoiceUrl?: string
}

export interface BillingState {
  subscription: SubscriptionInfo | null
  tenant: { id: string; name: string; email?: string; plan: string; status: string; trialEndsAt?: string }
  plans: PlanConfig[]
  paymentHistory: SubscriptionPayment[]
  exchangeRateGTQ?: number
  sandboxMode?: boolean
}

export interface SubscribeDto {
  plan: string
  currency: BillingCurrency
  ccNumber: string
  expMonth: string
  expYear: string
  cvv: string
  cardType: CardType
  holderName: string
  email?: string
  phone?: string
}

// ── Plan color helper (dinámico, sin hardcodear claves) ──────────────────────
// Paleta ordenada por precio ascendente: index 0 = más barato/gratis, último = más caro.
const PLAN_PALETTE = ['default', '#1B3A6B', '#1faec2', '#ff7f00', 'gold', 'purple', 'magenta']

export function planColorByIndex(planKey: string, plans: PlanConfig[]): string {
  const sorted = [...plans].sort((a, b) => a.priceMonthly - b.priceMonthly)
  const idx = sorted.findIndex(p => p.plan === planKey)
  return PLAN_PALETTE[idx < 0 ? 0 : Math.min(idx, PLAN_PALETTE.length - 1)]
}

// ── API calls ────────────────────────────────────────────────────────────────

export const getBillingState = (): Promise<BillingState> =>
  api.get('/billing/subscription').then(unwrap)

export interface PaymentResponse {
  success: boolean
  message: string
  paymentId?: string
  amountCharged?: number
}

export const subscribePlan = (dto: SubscribeDto): Promise<PaymentResponse> =>
  api.post('/billing/subscribe', dto).then(unwrap)

export const changePlan = (plan: string, currency: BillingCurrency): Promise<PaymentResponse> =>
  api.post('/billing/change-plan', { plan, currency }).then(unwrap)

export const cancelSubscription = (): Promise<{ success: boolean; message: string }> =>
  api.post('/billing/cancel').then(unwrap)

export const getGtqExchangeRate = (): Promise<{ rate: number; updatedAt?: string; updatedBy?: string }> =>
  api.get('/billing/exchange-rate').then(unwrap)

export const setGtqExchangeRate = (rate: number): Promise<{ rate: number }> =>
  api.patch('/billing/exchange-rate', { rate }).then(unwrap)

export interface RequestInvoiceDto {
  subscriptionPaymentId: string
  customerTaxId: string   // NIT o "CF"
  customerName: string
  customerEmail?: string
  customerAddress?: string
  currency?: BillingCurrency
}

export interface BillingFelResult {
  success: boolean
  message: string
  felUuid?: string
  felSerie?: string
  felNumero?: string
  felInvoiceUrl?: string
  simulated?: boolean
}

export const requestBillingInvoice = (dto: RequestInvoiceDto): Promise<BillingFelResult> =>
  api.post('/billing/request-invoice', dto).then(unwrap)

export const simulateSubscription = (plan: string): Promise<{ success: boolean; message: string }> =>
  api.post('/billing/simulate', { plan }).then(unwrap)

export const deletePayment = (id: string): Promise<{ deleted: boolean }> =>
  api.delete(`/billing/payment/${id}`).then(unwrap)

// ── Cobros Automáticos QPayPro ────────────────────────────────────────────────

export interface TokenizarTarjetaPayload {
  datosCliente: {
    firstName: string
    lastName: string
    email: string
    telefono: string
    nit: string
    ciudad?: string
  }
  ccNumber: string
  expMonth: string
  expYear: string
  ccCvv2: string
  cardType: CardType
  plan?: string
}

export interface ActivarCobrosResult {
  success: boolean
  idSuscripcionQpaypro: number
  message: string
}

export const tokenizarTarjeta = (dto: TokenizarTarjetaPayload): Promise<{ tokenId: number }> =>
  api.post('/billing/cobros/tokenizar-tarjeta', dto).then(unwrap)

export const activarCobros = (): Promise<ActivarCobrosResult> =>
  api.post('/billing/cobros/activar').then(unwrap)

// ── Admin billing API (solo SuperAdmin) ──────────────────────────────────────

export interface TenantBillingPayment {
  id: string
  result: PaymentResult
  amount: number
  currency: string
  plan: string
  qpayproTransactionId?: string
  qpayproResponseCode?: string
  qpayproResponseMessage?: string
  cardLast4?: string
  cardBrand?: string
  chargedAt: string
  felUuid?: string
  felSerie?: string
  felNumero?: string
  felInvoiceUrl?: string
  felStatus?: string
}

export interface TenantBillingInfo {
  subscription: SubscriptionInfo | null
  payments: TenantBillingPayment[]
  customMonthlyPriceUSD: number | null
  trialEndsAt: string | null
  trialDaysLeft: number | null
}

export const adminActivateTrial = (tenantId: string, days = 30): Promise<{ trialEndsAt: string; daysLeft: number }> =>
  api.post(`/admin/tenants/${tenantId}/trial`, { days }).then(unwrap)

export const adminSetBillingConfig = (tenantId: string, dto: { customMonthlyPriceUSD?: number | null }): Promise<{ updated: boolean }> =>
  api.patch(`/admin/tenants/${tenantId}/billing-config`, dto).then(unwrap)

export const adminGetTenantBilling = (tenantId: string): Promise<TenantBillingInfo> =>
  api.get(`/admin/tenants/${tenantId}/billing`).then(unwrap)

export const adminRequestInvoiceForTenant = (paymentId: string, dto: RequestInvoiceDto): Promise<BillingFelResult> =>
  api.post(`/billing/admin/payments/${paymentId}/invoice`, dto).then(unwrap)

// Comprobante de pago (voucher) de un cobro de suscripción
export interface ComprobantePago {
  id: string
  qpayproTransactionId?: string
  qpayproAuditNumber?: string
  qpayproResponseCode?: string
  cardBrand?: string
  cardLast4?: string
  amount: number
  currency: string
  plan: string
  result: string
  chargedAt: string
  clienteNombre: string
  clienteNit?: string
  clienteEmail?: string
  planNombre?: string
}
export const getComprobantePago = (paymentId: string): Promise<ComprobantePago> =>
  api.get(`/billing/admin/payments/${paymentId}/comprobante`).then(unwrap)

// Voucher del propio cobro (cliente): scoped al tenant del solicitante.
export const getMiComprobantePago = (paymentId: string): Promise<ComprobantePago> =>
  api.get(`/billing/payments/${paymentId}/comprobante`).then(unwrap)
