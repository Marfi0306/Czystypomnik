# Raport odbioru podglądu

Data: 15 października 2026. Stan: strona demonstracyjna i kod backendu; zamówienia produkcyjne wyłączone.

## Sprawdzone

- Kompilacja TypeScript i build Vite do `dist/`.
- 20 testów: 15 scenariuszy rzeczywistych funkcji SQL w PGlite i 5 testów domeny/szablonów. Zestaw obejmuje pojemność 10→5, wiele prób ostatniego miejsca, idempotencję i konflikt danych, anulowanie raz, wykonanie bez zwolnienia miejsca, limit zespołu, atomową nieudaną zmianę dnia, brak limitu i zamknięcie, limit poniżej zajęcia, historyczną cenę i odrzucenie zmienionej oferty, telefoniczną rezerwację, błąd outbox bez cofnięcia zapisu, uprawnienia anonimowe, wersję warunków, limit zdjęć i rate limiting.
- Walidacja danych, numer telefonu z odstępami, nieistniejąca data, honeypot, niezaakceptowany regulamin, próba podmiany ceny, polska zmiana czasu i odmiany liczby miejsc.
- Potwierdzenie odbioru e-mail nie zawiera instrukcji płatności; przyjęcie zawiera instrukcję.
- W przeglądarce, szerokość 390 px: pełne przejście pakiet Gold → dzień przykładowy → lokalizacja i tablica → dane testowe → oświadczenia → zakończenie podglądu. Cena 299 zł, zaliczka 75 zł, pozostało 224 zł. Komunikat końcowy potwierdza brak rezerwacji i brak wysyłki danych.
- Pomiar szerokości DOM przy 360, 390, 768, 1280 i 1440 px: `scrollWidth` równy szerokości widoku, bez poziomego przewijania.
- Suwak reaguje na strzałkę w lewo: udział „po” rośnie z 50% do 51%. Obrazy mają stały obszar, a natywny zakres obsługuje klawiaturę. Pionowy gest nie jest blokowany przez `touch-action`.
- Oglądnięto logo i oba zdjęcia. Wdrożono kompresję WebP. Zgodnie z korektą właściciela podpisano pod zdjęciami: „Materiał utworzony przy użyciu SI”. Brak fikcyjnych opinii, liczników i danych firmy.
- Lokalny HTTP: `/api/config` → demo; próba zamówienia z obcej domeny → 403; panel bez konfiguracji → 503; worker bez sekretu → 401.

Wykryty podczas kontroli błąd stanu ładowania kalendarza demonstracyjnego został poprawiony, a pełną ścieżkę formularza wykonano po poprawce.

## Do sprawdzenia przed produkcją

PGlite jest lokalnym PostgreSQL w WASM z jednym połączeniem. Równoczesne wywołania testowe są kolejkowane; nie potwierdzają blokad wielu niezależnych sesji. Na docelowym Supabase wykonać co najmniej 10 równoległych wywołań z osobnych klientów przy jednym miejscu, sprawdzić jedno zamówienie, właściwą liczbę outbox i brak utraty rezerwacji przy przenoszeniu.

Sprawdzić dwie niezależne przeglądarki z pollingiem, RLS i Storage przez publiczny klucz, sesję administratora oraz odrzucenie kont spoza allowlisty; dekoder niedozwolonych plików, limit wgrania i brak GPS w pobranym WebP; działanie DNS i przyjęcie/dostarczenie/odbicie e-maila w uzgodnionym środowisku testowym; scheduler, retry i alarm przy 8 próbach; backup, odtworzenie i ustaloną retencję. Nie wysłano prawdziwych e-maili testowych ani danych klientów.

Nie wykonano pomiaru laboratoryjnego Core Web Vitals ani testu na fizycznym telefonie z otwartą klawiaturą. Sprawdzenie viewportu nie zastępuje testu iOS/Android.

## Zakres przygotowany, ale jeszcze niepodłączony

Supabase i Resend nie istnieją w kontekście projektu. Panel, prywatne zdjęcia, atomowe zamówienia oraz kolejka mają implementację, lecz nie są uruchomione na publicznym backendzie. Projekty dokumentów są w repozytorium i nie są prezentowane jako obowiązujący regulamin. Backend Node wymaga własnego wdrożenia. Statyczny podgląd Sites nie uruchamia tego serwera.

Analityka ma lokalny punkt integracji `cp:analytics` bez dostawcy i transmisji. W demo nic nie emituje. Przyjęcie i zaliczka są zapisywane w historii operacji; nie wysyłają konwersji Meta. Nie uruchomiono automatycznej retencji, webhooków bounce, Realtime ani automatycznego wygasania. Są to opisane granice wersji, a nie zadeklarowane działające integracje.
