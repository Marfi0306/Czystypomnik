import { createClient } from '@supabase/supabase-js';
export const db = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
export async function rpc(name: string, args: Record<string, unknown> = {}) {
  if (!db) throw new Error('NOT_READY');
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
export async function readySettings() {
  if(['COOKIE_SECRET','UPLOAD_SECRET','IP_HASH_SECRET','CRON_SECRET'].some(key=>(process.env[key]||'').length<32))return null;
  if (process.env.BUSINESS_ROLES_CONFIRMED!=='true'||process.env.OPERATIONS_CONFIRMED!=='true'||process.env.SUPABASE_REGION!=='eu-central-1'||process.env.DOCUMENTS_APPROVED!=='true'||!db || process.env.APP_MODE !== 'production' || !process.env.RESEND_API_KEY || !process.env.MAIL_FROM || !process.env.APP_ORIGIN || !process.env.COOKIE_SECRET || !process.env.IP_HASH_SECRET || !process.env.UPLOAD_SECRET || !process.env.ADMIN_EMAILS  || !process.env.CRON_SECRET) return null;
  const { data, error } = await db.from('settings').select('*').eq('id', true).single();
  if (error) throw new Error('DATABASE_UNAVAILABLE');
  if (!data.ready || !data.documents_version || ['name','nip','address','email','phone','krs','regon','shareCapital','registryCourt'].some(k => !data.business[k]) || ['regulamin','prywatnosc','odstapienie','cookies'].some(k => !data.documents[k])) return null;
  return data;
}
