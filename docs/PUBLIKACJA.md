# Uruchomienie Czysty Pomnik — 16.10.2026

Kod strony, dokumenty, formularz zgłoszeniowy i obsługa ofert są przygotowane. Domyślna konfiguracja nadal pokazuje podgląd bez zapisu danych. Publikacja podglądu nie uruchamia sprzedaży.

## Fakty wymagające uzupełnienia

- Potwierdzenie przez SO SOCIAL roli wykonawcy, strony umów, odbiorcy płatności i administratora danych oraz upoważnienia do obsługi. KRS potwierdza dane rejestrowe, nie te relacje.
- Supabase w regionie **eu-central-1 Frankfurt**: rzeczywisty projekt, migracje, prywatny Storage i konta zespołu. Sama wartość zmiennej nie potwierdza regionu; sprawdź ustawienia projektu.
- Poczta: domena nadawcza zweryfikowana w Resend, MAIL_FROM i odpowiedzi kierowane do czystypomnikwarszawa@gmail.com. Konto Gmail nie jest automatycznie Google Workspace; ustal właściwe warunki obsługi dla spółki.
- Zweryfikowany rachunek SO SOCIAL, katalog cmentarzy i faktycznie otwarte dni, dostęp zespołu, monitoring, kopie i retencja poza aplikacją.

## Wdrożenie na Vercel

Repozytorium: Marfi0306/Czystypomnik. Konfiguracja `vercel.json` buduje Vite, obsługuje adresy dokumentów i kieruje `/api/*` do funkcji Express `api/index.ts`. Node 24. `server/start.ts` służy uruchomieniu na zwykłym serwerze Node.

1. Wykonaj migracje `001_orders.sql`, `002_private_storage.sql`, `003_attachment_limit.sql`, `004_offers_and_retention.sql` w tej kolejności. Ostatnia migracja celowo pozostawia `settings.ready=false`.
2. Przygotuj import: `node scripts/prepare-settings.mjs /private/tmp/cp-settings`. Pliki `settings.sql` i `settings.json` zawierają pełne warunki, dane spółki i akapit Resend dla docelowej produkcji. Przejrzyj je, a następnie importuj SQL. Dokumenty muszą odpowiadać faktycznym dostawcom. Nie przenoś opisu Vercel wprost do innego hostingu.
3. Wyłącz publiczną rejestrację w Supabase Auth. Utwórz indywidualne konta zespołu i wpisz uprawnione adresy do `ADMIN_EMAILS`. Skonfiguruj dostęp i MFA zgodnie z możliwościami dostawców; nie współdziel haseł.
4. Uzupełnij zmienne backendu według `.env.example` w ustawieniach Vercel. Sekrety nigdy nie mają prefiksu `VITE_` i nie trafiają do Git. Wygeneruj niezależne losowe sekrety co najmniej 32 znaków. APP_ORIGIN musi być dokładnym adresem strony (bez końcowego ukośnika). Dostosuj TRUST_PROXY_HOPS do faktycznej ścieżki proxy.
5. Zaloguj się do `/admin`, dodaj obsługiwane cmentarze i otwórz dni zespołu oraz cmentarzy 24–31.10.2026. Puste pole limitu oznacza brak limitu, brak rekordu dnia — dzień zamknięty. Podgląd ma jeden jawnie przykładowy cmentarz; nie jest importowany do produkcji.
6. Skonfiguruj zewnętrzny harmonogram: `POST /api/internal/outbox` co minutę, `POST /api/internal/retention` codziennie, z nagłówkiem `Authorization: Bearer <CRON_SECRET>`. Sprawdzaj odpowiedzi i błędy; sam endpoint nie jest harmonogramem. Nie utworzono płatnego planu ani usługi schedulera.
7. Ustal dostęp spółki do danych i dostawców, obsługę reklamacji/RODO/incydentów, retencję Gmail/CSV/urządzeń, własne logi do 30 dni oraz kopie do maksymalnie 90 dni po usunięciu danych aktywnych. Przetestuj odtworzenie. Kod nie kontroluje kopii poza systemem ani logów dostawców.
8. Uruchom `pnpm check:release` w środowisku backendu. Po faktycznej weryfikacji ustaw BUSINESS_ROLES_CONFIRMED, DOCUMENTS_APPROVED i OPERATIONS_CONFIRMED na `true`, APP_MODE=production, SUPABASE_REGION=eu-central-1. To oświadczenia operatora o wykonanych czynnościach, nie automatyczne testy dostawców.
9. Przeprowadź testy z `docs/ODBIOR.md` na oddzielnych danych testowych. Dopiero po nich ustaw `settings.ready=true`. W razie problemu ustaw `false`: nowe zgłoszenia zostaną wyłączone.
10. Po gotowości rzeczywistego serwisu ustaw podczas budowania `PUBLIC_LAUNCH=true`, `SITE_PUBLIC_URL=https://adres-produkcji` oraz potwierdzenie ról i dokumentów. Build przygotuje metadane, robots i sitemap. Podgląd pozostaje noindex. Przed tym usuń etykietę projektu dokumentów, ustawiając `documentsApproved=true` w kopii treści po zatwierdzeniu przez spółkę; API produkcyjne używa warunków z bazy.

## Obsługa umowy

Zgłoszenie → telefon → pełna oferta e-mailem → rzeczywista odpowiedź klienta → utrwalenie odpowiedzi w panelu → zaliczka → realizacja → zdjęcia i rozliczenie → reszta w 24 godziny od odbioru.

Panel nie czyta Gmail i nie stwierdza samodzielnie prawnej skuteczności wiadomości. Operator sprawdza nadawcę, treść, konkretną ofertę, moment odbioru oraz osobne żądanie wcześniejszego rozpoczęcia. Oferty zawierają pełne warunki w treści e-maila, możliwej do zachowania. Rachunek i terminy wpisuje operator; żaden numer nie jest wymyślony. Dowód akceptacji i oferta są przechowywane osobno od zgłoszenia.

Zdjęcia z wykonania wysyła operator przez firmową pocztę. Panel wymaga identyfikatora wiadomości i dowodu odbioru zdjęć oraz rozliczenia przed oznaczeniem wykonania. Wpłaty i zwroty odnotowuje się po rzeczywistym przelewie. System nie łączy się z bankiem, nie wystawia paragonów i nie zastępuje księgowości.

## Hosting podglądu

chatgpt.site udostępnia statyczny podgląd, bez Express/Supabase i przyjmowania zgłoszeń. Informacje o prywatności/cookies zawierają osobny opis hostingu podglądu. Dotychczasowy prywatny dostęp Sites został zachowany. Produkcyjne zgłoszenia są przygotowane do uruchomienia na Vercel lub serwerze Node po konfiguracji powyżej.
