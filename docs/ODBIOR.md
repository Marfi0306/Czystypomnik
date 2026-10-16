# Odbiór przygotowanej wersji — 16.10.2026

Stan: podgląd bez przyjmowania danych; kod produkcyjny i dokumenty do zatwierdzenia. Zgody na publikację podglądu nie trzeba ponawiać.

## Sprawdzone lokalnie

- TypeScript i build Vite; konfiguracja backendu eksportowana także jako funkcja Vercel.
- Zestaw testów SQL PGlite, domeny, poczty i HTTP API: idempotencja, limity wspólne/lokalne, brak limitu, atomowe przenoszenie, statusy, wersjonowanie cen/warunków, uprawnienia anon, limit załączników i próby nadużyć.
- Nowy model: odbiór zgłoszenia nie zawiera umowy i nie wysyła danych wpłaty. Oferta zawiera pełne warunki. Zwykła zmiana statusu nie zawiera umowy. Wymagane są aktualna wysłana oferta, dowód odpowiedzi klienta i ważność oferty w momencie odpowiedzi. Ponowienie akceptacji nie generuje drugiego potwierdzenia.
- Bliski termin nie wymaga oświadczenia w formularzu. Osobne żądanie jest wymagane dopiero przy umowie przed końcem terminu odstąpienia, liczonym od akceptacji oferty. Wygaśnięta oferta jest odrzucana.
- Retencja: ochrona sprawy przed usunięciem, kwalifikacja po 90 dniach, trwała blokada edycji i usuwanie metadanych po usunięciu plików. Dowody umowy pozostają poza zwykłą historią operacyjną.
- Lokalny HTTP: bez konfiguracji API zwraca demo; POST zgłoszenia → 503 NOT_READY; obce pochodzenie → 403; scheduler bez sekretu → 401.
- Przeglądarka 390 px: Silver → przykładowy dzień 24.10 → lokalizacja i tablica → fikcyjny kontakt → walidacja niezaznaczonego regulaminu → zakończenie podglądu. Brak pola żądania wcześniejszego rozpoczęcia przy zgłoszeniu. Potwierdzenie wyraźnie wskazuje brak rezerwacji i brak wysłania danych.
- Dokumenty są widoczne także w demo, z informacją o projekcie. Pełny regulamin, pobieranie TXT, przycisk druku/PDF i nawigacja dokumentów. Polityka/cookies odróżniają hosting podglądu od docelowych usług.
- DOM przy szerokościach 320, 390, 560, 768, 1024 i 1440 px: bez poziomego przewijania. Poprzednie poprawki spacji i podpisu zdjęcia są zachowane.
- Firma, KRS, NIP, adres, kapitał i sąd sprawdzone w urzędowym odpisie. Nie stwierdza to przejęcia ról przez spółkę ani udzielenia upoważnienia.

## Pozostały odbiór produkcyjny

PGlite używa jednego połączenia; próby równoczesne są kolejkowane i nie potwierdzają blokad między niezależnymi sesjami Supabase. Na prawdziwym środowisku wykonać co najmniej 10 równoległych prób ostatniego miejsca z osobnych klientów, sprawdzić jedno zgłoszenie, outbox i zachowanie rezerwacji przy nieudanym przeniesieniu.

Zweryfikować region eu-central-1 w ustawieniach rzeczywistego projektu, wszystkie migracje, RLS/Auth/Storage, logowanie i odrzucenie konta spoza allowlisty. Sprawdzić wysyłkę i odbicia Resend, reply-to, komplet warunków w e-mailu, ręczne zapisanie rzeczywistej odpowiedzi oraz dostarczenie zdjęć i rozliczenia. Sprawdzić routing funkcji Vercel, upload 3 MB, brak EXIF, harmonogramy i monitoring. Przetestować retencję Storage i odtworzenie kopii oraz retencję kopii zewnętrznych.

Nie wysłano prawdziwych wiadomości klientom, nie połączono banku, nie aktywowano usług ani płatnych planów. Zdjęcia z wykonania, odczyt odpowiedzi Gmail i księgowość obsługuje operator; panel utrwala ich dowody, nie udaje tych integracji.

Test viewportu nie zastępuje fizycznego iPhone/Android z klawiaturą. Nie wykonano laboratoryjnego pomiaru Core Web Vitals. Po uruchomieniu domeny produkcyjnej sprawdzić indeksowanie, robots i sitemap.
