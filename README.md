# Czysty Pomnik

Strona oferty pielęgnacji nagrobków w Warszawie, formularz niewiążącego zgłoszenia oraz panel obsługi umów. React / TypeScript / Vite, API Express, Supabase Postgres/Auth/Storage i kolejka Resend. Pakiety 199/299/449 zł, zaliczki 50/75/150 zł po e-mailowej akceptacji indywidualnej oferty.

## Stan 16.10.2026

Wdrożono dokumentację SO SOCIAL, kontakt, pełne dokumenty do czytania/pobrania/druku, formularz zgłoszenia, etap ofert i utrwalenia e-mailowej akceptacji, rozliczenie i procedurę retencji. Sprawdzono dane rejestrowe w urzędowym KRS. Rola spółki i rzeczywiste usługi techniczne wymagają potwierdzenia. Domyślny podgląd **nie wysyła danych ani zdjęć i nie zawiera umów**. Dokumenty są jawnie oznaczone jako projekt do zatwierdzenia.

## Lokalnie

Node 24, pnpm 11. `pnpm install --frozen-lockfile`, następnie `pnpm dev`. API osobno: `node --env-file=.env --import tsx server/start.ts`. Sekrety tylko w `.env` lub ustawieniach hostingu, bez prefiksu VITE_.

- `pnpm test` — funkcje SQL w PGlite, walidacja, wiadomości oraz lokalne HTTP API.
- `pnpm build` — TypeScript, Vite i metadane publikacji.
- `pnpm start` — zwykły serwer Node, używający środowiska hostingu.
- `pnpm check:release` — kontrola brakujących zmiennych, bez ujawniania sekretów i aktywacji.

Vercel: `vercel.json` i `api/index.ts` obsługują frontend/API z jednej domeny. Sites: `.openai/hosting.json` publikuje wyłącznie statyczny podgląd. Zdjęcia SI pozostają podpisane i nie są przedstawiane jako rzeczywiste realizacje.

Pełna instrukcja: [docs/PUBLIKACJA.md](docs/PUBLIKACJA.md). Obsługa: [docs/OPERACJE.md](docs/OPERACJE.md). Testy i ograniczenia: [docs/ODBIOR.md](docs/ODBIOR.md). Braki startu: [docs/BRAKUJACE_DANE.md](docs/BRAKUJACE_DANE.md).
