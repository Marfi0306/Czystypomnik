# Obsługa zamówień

Panel jest pod `/admin`. Konta tworzy właściciel w Supabase Auth, bez publicznej rejestracji. Serwer sprawdza użytkownika i listę `ADMIN_EMAILS` przy każdym żądaniu. Nie udostępniaj `service_role` użytkownikom ani przeglądarce. Po godzinie zaloguj się ponownie.

## Od zgłoszenia do umowy

Otwórz filtr „Zgłoszenie / oferta”. Zadzwoń, potwierdź lokalizację, stan kamienia, zakres, termin i łączną cenę. Sam telefon nie zawiera umowy. Dodaj notatkę i termin następnego działania. Nieodebrany telefon nie anuluje zgłoszenia.

W sekcji oferty wpisz pełny uzgodniony zakres, cenę, zaliczkę, zweryfikowany rachunek SO SOCIAL oraz ważność oferty i termin zaliczki. Zapis tworzy niezmienny snapshot i kolejkę e-maila z pełnymi warunkami. Zastąpiona oczekująca oferta jest anulowana w kolejce; podczas aktywnej wysyłki nie można jej zastąpić.

Po odpowiedzi klienta odczytaj oryginalny e-mail w uprawnionej skrzynce. Sprawdź nadawcę, konkretną ofertę, akceptację z obowiązkiem zapłaty i czas otrzymania. Wklej treść oraz identyfikator wiadomości do panelu. System nie czyta Gmail i nie dokonuje za operatora oceny skuteczności oświadczenia. Zapis musi odzwierciedlać rzeczywistość. Nie zaznaczaj weryfikacji za klienta bez dowodu.

Jeżeli realizacja przypada przed końcem ustawowego terminu odstąpienia, utrwal dodatkowo osobne żądanie wcześniejszego rozpoczęcia. Brak takiego żądania wymaga późniejszego terminu. Formularz zgłoszeniowy nie zbiera tego oświadczenia. System liczy termin od daty zawarcia umowy, a nie od formularza; przy wyborze samego dnia stosuje ostrożny próg do końca 14. dnia.

Zwykła zmiana statusu nie pozwala wybrać „Umowa zawarta”. Etap akceptacji sprawdza aktualną ofertę, jej wcześniejszą wysyłkę i ważność w chwili otrzymania odpowiedzi. Potwierdzenie umowy zawiera pełną ofertę i warunki. „Sent” w outbox oznacza przyjęcie przez dostawcę; kontroluj odbicia i faktyczne dostarczenie przed przyjęciem odpowiedzi klienta.

## Zaliczki i wykonanie

Odnotuj zaliczkę po rzeczywistym wpływie przelewu. Pieniądze nie są pobierane przez aplikację. Przejście: „Umowa zawarta” → „Zaplanowane” → „W realizacji” → „Zrealizowane”. Przed pracami sprawdź wpłatę zgodnie z uzgodnioną ofertą.

Zdjęcia przed i po oraz rozliczenie wyślij przez firmową pocztę. Przed oznaczeniem „Zrealizowane” panel wymaga identyfikatora wiadomości, dowodu przekazania oraz momentu odbioru przez klienta. Nie utożsamiaj wysłania z odbiorem. Od potwierdzonego odbioru biegną 24 godziny na resztę wpłaty. Automatyczny e-mail rozliczenia uzupełnia wiadomość ze zdjęciami, nie zastępuje ich wysłania.

Panel śledzi zaliczkę i zwrot pełnej odnotowanej zaliczki; inne wpłaty, częściowe zwroty, paragon i fakturę prowadzi księgowość poza aplikacją. Przed zakończeniem wpisz rzeczywistą sumę wpłat netto po zwrotach i potwierdź jej sprawdzenie. Ta kwota służy wyliczeniu salda wiadomości; nie zakłada automatycznie, że klient zapłacił tylko zaliczkę. Nadpłaty rozlicz odrębnie. Status anulowania nie zwraca pieniędzy. Zrealizowana usługa nadal zużywa pojemność dnia.

## Dni pracy i zmiany

W konfiguracji dni najpierw otwórz dzień ekipy, potem konkretnych cmentarzy. Puste pole pojemności oznacza brak limitu, 0 oznacza brak miejsc. Można zamknąć dzień dla nowych zgłoszeń bez anulowania istniejących. Nie można obniżyć limitu poniżej zajęcia. Przyjęte, oczekujące, zaplanowane, wykonywane i wykonane zamówienia liczą się do obłożenia.

Przy przeniesieniu podaj nowy dzień, cmentarz i utrwaloną akceptację klienta e-mailem. Zmiana zgłoszenia przed umową unieważnia jego dotychczasową ofertę; przygotuj nową. Zmiana po umowie wymaga rzeczywistego uzgodnienia, nie jednostronnej decyzji. Operacja jest atomowa: pełny dzień nie powoduje utraty poprzedniej rezerwacji. Odrzucenie, anulowanie i ręczne wygaśnięcie zwalniają miejsce raz. Podaj rzeczywisty powód widoczny klientowi, oddzielnie od wewnętrznej notatki.

