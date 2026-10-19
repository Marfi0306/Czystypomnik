# Meta Pixel — pomiar wysłania zgłoszenia

Pixel ID przekazany przez właściciela: 1449807230414613. Integracja jest wyłączona, dopóki META_PIXEL_ID nie zawiera poprawnego identyfikatora. Nie wpisuj tu tokenu Conversions API. Nie włączono CAPI ani wysyłania danych formularza do Meta.

Zdarzenie standardowe Lead jest wywoływane wyłącznie po poprawnej odpowiedzi API zapisującej publiczne zgłoszenie. Kliknięcie przycisku, walidacja i błąd sieci nie wywołują konwersji. Klucz próby formularza daje stały losowy eventID i blokuje duplikaty przy ponowieniu. Wysłanie zdjęć jest niezależne od zapisu zgłoszenia i nie wywołuje kolejnego Lead. Zamówienia dodawane ręcznie w panelu, podgląd i panel ekipy są wyłączone z pomiaru.

Nie ma PageView, automatycznego pomiaru kliknięć i formularzy ani advanced matching w kodzie. Do Meta nie przekazujemy telefonu, e-maila, danych z tablicy, lokalizacji grobu, treści uwag, zdjęć, kwot ani numeru zamówienia. Sam Pixel może przetwarzać IP, dane przeglądarki, adres strony i identyfikatory cookies — należy je wskazać w aktualnej polityce prywatności.

Przed zgodą marketingową nie jest pobierany żaden zasób Meta. Odrzucenie ma taki sam przycisk jak akceptacja i nie blokuje formularza. Zgoda lub odmowa ma wersję i termin ważności 180 dni; zmiana Pixel ID wymaga nowej decyzji. Poprzednie zamknięcie informacyjnego bannera nie jest zgodą marketingową. Wycofanie w Cookies i prywatność blokuje nowe zdarzenia, usuwa kolejkę niepobranej biblioteki i usuwa dostępne cookies _fbp/_fbc. Nie wysyłamy zdarzeń z okresu sprzed zgody. SessionStorage przechowuje wyłącznie losowe klucze deduplikacji do końca sesji karty.

## Wdrożenie i weryfikacja

1. Potwierdź Pixel ID oraz własność właściwego źródła danych w Menedżerze zdarzeń.
2. Zaktualizuj bieżące dokumenty cookies i prywatności w źródle i ustawieniach Supabase: dostawca Meta, cel reklamowy pomiaru, podstawa zgody, dane techniczne, cookies i transfery, możliwość wycofania. Usuń dotychczasowe bezwarunkowe zdanie o braku Meta Pixel. Zachowaj historyczne snapshoty.
3. Ustaw META_PIXEL_ID dla produkcji Vercel i opublikuj dokładny przetestowany commit.
4. W Menedżerze zdarzeń wyłącz automatyczne zaawansowane dopasowanie i automatyczne zdarzenia, jeśli są włączone. Nie dodawaj drugiej reguły Lead na kliknięcie przycisku.
5. Sprawdź w przeglądarce odmowę i zgodę, brak ruchu do Meta przed zgodą, pojedynczy Lead po sukcesie i brak zdarzenia po błędzie. Użyj fikcyjnego zgłoszenia w izolowanym środowisku, a test do właściwego źródła danych wykonaj jawnie jako test.

Konfiguracja produkcyjna wymaga META_PIXEL_ID=1449807230414613 i bieżącego pakietu dokumentów 2026-10-19-v2. Dokumentacja dostawcy: https://developers.facebook.com/docs/meta-pixel/implementation/conversion-tracking/ oraz https://developers.facebook.com/docs/meta-pixel/implementation/gdpr/ (przy przygotowaniu serwer dokumentacji zwracał 429).
