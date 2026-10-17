import {test} from 'node:test';import assert from 'node:assert/strict';
import {localDate,placesLabel,orderSchema,packages,normalizePhone} from '../shared/domain';
import {offerSchema} from '../shared/offers';
import {messageFor} from '../server/mail';
test('oferta: ceny i zaliczki z zatwierdzonego źródła',()=>{assert.deepEqual(packages.map(p=>[p.price,p.deposit]),[[19900,5000],[29900,7500],[44900,15000]]);});
test('polska granica dnia i zmiana czasu',()=>{assert.equal(localDate(new Date('2026-10-24T22:30:00Z')),'2026-10-25');assert.equal(localDate(new Date('2026-10-25T23:30:00Z')),'2026-10-26');});
test('odmiany wolnych miejsc',()=>{assert.equal(placesLabel(1),'1 wolne miejsce');assert.equal(placesLabel(2),'2 wolne miejsca');assert.equal(placesLabel(12),'12 wolnych miejsc');assert.equal(placesLabel(22),'22 wolne miejsca');assert.equal(placesLabel(null),'Dostępny dzień');});
test('walidacja blokuje spam, nieistniejącą datę i podmianę ceny',()=>{const p={idempotencyKey:crypto.randomUUID(),packageId:'silver',quotedPrice:19900,quotedDeposit:5000,cemeteryId:crypto.randomUUID(),date:'2099-10-26',variant:'single-granite',location:'Od głównej bramy trzecia alejka w prawo',inscription:'Osoba Testowa',name:'A',phone:'+48 600 000 000',email:'test@example.invalid',terms:true,earlyStart:false,documentsVersion:'v1'};assert.equal(orderSchema.safeParse(p).success,true);for(const modified of [{website:'spam'},{date:'2099-02-31'},{price:1},{phone:'123'},{terms:false}])assert.equal(orderSchema.safeParse({...p,...modified}).success,false);});
test('zgłoszenie nie zawiera umowy; oferta nie jest potwierdzeniem umowy',()=>{
 const p:any={number:1,date:'2099-10-26',package:{name:'Silver',price:19900,deposit:5000},cemetery:{name:'Test',address:'Test'},customer:{name:'Test'},grave:{},documents:{version:'v1',texts:{regulamin:'Pełne warunki testowe'},business:{name:'Firma testowa',email:'test@example.invalid'}},earlyStart:false};
 const m=messageFor('received',p);assert.match(m.text,/nie zawarcia umowy/);assert.ok(!m.text.includes('Rachunek'));
 assert.throws(()=>messageFor('contract',p),/OFFER_REQUIRED/);
 p.offer={id:crypto.randomUUID(),createdAt:new Date().toISOString(),scope:'Zakres indywidualnej oferty testowej',bankAccount:'11111111111111111111111111',validUntil:'2099-10-20T10:00:00Z',depositDue:'2099-10-21T10:00:00Z',package:p.package,grave:{},documents:p.documents};
 const offer=messageFor('offer',p);assert.ok(offer.text.includes('Pełne warunki testowe'));assert.match(offer.text,/odpowiedz przed upływem/);assert.match(offer.text,/osobno i dobrowolnie/);assert.throws(()=>messageFor('contract',p),/CONTRACT_REQUIRED/);
 p.contractAt=new Date().toISOString();assert.match(messageFor('contract',p).text,/Potwierdzamy otrzymanie Twojej e-mailowej akceptacji/);
});
test('zgłoszenie bliskiego dnia nie zbiera żądania wcześniejszego rozpoczęcia',()=>{
 const p={idempotencyKey:crypto.randomUUID(),packageId:'silver',quotedPrice:19900,quotedDeposit:5000,cemeteryId:crypto.randomUUID(),date:localDate(),variant:'single-granite',location:'Od głównej bramy trzecia alejka w prawo',inscription:'Osoba Testowa',name:'A',phone:'+48600000000',email:'test@example.invalid',terms:true,earlyStart:false,documentsVersion:'v1'};
 assert.equal(orderSchema.safeParse(p).success,true);assert.equal(orderSchema.safeParse({...p,earlyStart:true}).success,false);
});

test('oferta wymaga poprawnego rachunku i logicznych terminów',()=>{
 const p={scope:'Uzgodniony zakres testowej usługi',bankAccount:'61109010140000071219812874',price:19900,deposit:5000,validUntil:'2099-10-20T10:00:00Z',depositDue:'2099-10-21T10:00:00Z'};
 assert.equal(offerSchema.safeParse(p).success,true);assert.equal(offerSchema.safeParse({...p,bankAccount:'11111111111111111111111111'}).success,false);assert.equal(offerSchema.safeParse({...p,deposit:20000}).success,false);assert.equal(offerSchema.safeParse({...p,depositDue:'2099-10-19T10:00:00Z'}).success,false);
});


test('telefon: polski numer bez prefiksu, wklejanie i zagraniczny kod kraju',()=>{
 const p={idempotencyKey:crypto.randomUUID(),packageId:'silver',quotedPrice:19900,quotedDeposit:5000,cemeteryId:crypto.randomUUID(),date:'2099-10-26',variant:'single-granite',location:'Od głównej bramy trzecia alejka w prawo',inscription:'Osoba Testowa',name:'Test',phone:'600000000',email:'test@example.invalid',terms:true,earlyStart:false,documentsVersion:'v1'};
 for(const phone of ['600000000','600 000 000','600-000-000','+48 600 000 000','48 600 000 000','0048 600 000 000'])assert.equal(orderSchema.parse({...p,phone}).phone,'+48600000000');
 for(const [phone,expected] of [['+44 7700 900123','+447700900123'],['0049 151 23456789','+4915123456789']])assert.equal(orderSchema.parse({...p,phone}).phone,expected);
 for(const phone of ['','+48','60000000','+48 60000000','6000000000','numer telefonu','++48600000000'])assert.equal(orderSchema.safeParse({...p,phone}).success,false);
 assert.equal(normalizePhone('600 000 000'),'+48600000000');assert.equal(normalizePhone(normalizePhone('600000000')),'+48600000000');
});


test('formularz publiczny akceptuje zgłoszenie bez ustalonej daty',()=>{
 const p={idempotencyKey:crypto.randomUUID(),packageId:'silver',quotedPrice:19900,quotedDeposit:5000,cemeteryId:crypto.randomUUID(),variant:'single-granite',location:'Od głównej bramy trzecia alejka w prawo',inscription:'Osoba Testowa',name:'Test',phone:'600000000',email:'test@example.invalid',terms:true,earlyStart:false,documentsVersion:'v1'};
 assert.equal(orderSchema.safeParse(p).success,true);assert.equal(orderSchema.safeParse({...p,date:''}).success,true);
 const m=messageFor('received',{number:1,date:null,package:{name:'Silver',price:19900},cemetery:{name:'Test',address:'Test'},documents:{business:{}}});assert.match(m.text,/Ustalimy telefonicznie/);assert.ok(!m.text.includes('1970'));
});
