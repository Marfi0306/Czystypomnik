# Czysty Pomnik

Strona: https://czystypomnik.waw.pl/ · Panel: https://czystypomnik.waw.pl/admin

Strona oferty pielęgnacji nagrobków w Warszawie. React, TypeScript i Vite; backend Express i Supabase.

## Uruchomienie

Node.js 24 i pnpm 11.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm test` uruchamia testy, `pnpm build` buduje stronę, a `pnpm start` uruchamia serwer Node. Zmienne backendu określa `.env.example`; sekrety należy wprowadzić w ustawieniach hostingu, bez prefiksu VITE_.

Konfiguracja domyślna to demonstracja: formularz nie wysyła danych i nie zawiera umów. Plik `vercel.json` obsługuje frontend oraz API. Sites publikuje statyczny podgląd. Dokumenty dla odwiedzających są w `docs/legal/`; instrukcje wewnętrzne są przechowywane poza publicznym repozytorium.
