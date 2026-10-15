# Informacja o cookies i przechowywaniu danych

Podgląd Czysty Pomnik nie uruchamia analityki, Meta Pixel, reklamowych cookies, localStorage ani nagrywania sesji. Dane testowego formularza pozostają w pamięci karty. Ustawienia informacyjne ze stopki nie zapisują preferencji, ponieważ nie ma opcjonalnych kategorii do włączenia.

Docelowy panel administratora używa niezbędnego ciasteczka `cp_session`: podpisana sesja logowania, `HttpOnly`, `SameSite=Strict`, `Secure` w produkcji, ścieżka `/api/admin`, ważność maksymalnie 1 godzina. Wylogowanie usuwa ciasteczko. Sesja nie służy marketingowi i nie jest wymagana od klienta zamawiającego usługę.

Hosting może stosować techniczne mechanizmy dostępu lub ochrony przed nadużyciami. Przed produkcją administrator [uzupełnić tożsamość] powinien sprawdzić rzeczywiste nagłówki i cookies hostingu/domeny, ich dostawców, czas przechowywania i podstawę stosowania. Nie deklarować nieistniejących kategorii ani włączać śledzenia na podstawie tego projektu.

Jeżeli później pojawi się analityka lub marketing, wymagane mechanizmy zgody muszą poprzedzać ich uruchomienie. Odrzucenie i wycofanie powinny być równie łatwe jak akceptacja, a zamówienie musi pozostać dostępne niezależnie od zgody na marketing.
