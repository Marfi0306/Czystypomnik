# Powiadomienia o zgłoszeniach

Resend wysyła alerty wyłącznie na `czystypomnikwarszawa@gmail.com`, z adresu
`Czysty Pomnik <powiadomienia@mail.czystypomnik.waw.pl>`. Wiadomość zawiera
kontakt klienta, wybrany pakiet, dzień, cmentarz, lokalizację i link do panelu.
Zdjęcia pozostają w prywatnym magazynie, dostępnym z panelu.

`MAIL_MODE=manual` pozostaje włączone: oferty i korespondencję do klientów
wysyła operator z Gmaila. Automat nigdy nie pobiera ich z kolejki.

Supabase Cron `czysty-pomnik-owner-alerts` sprawdza kolejkę co minutę.
Gdy istnieją oczekujące alerty, wywołuje chroniony endpoint
`POST /api/internal/owner-notifications`. Osobny `OWNER_NOTIFY_SECRET`
znajduje się w Vercel Production i Supabase Vault (`owner_notify_secret`).
Nie zapisuj jego wartości w repozytorium ani dokumentacji.

Worker pobiera najwyżej dwie wiadomości na wywołanie, blokuje je transakcyjnie
i wysyła z kluczem idempotencji równym identyfikatorowi wiadomości. Po błędzie
ponawia z rosnącym opóźnieniem, najwyżej 8 prób. Po przerwanym wywołaniu
blokada wygasa po 5 minutach. Błąd wiadomości nie usuwa zgłoszenia.
W panelu przy nieudanym alercie można wybrać „Ponów wysyłkę”.

`sent` oznacza przyjęcie przez Resend. Dostarczenie sprawdzaj w Resend Emails
albo przez chroniony `GET /api/internal/owner-notifications/<outbox-id>`;
zwraca jedynie stan kolejki i zdarzenie dostawcy. Klucz Resend ograniczony do
wysyłki może nie pozwalać na odczyt zdarzeń: odpowiedź zawiera wtedy
`event: null` i przyczynę w `verification`. Sprawdź dostarczenie w panelu
Resend lub skrzynce Gmail; do samej wysyłki nie potrzeba szerszych uprawnień.
`delivered` oznacza
przyjęcie przez serwer odbiorcy, nie odczytanie ani umieszczenie w Odebranych.

Przy odtwarzaniu środowiska zastosuj migracje, zapisz zgodne sekrety,
wdroż backend, a następnie aktywuj zadanie poleceniem `cron.alter_job`.
Migracja tworzy harmonogram nieaktywny, aby nie wywoływał starszego backendu.
W razie awarii sprawdź Cron History, `net._http_response`, Vercel Logs
i nieudane alerty w panelu. Nie trzeba zmieniać DNS zweryfikowanej domeny.
