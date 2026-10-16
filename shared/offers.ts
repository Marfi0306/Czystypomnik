import {z} from 'zod';
export const offerSchema=z.object({
 scope:z.string().trim().min(20).max(4000),
 bankAccount:z.string().transform(v=>v.replace(/\s/g,'')).refine(v=>{if(!/^(PL)?\d{26}$/.test(v))return false;const n=v.replace(/^PL/,'');return BigInt(n.slice(2)+'2521'+n.slice(0,2))%97n===1n;},'Podaj poprawny rachunek spółki (26 cyfr z poprawną sumą kontrolną)'),
 validUntil:z.iso.datetime({offset:true}),depositDue:z.iso.datetime({offset:true}),
 price:z.number().int().positive(),deposit:z.number().int().positive(),
}).strict().refine(v=>v.deposit<=v.price,'Zaliczka nie może przekraczać ceny').refine(v=>Date.parse(v.validUntil)>Date.now(),'Oferta musi być ważna w przyszłości').refine(v=>Date.parse(v.depositDue)>=Date.parse(v.validUntil),'Termin zaliczki nie może być wcześniejszy niż ważność oferty');
export const contractSchema=z.object({offerId:z.uuid(),acceptedAt:z.iso.datetime({offset:true}),acceptanceEmail:z.string().trim().min(30).max(16000),emailMessageId:z.string().trim().min(3).max(500),verifiedSender:z.literal(true),earlyStartEvidence:z.string().max(4000).default('')}).strict();
