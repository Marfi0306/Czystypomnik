import {money,type Package} from './domain';
export const earlyStartStatement='Żądam rozpoczęcia usługi przed upływem 14 dni na odstąpienie. Po pełnym wykonaniu usługi za moją uprzednią zgodą i po przyjęciu do wiadomości tej informacji tracę prawo odstąpienia. Przy odstąpieniu po rozpoczęciu zapłacę proporcjonalnie za wykonaną część.';
export const termsStatement=(pkg:Pick<Package,'price'|'deposit'>)=>`Akceptuję regulamin i warunki zamówienia, w tym cenę ${money(pkg.price)} oraz zaliczkę ${money(pkg.deposit)} płatną po potwierdzeniu.`;
