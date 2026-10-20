# Meta Pixel i Conversions API

Pixel ID: 1449807230414613. Publiczny pomiar wymaga META_PIXEL_ID i aktualnej zgody marketingowej v2. Poprzednia zgoda na sam Lead nie jest przenoszona. Bieżące dokumenty: 2026-10-20-v1. Odmowa nie blokuje formularza; panele i dokumenty nie są mierzone.

| Zdarzenie | Moment |
| --- | --- |
| PageView | Raz na załadowaną stronę po zgodzie |
| ViewContent | Co najmniej połowa karty pakietu w widoku; raz na pakiet i stronę |
| PackageSelected (własne) | Wybór innego pakietu w karcie lub formularzu |
| Search | Zakończenie wyszukiwania cmentarza; bez treści zapytania |
| FormStart (własne) | Pierwsza zmiana formularza lub przejście z pierwszego kroku |
| FormStep (własne) | Poprawne przejście do kroku 2 lub 3 |
| FormSubmit (własne) | Próba wysłania kompletnego formularza |
| FormError (własne) | Błąd walidacji lub zapisu; bez danych pól i komunikatu serwera |
| Contact | Kliknięcie telefonu lub e-maila; bez danych kontaktowych |
| Lead | Poprawna odpowiedź API po zapisaniu publicznego zgłoszenia |

Nie emitujemy fikcyjnych AddToCart, InitiateCheckout, AddPaymentInfo ani Purchase: zgłoszenie nie jest koszykiem, płatnością ani zawartą umową. Nie zbieramy automatycznie treści pól ani advanced matching. Do Meta nie wysyłamy danych kontaktowych, zapytania, cmentarza, lokalizacji, tablicy, uwag, zdjęć, numeru zamówienia ani kwot. Parametry są ograniczone do identyfikatora publicznego pakietu, numeru kroku i rodzaju kontaktu.

Wywołanie fbq nie potwierdza odbioru w Meta. Przeglądarka, rozszerzenia i Meta mogą blokować wysyłkę. Brak PageView we wcześniejszej wersji wyjaśniał brak zdarzenia po samym wejściu i zgodzie; nie rozstrzygał wszystkich przypadków brakującego Lead.

## Uzupełniający Lead z serwera

META_CONVERSIONS_API_TOKEN jest sekretem backendu. Dodaj go w Vercel dla Production i wdroż ponownie. META_GRAPH_API_VERSION domyślnie wynosi v26.0, zgodnie z aktualnym oficjalnym Business SDK.

CAPI działa po walidacji i skutecznym reserve_order, wyłącznie dla publicznego zgłoszenia z nagłówkiem aktualnej zgody x-marketing-consent: v2. Oba kanały używają tego samego event_id cp-lead-<losowy klucz próby> do deduplikacji. Serwer wysyła techniczny IP żądania, User-Agent i poprawne _fbp/_fbc, jeśli występują. Nie wysyła nazwiska, telefonu ani e-maila. Używa req.ip zgodnie z TRUST_PROXY_HOPS, nie dowolnego X-Forwarded-For.

Brak tokenu wyłącza CAPI; odmowa wyłącza nagłówek zgody. Limit wywołania wynosi 3,5 sekundy. Awaria nie cofa zapisanego zgłoszenia. CAPI nie ma trwałej kolejki ponowień. Odpowiedź zawiera techniczny marketingDelivery: disabled/no_consent/sent/failed; błędy są logowane bez tokenu i danych klienta. Powtórzony zapis używa tego samego event_id.

Do jawnego testu można tymczasowo ustawić META_TEST_EVENT_CODE z zakładki Testowanie zdarzeń Meta. Usuń zmienną po teście. Nie wywołuj produkcyjnego Lead ręcznie bez zapisania zgłoszenia ani fikcyjnego Purchase.

## Zgoda i kontrola

Przed zgodą nie pobieramy zasobów Meta. Decyzja v2 obowiązuje do 180 dni. Wycofanie blokuje pomiar, czyści niewysłaną kolejkę SDK i dostępne _fbp/_fbc. Nie odtwarzamy zdarzeń sprzed zgody. Klucze deduplikacji Lead w sessionStorage są losowe i znikają z sesją karty.

Testy obejmują odmowę, wycofanie w innej karcie, starą zgodę, pojedynczy PageView, deduplikację Lead, dozwolone parametry i CAPI. Izolowany test przeglądarkowy używa prawdziwego SDK z lokalnym odbiornikiem. Odbiór w Meta wymaga osobnego potwierdzenia w Menedżerze zdarzeń.

Źródła: https://help.shopify.com/en/manual/promoting-marketing/analyze-marketing/meta-data-sharing oraz https://github.com/facebook/facebook-python-business-sdk.
