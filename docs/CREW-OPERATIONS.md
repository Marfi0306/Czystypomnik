# Kalendarz i panel ekipy

Panel koordynatora: https://czystypomnik.waw.pl/admin. Panel pracowników: https://czystypomnik.waw.pl/ekipa.

Kalendarz pokazuje realizacje każdego dnia, lokalizację, pakiet, przypisaną osobę i stan przyjęcia. Kliknięcie karty otwiera pełne szczegóły. Pula pozostaje wspólna, maksymalnie 20 realizacji dziennie. Przypisanie osoby nie zużywa dodatkowego miejsca. Kalendarz odświeża się co 15 sekund i po powrocie do karty.

Najpierw zapisz rzeczywisty termin w szczegółach zgłoszenia, potem przypisz wykonawcę w kalendarzu. Nieprzyjęte zadanie wymaga ponownego przydzielenia. Zmiana terminu, lokalizacji lub zakresu unieważnia poprzednie potwierdzenie.

Pracownik musi zmienić hasło robocze przed odczytem zleceń. Może widzieć wyłącznie własne przypisania: dzień, cmentarz, nagrobek i dojście, zakres pakietu lub indywidualnej oferty, wskazówki klienta oraz zdjęcia. Potwierdza „Przyjęte” albo „Nieprzyjęte”. Od dnia realizacji może załączyć do 10 zdjęć wykonania (JPG/PNG/WebP, każde do 3 MB przed konwersją) i oznaczyć „Zrealizowane”. Wymagana jest zawarta umowa i co najmniej jedno zdjęcie przypisane do aktualnego przydziału.

Zakończenie pracy przez wykonawcę nie jest potwierdzeniem zapłaty ani dostarczenia zdjęć klientowi. Koordynator widzi status operacyjny „Zrealizowane” i uwagę o zdjęciach do przekazania. Następnie prowadzi dotychczasowy proces przekazania dokumentacji, rozliczenia i zamknięcia zamówienia.

Adresy ekipy można uzupełnić w sekcji „Zespół i powiadomienia” pod kalendarzem. Pusty adres nie tworzy fałszywej wysyłki. Po uzupełnieniu wysyłane są powiadomienia dla oczekujących przydziałów. Powiadomienie zawiera numer, dzień i link do logowania, bez danych klienta i szczegółowej lokalizacji. Nowe przydzielenie i zmiana zakresu unieważniają nieaktualną kolejkę. Wysyłka wykorzystuje Resend oraz dotychczasowe zadanie minutowe; korespondencja z klientem pozostaje ręczna. Uzupełnij wyłącznie adres wskazany przez danego pracownika.

Dostęp właściciela i ekipy jest rozdzielony na serwerze. Sesja pracownika jest losowa, jej skrót przechowuje baza, a cookie jest HttpOnly, Secure, SameSite=Strict i ograniczone do /api/worker. Sesja wygasa po 12 godzinach. Zmiana hasła unieważnia sesje; wyłączenie konta usuwa sesje i blokuje dane. Hasła przechowuje się jako solone skróty scrypt. W tabelach i funkcjach brak uprawnień anon/authenticated; wszystkie odczyty i zapisy przechodzą przez serwer i sprawdzenie aktualnego przydziału.

Zdjęcia są prywatne, oczyszczane z metadanych i konwertowane do WebP. Linki zdjęć ekipy wygasają po 60 sekundach. Zmiana przydziału blokuje nowe odczyty; wcześniej pobranej kopii lub jeszcze ważnego linku nie można natychmiast cofnąć. Zabronione jest publikowanie dokumentacji i udostępnianie kont innym osobom.

Ceny w panelu wpisuje się w złotych, np. 199,00. Serwer i baza nadal używają całkowitych groszy. Zmiana pakietu nie zmienia historycznych snapshotów.

Banner cookies opisuje wyłącznie mechanizmy faktycznie stosowane. Nie włączono reklam, analityki ani pozornych zgód. W localStorage przez maksymalnie 365 dni zapamiętywany jest czas zamknięcia informacji. Oba rodzaje sesji oraz pamięć bannera opisuje bieżąca informacja o cookies. Kontekst: https://www.gov.pl/web/bip/polityka-dotyczaca-cookies.
