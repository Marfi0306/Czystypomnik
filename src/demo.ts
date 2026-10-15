import { packages, type Config, type Day } from '../shared/domain';
export const demoConfig: Config = { mode: 'demo', packages: packages.map(p => ({ ...p })), cemeteries: [{ id: 'demo', name: 'Cmentarz przykładowy w Warszawie', address: 'Dane demonstracyjne — nie stanowią oferty terminu' }], documentsVersion: 'draft-2026-10-15', business: { name: '', nip: '', address: '', phone: '+48693429991', email: '' }, documents: {} };
export const demoDays: Day[] = Array.from({ length: 8 }, (_, i) => ({ date: `2026-10-${24 + i}`, remaining: null, closed: false }));
