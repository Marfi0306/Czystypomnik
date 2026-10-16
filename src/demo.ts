import { packages, type Config, type Day } from '../shared/domain';
import content from '../shared/site-content.json';
export const demoConfig: Config = { mode: 'demo', packages: packages.map(p => ({ ...p })), cemeteries: [{ id: 'demo', name: 'Cmentarz przykładowy w Warszawie', address: 'Dane demonstracyjne — nie stanowią oferty terminu' }], documentsVersion: content.documents_version, documentsApproved: content.documentsApproved, business: content.business, documents: content.documents };
export const demoDays: Day[] = Array.from({ length: 8 }, (_, i) => ({ date: `2026-10-${24 + i}`, remaining: null, closed: false }));
