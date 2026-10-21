# Meta Pixel i Conversions API

Pixel ID: 1449807230414613. Publiczny pomiar wymaga META_PIXEL_ID i aktualnej zgody marketingowej v2. Poprzednia zgoda na sam Lead nie jest przenoszona. Bieżące dokumenty: 2026-10-21-v1. Odmowa nie blokuje formularza; panele i dokumenty nie są mierzone.

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

## Uzupełniający kanał serwerowy

META_CONVERSIONS_API_TOKEN jest sekretem backendu. Dodaj go w Vercel dla Production i wdroż ponownie. META_GRAPH_API_VERSION domyślnie wynosi v26.0, zgodnie z aktualnym oficjalnym Business SDK.

CAPI działa po walidacji i skutecznym reserve_order, wyłącznie dla publicznego zgłoszenia z nagłówkiem aktualnej zgody x-marketing-consent: v2. Oba kanały używają tego samego event_id cp-lead-<losowy klucz próby> do deduplikacji. Pozostałe czynności korzystają z POST /api/marketing/events, aktualnej zgody v2, ścisłej listy nazw i parametrów oraz wspólnego ID cp-<UUID> w obu kanałach. API nie przyjmuje Lead, Purchase, danych kontaktowych, dowolnych parametrów ani URL. Przetwarza do 10 zdarzeń w paczce i osobny limit 10 żądań na 15 sekund na skrót IP, bez zużywania limitu zamówień. Klient ponawia błąd raz z tym samym ID, po ponownym sprawdzeniu zgody; wycofanie usuwa oczekującą paczkę i przerywa żądania. Nie ma trwałej kolejki ani gwarancji dostarczenia. Serwer wysyła techniczny IP żądania, User-Agent i poprawne _fbp/_fbc, jeśli występują. Nie wysyła nazwiska, telefonu ani e-maila. Używa req.ip zgodnie z TRUST_PROXY_HOPS, nie dowolnego X-Forwarded-For.

Brak tokenu wyłącza CAPI; odmowa wyłącza nagłówek zgody. Limit wywołania wynosi 3,5 sekundy. Awaria nie cofa zapisanego zgłoszenia. CAPI nie ma trwałej kolejki ponowień. Odpowiedź zawiera techniczny marketingDelivery: disabled/no_consent/sent/failed; każdy wynik CAPI (sent/failed/no_consent/disabled) jest logowany jako META_CAPI_DELIVERY z nazwą i losowym ID, bez tokenu i danych klienta. Powtórzony zapis używa tego samego event_id.

Do jawnego testu można tymczasowo ustawić META_TEST_EVENT_CODE z zakładki Testowanie zdarzeń Meta. Usuń zmienną po teście. Nie wywołuj produkcyjnego Lead ręcznie bez zapisania zgłoszenia ani fikcyjnego Purchase.

## Zgoda i kontrola

Przed zgodą nie pobieramy zasobów Meta. Decyzja v2 obowiązuje do 180 dni. Wycofanie blokuje pomiar, czyści niewysłaną kolejkę SDK i dostępne _fbp/_fbc. Nie odtwarzamy zdarzeń sprzed zgody. Klucze deduplikacji Lead w sessionStorage są losowe i znikają z sesją karty.

Testy obejmują odmowę, wycofanie w innej karcie, starą zgodę, pojedynczy PageView, deduplikację Lead, dozwolone parametry i CAPI. Izolowany test przeglądarkowy używa prawdziwego SDK z lokalnym odbiornikiem. Odbiór w Meta wymaga osobnego potwierdzenia w Menedżerze zdarzeń.

Źródła: https://help.shopify.com/en/manual/promoting-marketing/analyze-marketing/meta-data-sharing oraz https://github.com/facebook/facebook-python-business-sdk.

## Diagnostyka odbioru

Adres /?meta_debug=1 pokazuje po zgodzie potwierdzenia odpowiedzi Meta dla czynności z tej karty. Stan sent wymaga HTTP 2xx i events_received równemu liczbie zdarzeń paczki. Jest to potwierdzenie przyjęcia przez API, nie gwarancja przypisania do reklamy ani wyświetlenia w panelu. Lead pokazuje wynik rzeczywistego POST /api/orders, bez osobnego wywoływania konwersji. W produkcji nie ustawiamy globalnie META_TEST_EVENT_CODE; zwykłe zdarzenia bez tego kodu nie należą do testu serwerowego TEST31731.

Jawny test czynności: /?meta_debug=1&meta_test=TEST31731. Klient przesyła ograniczony kod TEST<cyfry> nagłówkiem tylko do kanału czynności; serwer waliduje go i umieszcza jako test_event_code. Nie zmienia globalnego środowiska ani produkcyjnych zgłoszeń Lead i nie pozwala wygenerować Lead przez publiczne API czynności. Po teście używaj zwykłego adresu strony.
