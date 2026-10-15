# Co blokuje przyjmowanie rzeczywistych zamówień

1. Tożsamość usługodawcy i administratora danych: imię/nazwa, adres, status działalności i wymagane identyfikatory. Właściciel podał, że firma nie jest zarejestrowana. Nie rozstrzygnięto, w jakiej formie usługi będą świadczone. Nie zakładamy, że rejestracja jest jedyną dopuszczalną formą; trzeba ustalić właściwy model i odpowiednio uzupełnić walidację danych firmy.
2. E-mail kontaktowy, adres operacyjny odbierający zamówienia, domena nadawcza i dane administratorów.
3. Supabase/Auth/Storage i hosting backendu Node, Resend lub docelowy dostawca e-maili, domena i scheduler outbox. Podgląd Sites jest dostępny osobno i nie zastępuje tych integracji.
4. Instrukcja wpłaty i termin zaliczki, sposób rozliczenia pozostałej należności, zasady zmiany dnia/pogody, rezygnacji, reklamacji i zwrotów. Kwoty 50/75/150 zł po potwierdzeniu są już rozstrzygnięte.
5. Zatwierdzone dokumenty: regulamin, prywatność, odstąpienie, faktyczne cookies, retencja, dostawcy i transfery. Uzupełnić projekty z `docs/legal/` i wprowadzić pełne wersjonowane teksty do konfiguracji.
6. Katalog wszystkich cmentarzy Warszawy i potwierdzenie otwartych dni 24–31.10.2026 oraz warunków wejścia. Właściciel ustalił brak limitu pracy, więc nie oczekujemy wymyślonych limitów. Trzeba otworzyć rekordy dni w bazie; nie wystarczy kalendarz demonstracyjny.
7. Potwierdzenie praw do wykorzystania materiałów wizualnych w finalnej ofercie. Właściciel wskazał oznaczenie „Materiał utworzony przy użyciu SI”; podpisy są pod zdjęciami. Wizualizacja nie może być przedstawiana jako autentyczna realizacja.
8. Testy na docelowej infrastrukturze: niezależne równoległe połączenia przy ostatnim miejscu, uprawnienia Storage/Auth, dostarczenie e-maili, backup i odtworzenie, monitoring kolejki i retencja zdjęć.

Zgoda na publikację została udzielona. Nie jest potrzebne ponowne zatwierdzenie publikacji podglądu. Wyłączenie zamówień wynika z braku powyższych danych i integracji.
