# Obsługa zamówień

Panel jest pod `/admin`. Konta tworzy właściciel w Supabase Auth, bez publicznej rejestracji. Serwer sprawdza użytkownika i listę `ADMIN_EMAILS` przy każdym żądaniu. Nie udostępniaj `service_role` użytkownikom ani przeglądarce. Po godzinie zaloguj się ponownie.

## Nowe zamówienie

Otwórz listę i filtr „Do kontaktu”. Zadzwoń, sprawdź lokalizację, wariant pojedynczego granitu, stan kamienia i wykonalność dnia. Wątpliwą lokalizację oznacz w „Wymaga uwagi”, dodaj notatkę i termin następnego działania. Nieodebrany telefon nie anuluje zamówienia. Zamówienia starsze niż 24 h są wyróżniane, ale nie wygaszają automatycznie.

„Przyjęte” uruchamia e-mail przyjęcia z ceną, zaliczką i pełnymi warunkami z dnia złożenia. Pierwszy e-mail potwierdza tylko odbiór. Instrukcje wpłaty są wysyłane dopiero po przyjęciu. Nie ma płatności online ani automatycznej weryfikacji banku.

## Zaliczki i wykonanie

Po rzeczywistym otrzymaniu środków wybierz „Odnotuj zaliczkę”. Kwota wynika z historycznego pakietu. Można przejść z „Przyjęte” do „Zaplanowane”, potem „W realizacji” i „Zrealizowane”. Przed wykonaniem sprawdź wpłatę zgodnie z ustalonym procesem; aplikacja nie wykonuje automatycznego rozliczenia konta bankowego. Po zdjęciach klient rozlicza resztę w 24 h. Zdjęcia z wykonania i pozostałą płatność obsługuje zespół poza automatyzacją wersji pierwszej. Panel śledzi zaliczkę i jej zwrot; nie prowadzi pełnej księgowości.

Zrealizowana usługa nadal zużywa pojemność dnia. Nie można jej anulować w celu odzyskania miejsca. Zwrot zaliczki oznacza osobną operację po faktycznym zwrocie środków; status anulowania sam nie zwraca pieniędzy.

## Dni pracy i zmiany

W konfiguracji dni najpierw otwórz dzień ekipy, potem konkretnych cmentarzy. Puste pole pojemności oznacza brak limitu, 0 oznacza brak miejsc. Można zamknąć dzień dla nowych zgłoszeń bez anulowania istniejących. Nie można obniżyć limitu poniżej zajęcia. Przyjęte, oczekujące, zaplanowane, wykonywane i wykonane zamówienia liczą się do obłożenia.

Przy przeniesieniu podaj nowy dzień, cmentarz i komunikat dla klienta. Operacja jest atomowa: pełny dzień nie powoduje utraty poprzedniej rezerwacji. Odrzucenie, anulowanie i ręczne wygaśnięcie zwalniają miejsce raz. Podaj rzeczywisty powód widoczny klientowi, oddzielnie od wewnętrznej notatki.

Zamówienia telefoniczne/Meta dodawaj przez formularz panelu. Utrwal faktycznie uzgodnione oświadczenia klienta. Korzystają z tej samej puli. Zmiana ceny/aktywności pakietu nie zmienia zamówień historycznych.

## Wiadomości i awarie

Outbox zapisuje się razem z zamówieniem. Scheduler wywołuje endpoint co minutę. Przejęcie zadania ma blokadę i limit prób, wysyłka ma klucz idempotencji. Błąd dostawcy nie cofa zamówienia. Panel pokazuje kolejkę i pozwala ponawiać nieudane wiadomości. „Sent” oznacza przyjęcie przez Resend, nie pewne dostarczenie. Odbicia kontroluj w panelu dostawcy i oznacz problem w zamówieniu; webhook bounce nie jest skonfigurowany.

Po awarii sieci klient ponawia tę samą próbę z tym samym kluczem i treścią. Nie dodawaj drugiego zamówienia ręcznie, zanim nie sprawdzisz listy. Po zmianie treści niepewnej próby jej wynik ma pierwszeństwo. Dłuższe awarie dostawcy wymagają operatora; przed ręcznym ponowieniem po 24 h sprawdź u dostawcy, czy mail już został przyjęty, ponieważ retencja klucza idempotencji jest ograniczona.

Niedziałająca baza nie może pokazywać sukcesu. API zwraca błąd, dane zostają w formularzu. Przy niegotowej konfiguracji strona przechodzi do podglądu i blokuje realne zamówienia.

## Dane, pliki i kopie

Prywatne załączniki dostępne są po zalogowaniu przez link na 5 minut. Upload wymaga osobnego sekretu, wygasającego po godzinie. Dopuszczalne 3 zdjęcia do 5 MB; sprawdzany dekoder i faktyczny format, brak SVG/HTML, ponowne kodowanie WebP usuwa EXIF/GPS. Błąd zdjęcia nie usuwa zamówienia. Nazwy plików nie zawierają danych klientów.

Eksport CSV dotyczy aktualnego filtra. Znak rozpoczynający formułę jest neutralizowany. Plik zawiera dane klientów — ogranicz dostęp i usuń kopie po wykorzystaniu zgodnie z ustaloną retencją.

Przed startem ustal i skonfiguruj kopie bazy oraz prywatnego Storage, szyfrowany magazyn kopii i osoby odpowiedzialne. Przetestuj odtworzenie w osobnym projekcie: migracje, dane, zdjęcia i dostęp zespołu; dopiero potem przełącz domenę. Nie zakładaj automatycznych backupów z samego planu bez weryfikacji. Ustal osobne okresy retencji zamówień, dokumentów, załączników i logów. Sprzątanie osieroconych plików oraz automatyczna retencja wymagają ustalonej polityki i zadania administracyjnego; nie są aktywowane samodzielnie.
