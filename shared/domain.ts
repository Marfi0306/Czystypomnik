import { z } from 'zod';
export function normalizePhone(value:string){
 const phone=value.trim().replace(/[\s().-]/g,'');
 if(/^\d{9}$/.test(phone))return '+48'+phone;
 if(/^48\d{9}$/.test(phone))return '+'+phone;
 if(/^00[1-9]\d{7,14}$/.test(phone))return '+'+phone.slice(2);
 return phone;
}
export const packages = [
  { id: 'silver', name: 'Silver', price: 19900, deposit: 5000, weight: 1, description: 'Czysty nagrobek. Uporządkowane otoczenie.', features: ['Ręczne mycie pojedynczego nagrobka', 'Zebranie liści i drobnych chwastów', 'Usunięcie wskazanych zniczy i kwiatów', 'Zdjęcia przed i po wykonaniu'] },
  { id: 'gold', name: 'Gold', price: 29900, deposit: 7500, weight: 1, description: 'Pielęgnacja z kwiatami i światłem pamięci.', features: ['Wszystko, co zawiera pakiet Silver', 'Chryzantema w doniczce 19 cm', 'Dwa nowe szklane znicze', 'Ustawienie i zapalenie zniczy'] },
  { id: 'platinum', name: 'Platinum', price: 44900, deposit: 15000, weight: 1, description: 'Pełna troska o miejsce pamięci.', features: ['Mycie i porządkowanie jak w Silver', 'Dwie chryzantemy', 'Stroik sztuczny', 'Trzy nowe szklane znicze'] },
] as const;
export const money = (value: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value / 100);
export const localDate = (now = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
export const dateLabel = (date: string) => new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Warsaw' }).format(new Date(date + 'T12:00:00+01:00'));
export const placesLabel = (n: number | null) => n === null ? 'Dostępny dzień' : `${n} ${n === 1 ? 'wolne miejsce' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'wolne miejsca' : 'wolnych miejsc'}`;
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(v + 'T12:00:00Z'); return !isNaN(+d) && d.toISOString().slice(0, 10) === v; }, 'Nieprawidłowa data');
export const orderSchema = z.object({
  idempotencyKey: z.uuid(), packageId: z.string().min(1).max(80), cemeteryId: z.string().min(1).max(80), date: z.union([dateSchema,z.literal('')]).optional(),
  quotedPrice: z.number().int().positive(), quotedDeposit: z.number().int().positive(),
  variant: z.literal('single-granite'), location: z.string().trim().min(20, 'Opisz dojście do grobu (co najmniej 20 znaków)').max(1000),
  inscription: z.string().trim().min(3, 'Podaj imię i nazwisko z tablicy').max(300), sector: z.string().max(80).default(''), row: z.string().max(80).default(''), grave: z.string().max(80).default(''),
  name: z.string().trim().min(1, 'Podaj swoje imię i nazwisko').max(150),
  phone: z.string().transform(normalizePhone).refine(v => v.startsWith('+48') ? /^\+48\d{9}$/.test(v) : /^\+[1-9]\d{7,14}$/.test(v), 'Wpisz 9 cyfr polskiego numeru lub numer zagraniczny z kodem kraju, np. +44…'),
  email: z.email('Podaj poprawny e-mail').max(254), notes: z.string().max(2000).default(''),
  terms: z.literal(true, 'Zaakceptuj regulamin obsługi zgłoszeń'), earlyStart: z.literal(false).default(false), documentsVersion: z.string().min(1).max(80), website: z.string().max(0).default(''),
}).strict().superRefine((v, ctx) => {
  const today = localDate();
  if (v.date && v.date < today) ctx.addIssue({ code: 'custom', path: ['date'], message: 'Wybierz przyszły dzień' });
});
export type OrderInput = z.input<typeof orderSchema>;
export type Package = { id: string; name: string; price: number; deposit: number; weight: number; description: string; features: readonly string[] };
export type Cemetery = { id: string; name: string; address: string };
export type Day = { date: string; remaining: number | null; closed: boolean };
export type Business = { name: string; address: string; nip: string; phone: string; email: string; krs?: string; regon?: string; shareCapital?: string; registryCourt?: string };
export type Config = { mode: 'demo' | 'production'; packages: Package[]; cemeteries: Cemetery[]; documentsVersion: string; documentsApproved?: boolean; mailMode?: 'manual' | 'resend'; business: Business; documents: Record<string, string> };
export const statusLabels: Record<string, string> = { pending: 'Zgłoszenie / oferta', accepted: 'Umowa zawarta', scheduled: 'Zaplanowane', in_progress: 'W realizacji', completed: 'Zrealizowane', rejected: 'Odrzucone', cancelled: 'Anulowane', expired: 'Wygasłe' };
