import { supabase } from "@/integrations/supabase/client";

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'chargeback' | 'cancelled';

export interface Payment {
  id: string;
  transaction_id: string;
  status: PaymentStatus;
  amount: number;
  customer_name: string | null;
  customer_email: string | null;
  payment_method: string | null;
  gateway: string | null;
  raw_payload: any;
  event_type: string | null;
  product_name: string | null;
  event_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookLog {
  id: string;
  payload: any;
  status: 'received' | 'processed' | 'error';
  ip_address: string | null;
  error_message: string | null;
  gateway: string | null;
  received_at: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: string | null;
  read: boolean | null;
  payment_id: string | null;
  created_at: string;
}

export interface GatewayConfig {
  id: string;
  name: string;
  display_name: string | null;
  icon: string | null;
  color: string | null;
  secret_key: string;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export async function updateGatewayDisplayName(id: string, displayName: string) {
  return supabase.from('gateway_configs').update({ display_name: displayName }).eq('id', id);
}

export async function updateGatewayIcon(id: string, icon: string) {
  return supabase.from('gateway_configs').update({ icon }).eq('id', id);
}

export async function updateGatewayColor(id: string, color: string) {
  return supabase.from('gateway_configs').update({ color } as any).eq('id', id);
}

export async function fetchPayments(filters?: {
  status?: PaymentStatus;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  gateway?: string;
}) {
  let query = supabase.from('payments').select('*').order('created_at', { ascending: false });
  
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.gateway) query = query.eq('gateway', filters.gateway);
  if (filters?.search) query = query.or(`transaction_id.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,product_name.ilike.%${filters.search}%`);
  if (filters?.dateFrom) query = query.gte('created_at', filters.dateFrom);
  if (filters?.dateTo) query = query.lte('created_at', filters.dateTo);
  
  return query;
}

export async function fetchWebhookLogs() {
  return supabase.from('webhook_logs').select('*').order('received_at', { ascending: false });
}

export async function fetchNotifications() {
  return supabase.from('notifications').select('*').order('created_at', { ascending: false });
}

export async function markNotificationRead(id: string) {
  return supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function markAllNotificationsRead() {
  return supabase.from('notifications').update({ read: true }).eq('read', false);
}

export async function fetchGatewayConfigs() {
  return supabase.from('gateway_configs').select('*').order('created_at', { ascending: false });
}

export async function createGatewayConfig(data: { name: string; secret_key: string; user_id: string }) {
  return supabase.from('gateway_configs').insert(data);
}

export async function deleteGatewayConfig(id: string) {
  // Pega o nome para apagar os dados vinculados a este gateway.
  const { data: config } = await supabase.from('gateway_configs').select('name').eq('id', id).single();
  if (config) {
    // Casa o nome ignorando caixa e espaços — os webhooks podem ter gravado o
    // gateway com capitalização diferente (ex.: "MEDUSA PAY" vs "Medusa Pay"),
    // e um .eq() exato deixava esses registros orfãos, que "voltavam" ao recriar.
    const target = config.name.trim().toLowerCase();
    const matches = (g: string | null) => (g || '').trim().toLowerCase() === target;

    const { data: pays } = await supabase.from('payments').select('id, gateway');
    const payIds = (pays || []).filter(p => matches(p.gateway)).map(p => p.id);
    if (payIds.length) {
      // Apaga as notificações vinculadas antes dos pagamentos.
      await supabase.from('notifications').delete().in('payment_id', payIds);
      await supabase.from('payments').delete().in('id', payIds);
    }

    const { data: logs } = await supabase.from('webhook_logs').select('id, gateway');
    const logIds = (logs || []).filter(l => matches(l.gateway)).map(l => l.id);
    if (logIds.length) await supabase.from('webhook_logs').delete().in('id', logIds);
  }
  return supabase.from('gateway_configs').delete().eq('id', id);
}

export async function deleteAllNotifications() {
  return supabase.from('notifications').delete().neq('id', '');
}

export async function deleteAllWebhookLogs() {
  return supabase.from('webhook_logs').delete().neq('id', '');
}

export async function fetchPaymentStats(gateway?: string) {
  let query = supabase.from('payments').select('status, amount, gateway');
  if (gateway) query = query.eq('gateway', gateway);
  const { data } = await query;
  if (!data) return { paid: 0, pending: 0, failed: 0, total: 0 };
  
  return {
    paid: data.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0),
    pending: data.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount), 0),
    failed: data.filter(p => p.status === 'failed').length,
    total: data.reduce((sum, p) => sum + Number(p.amount), 0),
  };
}

export async function fetchPaymentStatsByGateway() {
  const { data } = await supabase.from('payments').select('status, amount, gateway');
  if (!data) return {};
  
  const byGateway: Record<string, { paid: number; pending: number; failed: number; total: number; count: number }> = {};
  
  for (const p of data) {
    const gw = p.gateway || "Desconhecido";
    if (!byGateway[gw]) byGateway[gw] = { paid: 0, pending: 0, failed: 0, total: 0, count: 0 };
    byGateway[gw].count++;
    byGateway[gw].total += Number(p.amount);
    if (p.status === 'paid') byGateway[gw].paid += Number(p.amount);
    if (p.status === 'pending') byGateway[gw].pending += Number(p.amount);
    if (p.status === 'failed') byGateway[gw].failed++;
  }
  
  return byGateway;
}

export function exportPaymentsCSV(payments: Payment[]) {
  const headers = ['ID', 'Transaction ID', 'Status', 'Amount', 'Customer', 'Email', 'Product', 'Method', 'Gateway', 'Event Time', 'Date'];
  const rows = payments.map(p => [
    p.id, p.transaction_id, p.status, p.amount, p.customer_name || '', p.customer_email || '',
    p.product_name || '', p.payment_method || '', p.gateway || '', p.event_time || '', p.created_at
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
