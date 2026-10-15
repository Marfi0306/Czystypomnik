# Czysty Pomnik

Strona oferty i system zamówień czyszczenia nagrobków. Opublikowany podgląd **nie przyjmuje zamówień**, nie wysyła formularza ani zdjęć. Backend oraz migracje są przygotowane do podłączenia Supabase i Resend. Nie ma jeszcze kont produkcyjnych, danych wykonawcy ani zatwierdzonych dokumentów.

## Uruchomienie

Wymagane Node.js 24 i pnpm 11. Zależności są zamrożone w `pnpm-lock.yaml`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Podgląd: `http://127.0.0.1:5173`. API w drugim terminalu:

```sh
node --env-file=.env --import tsx server/index.ts
```

Skopiuj `.env.example` do lokalnego `.env` i uzupełnij ustawienia. `.env` nie trafia do Git. Vite przekazuje `/api` do portu 3001; serwer produkcyjny obsługuje zarówno API, jak i `dist/` z tej samej domeny.

```sh
pnpm test
pnpm build
pnpm start
```

`pnpm start` oczekuje zmiennych środowiskowych hostingu; lokalny plik `.env` wczytuje jawne polecenie Node powyżej.

## Co zawiera projekt

- React + TypeScript + Vite; serwer Express, Supabase Postgres/Auth/Storage, outbox wysyłany przez Resend.
- Granatowo-złota identyfikacja z dostarczonego logo. Zdjęcia z materiałów właściciela oznaczone jako przykładowe, bez przypisywania im autentycznej realizacji.
- Pakiety Silver/Gold/Platinum: 199/299/449 zł; zatwierdzone zaliczki 50/75/150 zł po telefonicznym potwierdzeniu.
- Trzy kroki formularza, kalendarz bez godzin, opcjonalne zdjęcia, podsumowanie i oświadczenia.
- Panel `/admin`: lista i szczegóły, filtry, statusy, wpłaty/zwroty, notatki, przenoszenie, ręczne zamówienia, dni i limity, ceny, outbox, eksport CSV.
- Migracje transakcyjnych rezerwacji, prywatne zdjęcia bez EXIF/GPS, uprawnienia zamknięte dla anonimowych użytkowników.

## Podgląd i produkcja

Podgląd pokazuje **jeden przykładowy cmentarz i dni demonstracyjne 24–31.10.2026**. Nie są to faktyczne terminy. Nie zapisuje danych w localStorage, cookies ani bazie. Nie ma marketingowego śledzenia. Brak połączenia z API nie skutkuje sukcesem prawdziwego zamówienia.

Produkcja wymaga `APP_MODE=production`, kompletu ustawień backendu i `settings.ready=true` oraz uzupełnionych danych firmy i tekstów dokumentów. API ponownie sprawdza gotowość przed zamówieniem. `reserve_order` sprawdza gotowość również w bazie. Ceny pochodzą wyłącznie z bazy. Pojemność `NULL` oznacza brak limitu zgodnie z decyzją właściciela; brak rekordu dnia oznacza zamknięcie. Można wprowadzić limity lokalne i łączne później.

## Wdrożenie systemu zamówień

1. Utwórz projekt Supabase w uzgodnionym regionie. Wykonaj kolejno SQL z `supabase/migrations/001_orders.sql`, `002_private_storage.sql`, `003_attachment_limit.sql`.
2. W Supabase Auth wyłącz publiczną rejestrację i utwórz konto zespołu. Dodaj jego adres do `ADMIN_EMAILS`. Nie umieszczaj hasła w repozytorium. Sesja panelu trwa do godziny; potem wymagane jest ponowne logowanie.
3. Uzupełnij `settings.business` (`name`, `nip`, `address`, `phone`, `email`), `settings.documents` (`regulamin`, `prywatnosc`, `odstapienie`, `cookies`) i `documents_version`. Teksty dokumentów, firma, cena oraz oświadczenia są kopiowane do zamówienia. Przyjęcie e-mail zawiera pełne teksty, a nie same odnośniki.
4. Dodaj katalog wszystkich obsługiwanych cmentarzy Warszawy z jednoznacznymi nazwami i adresami. Panel pozwala dodawać pozycje. Otwórz dni ekipy, następnie dni cmentarzy. Puste limity = brak limitu. Nie ma automatycznego otwierania dni na podstawie przykładowych danych.
5. Zweryfikuj domenę w Resend, uzupełnij e-mail nadawcy i właściciela, instrukcje płatności i sekrety. Skonfiguruj zewnętrzny scheduler wywołujący co minutę `POST /api/internal/outbox` z nagłówkiem `Authorization: Bearer <CRON_SECRET>`.
6. Wdróż Node.js na wybranym hostingu z HTTPS, `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm start`. Potrzebny runtime Node z zależnościami, w tym `tsx`; nie używaj instalacji `--prod` bez zmiany procesu kompilacji serwera. Ustaw `HOST=0.0.0.0` i port hostingu. Dobierz `TRUST_PROXY_HOPS` do faktycznej ścieżki reverse proxy, aby klient nie mógł podmienić IP rate limitera.
7. Wykonaj testy integracyjne wymienione w `docs/ODBIOR.md`, skonfiguruj backup/retencję i monitoring. Uzgodnij dokumenty i zasady operacyjne. Dopiero potem ustaw gotowość.
8. Usuń `noindex`, zmień opis i Open Graph na produkcyjne. Podmień przykładowe zdjęcia na potwierdzone lub ukryj galerię. Aktualizuj FAQ o pogodzie i anulowaniu po zatwierdzeniu warunków.

Nie aktywowano płatnego planu, kampanii reklamowej ani usługi bankowej. GitHub Pages nie został wybrany jako hosting zamówień. Publikacja Sites obejmuje statyczny podgląd, **nie uruchamia backendu Express**; system produkcyjny wymaga osobnego wdrożenia Node/Supabase.

## Testy i ograniczenia

`pnpm test` uruchamia rzeczywiste funkcje SQL w PGlite oraz walidację i szablony e-maili. Weryfikuje m.in. idempotencję, sumowanie obłożenia, anulowanie, terminalny status realizacji, atomowe przenoszenie, uprawnienia, outbox i daty polskie. PGlite używa pojedynczego połączenia: próby współbieżne są kolejkowane, więc **nie stanowią dowodu blokad między niezależnymi połączeniami Supabase**. Taki test pozostaje bramką startu produkcji. RLS storage, dostarczanie e-maili i pełna sesja administratora wymagają rzeczywistego środowiska.

Odświeżanie dostępności działa przez polling co 20 sekund, przy zmianie pakietu/cmentarza i powrocie do karty. Rozpoczęcie formularza nie blokuje terminu. Nie ma losowych powiadomień o innych klientach, płatności online, automatycznego wygaśnięcia zamówień, Realtime ani kont klientów.

Opis operacji: `docs/OPERACJE.md`. Faktyczne braki: `docs/BRAKUJACE_DANE.md`. Dokumentacja materiałów: `docs/ZRODLA.md`.