Zamówienia telefoniczne/Meta dodawaj przez formularz panelu. Utrwal faktycznie uzgodnione oświadczenia klienta. Korzystają z tej samej puli. Zmiana ceny/aktywności pakietu nie zmienia zamówień historycznych.

## Wiadomości i awarie

Outbox zapisuje się razem z zamówieniem. Scheduler wywołuje endpoint co minutę. Przejęcie zadania ma blokadę i limit prób, wysyłka ma klucz idempotencji. Błąd dostawcy nie cofa zamówienia. Panel pokazuje kolejkę i pozwala ponawiać nieudane wiadomości. „Sent” oznacza przyjęcie przez Resend, nie pewne dostarczenie. Odbicia kontroluj w panelu dostawcy i oznacz problem w zamówieniu; webhook bounce nie jest skonfigurowany.

Po awarii sieci klient ponawia tę samą próbę z tym samym kluczem i treścią. Nie dodawaj drugiego zamówienia ręcznie, zanim nie sprawdzisz listy. Po zmianie treści niepewnej próby jej wynik ma pierwszeństwo. Dłuższe awarie dostawcy wymagają operatora; przed ręcznym ponowieniem po 24 h sprawdź u dostawcy, czy mail już został przyjęty, ponieważ retencja klucza idempotencji jest ograniczona.

Niedziałająca baza nie może pokazywać sukcesu. API zwraca błąd, dane zostają w formularzu. Przy niegotowej konfiguracji strona przechodzi do podglądu i blokuje realne zamówienia.

## Dane, pliki i kopie

Prywatne załączniki dostępne są po zalogowaniu przez link na 5 minut. Upload wymaga osobnego sekretu, wygasającego po godzinie. Dopuszczalne 3 zdjęcia do 3 MB każde, wysyłane osobno z uwagi na limit żądania Vercel;; sprawdzany dekoder i faktyczny format, brak SVG/HTML, ponowne kodowanie WebP usuwa EXIF/GPS. Błąd zdjęcia nie usuwa zamówienia. Nazwy plików nie zawierają danych klientów.

Eksport CSV dotyczy aktualnego filtra. Znak rozpoczynający formułę jest neutralizowany. Plik zawiera dane klientów — ogranicz dostęp i usuń kopie po wykorzystaniu zgodnie z ustaloną retencją.

Przed startem ustal i skonfiguruj kopie bazy oraz prywatnego Storage, szyfrowany magazyn kopii i osoby odpowiedzialne. Przetestuj odtworzenie w osobnym projekcie: migracje, dane, zdjęcia i dostęp zespołu; dopiero potem przełącz domenę. Nie zakładaj automatycznych backupów z samego planu bez weryfikacji. Ustal osobne okresy retencji zamówień, dokumentów, załączników i logów. Sprzątanie osieroconych plików oraz automatyczna retencja wymagają ustalonej polityki i zadania administracyjnego; nie są aktywowane samodzielnie.

## Retencja

Codzienny scheduler uruchamia `/api/internal/retention`. Kod kwalifikuje niepotwierdzone zgłoszenia po 90 dniach bez kontaktu i zdjęcia po 90 dniach od zakończenia/anulowania. Najpierw blokuje edycję kwalifikowanych rekordów, usuwa obiekty Storage, a potem metadane lub niepotwierdzone zgłoszenie. Błąd Storage pozostawia trwały znacznik do ponowienia; nie potwierdza fałszywego usunięcia. Kolejka wysyłki omija zablokowane rekordy. Historia operacyjna i zbędne payloady wysłanych wiadomości są ograniczane po 30 dniach; dowody umowy i aktualnie ważne oferty pozostają osobno.

Przy reklamacji/incydencie ustaw ochronę danych z konkretnym uzasadnieniem; okresowo weryfikuj jej konieczność i zwalniaj ochronę po zakończeniu sprawy. Taka sprawa jest wyłączona z automatycznego usuwania. Dokumentów umownych i księgowych system nie usuwa automatycznie według jednej daty — terminy roszczeń wymagają oceny faktycznej sprawy.

Gmail, CSV, fotografie z wykonania na urządzeniach, własne logi serwera i kopie dostawców nie są kontrolowane przez tę funkcję. Operator musi zapewnić ich retencję zgodnie z dokumentami, w tym limit kopii do 90 dni po usunięciu aktywnych danych. Przetestuj odtworzenie i ponowne zastosowanie usunięć. Nie ustawiaj OPERATIONS_CONFIRMED=true przed wdrożeniem również tych czynności.
