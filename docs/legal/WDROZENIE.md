# Instrukcja wdrożenia — dokument wewnętrzny

Pakiet przygotowany 16.10.2026 dla modelu: SO SOCIAL jest rzeczywistym usługodawcą, stroną umów, odbiorcą płatności i administratorem danych. Użytkownik wskazał, że spółka będzie rozliczać paragony i faktury; nie potwierdzono jeszcze pełnego przejęcia tych pozostałych ról. Wystawianie dokumentów sprzedaży samo w sobie nie wystarcza do uznania spółki za administratora danych lub stronę umowy. Przed publikacją osoba uprawniona po stronie spółki musi potwierdzić zgodność tego modelu z rzeczywistością.

## Dane i umocowanie

Dane firmy pochodzą z profilu ALEO wskazanego przez użytkownika i zostały porównane z drugim publicznym katalogiem KRS. Profil wskazuje Marki, mimo słowa Tłuszcz w adresie URL. Bezpośrednie pobranie aktualnego odpisu z API Ministerstwa Sprawiedliwości nie powiodło się; nie traktować katalogów jako urzędowego odpisu. Przed publikacją sprawdzić aktualny odpis KRS, adres do rzeczywistego odbioru listów, sąd, kapitał oraz osobę uprawnioną do reprezentacji.

Brak Jakuba Marfianego lub Mikołaja Mizerskiego w KRS nie wyklucza pracy na rzecz spółki. Potrzebne jest faktyczne upoważnienie do wykonywanych czynności; nie podpisano i nie udzielono go przez samo przygotowanie tego pakietu. Uprawnienie do przyjmowania umów i dostęp do danych powinny odpowiadać faktycznej relacji ze spółką. Jeżeli działacie jako niezależni przedsiębiorcy przetwarzający dane dla spółki, trzeba ocenić konieczność umowy powierzenia; jeśli pod jej bezpośrednim kierownictwem, określić upoważnienia, poufność i dostępy. Nie tworzymy fikcyjnego porozumienia współadministratorów: w przyjętym modelu administratorem jest jedna spółka.

Dostęp do konta Gmail, Supabase, hostingu i rachunku musi być legalnie zapewniony spółce. Wyłączyć osobiste współdzielone hasła, wdrożyć indywidualne dostępy i MFA. Bezpłatnego Gmail nie należy automatycznie opisywać jako usługi z biznesową umową powierzenia Google Workspace — sprawdzić właściwy wariant usługi i podstawę udostępnienia danych; w razie potrzeby przenieść obsługę na pocztę z odpowiednimi warunkami dla spółki.

## Zmiany strony przed włączeniem zgłoszeń

Pakiet nie zmienia kodu, ustawień bazy ani publikacji strony. USTAWIENIA_DO_WDROZENIA.json zawiera dane firmy i teksty dokumentów z ready=false; to materiał do kontrolowanego importu, nie automatyczne uruchomienie.

1. Zastąpić robocze dokumenty właściwymi tekstami i pokazać je także w podglądzie. Wyświetlić pełną tożsamość, KRS, sąd i kapitał w stopce; obecny typ konfiguracji aplikacji eksponuje jedynie część pól.
2. Zmienić formularz, przycisk, potwierdzenie odbioru, FAQ i opis procesu według 05_FORMULARZ_I_WIADOMOSCI.md. Obecny formularz ma przycisk odpłatnego zamówienia i checkbox akceptujący cenę; jest to rozbieżność z nowym modelem niewiążącego zgłoszenia. Sam import regulaminu jej nie naprawi.
3. Wprowadzić etap oferty i utrwalenia e-mailowej akceptacji, datę zawarcia umowy i dowód odrębnego żądania wcześniejszego rozpoczęcia. Obecny szablon accepted i panel statusów nie stanowią tego etapu. Nie oznaczać automatycznie „Przyjęte” przed faktyczną akceptacją klienta.
4. Termin 14 dni liczyć od rzeczywistego zawarcia umowy, a nie od formularza. Obecny walidator i checkbox w formularzu nie zastępują oświadczenia po otrzymaniu ostatecznej oferty. Przygotowany tekst przewiduje ponowne utrwalenie żądania przy akceptacji oferty.
5. Przekazać pełne warunki i formularz odstąpienia w wiadomości lub stałych załącznikach możliwych do zachowania. Nie wysyłać wyłącznie linku do zmiennej strony. Pole „termin ważności”, terminy płatności, rachunek i dane nagrobka w szablonach muszą być każdorazowo uzupełnione. Rachunek jest podawany po rozmowie; brak numeru w regulaminie jest zamierzony.
6. Rachunek i odbiorca wpłaty mają odpowiadać SO SOCIAL. Sposób dokumentowania sprzedaży, w tym paragony/faktury i obowiązek kasy, potwierdza spółka z księgowością; sam pakiet nie rozstrzyga jej obowiązków fiskalnych ani zakresu PKD.

## Dostawcy i retencja

Użytkownik wskazał Supabase Frankfurt. Sprawdzić region rzeczywistego projektu: eu-central-1, nie jedynie ogólny wybór Europe. Polityka wymienia Supabase, Vercel i Google jako model docelowy. Wersja na chatgpt.site ma innego dostawcę dostępu/hostingu; przed publikacją polityki na tym adresie dopasować opis hostingu. Nie używać tej samej listy bez sprawdzenia dla obu domen.

Resend występuje w przygotowanym backendzie, lecz nie potwierdzono jego uruchomienia. Obecna polityka nie przedstawia go jako aktywnego dostawcy. Przed jego podłączeniem dodać poniższy akapit do pkt 5 polityki oraz informacje o właściwym transferze:

„Automatyczne wiadomości związane ze zgłoszeniami wysyłamy za pośrednictwem Resend, dostawcy opisującego warunki przetwarzania w https://resend.com/legal/dpa. Przekazujemy mu adres e-mail oraz dane zawarte w wysyłanej wiadomości. Usługa i jej podwykonawcy mogą przetwarzać dane poza EOG, w tym w Stanach Zjednoczonych, z zastosowaniem mechanizmów wskazanych w DPA, właściwych dla danego transferu”.

Sprawdzić faktyczną tożsamość kontrahenta i warunki Resend przy zakładaniu konta; ograniczyć treść wiadomości do danych niezbędnych. Analogicznie uwzględnić innego wybranego dostawcę SMTP, jeśli zastąpi Resend. Umowy DPA i zabezpieczenia transferów wymagają oceny i związania nimi spółki, nie samego linku w polityce.

Okresy 90 dni dla niepotwierdzonych zgłoszeń i zdjęć, 30 dni dla własnych logów i maksymalnie 90 dni w kopiach zapasowych to proponowana polityka operacyjna, nie potwierdzenie już działających mechanizmów. Przed publikacją należy je wdrożyć albo zmienić dokument na faktyczne okresy. Uwzględnić Supabase Storage, wiersze zamówień, outbox, eksporty CSV, skrzynkę pocztową, urządzenia ekip i kopie. Zdjęcia dowodowe wymagające dłuższej retencji wyodrębniać z uzasadnieniem. W Supabase przetwarzanie zdjęć w kodzie usuwa EXIF, ale eksportowane kopie poza aplikacją również wymagają kontroli.

Zabezpieczyć system, obsługę żądań RODO i incydentów. Ustalić, kto w spółce przyjmuje wnioski, kto wykonuje usunięcia, kto zgłasza naruszenia. Nie deklarować powołania ani braku IOD bez sprawdzenia; jeśli IOD wyznaczono, dodać jego dane kontaktowe.

## Przyjęte zasady handlowe

Zachowano ceny 199/299/449 zł i zaliczki 50/75/150 zł. Reszta przelewem w ciągu 24 godzin po przekazaniu zdjęć i rozliczenia. Termin wpłaty zaliczki i ważności oferty jest ustalany w konkretnej ofercie przed akceptacją; nie wymyślono numeru rachunku.

Przyjęto dodatkową bezpłatną rezygnację przed rozpoczęciem fizycznych prac, brak automatycznego przepadku zaliczki i zwrot w 14 dni. To korzystne dla klienta zobowiązanie umowne, wymagające stosowania przez spółkę. Zmiana pogody nie oznacza jednostronnego przesunięcia terminu. Regulamin nie przewiduje automatycznej zamiany kwiatów, dopłat ani wyłączenia odpowiedzialności za uszkodzenia.

## Źródła sprawdzone 16.10.2026

- Dane spółki: https://aleo.com/pl/firma/so-social-spolka-z-ograniczona-odpowiedzialnoscia-tluszcz
- Porównanie danych i sądu: https://krs-pobierz.pl/so-social-spolka-z-ograniczona-odpowiedzialnoscia-i0000995470
- Ustawa o prawach konsumenta, zwłaszcza art. 7a, 12, 20, 21, 27–38: https://eli.gov.pl/api/acts/DU/2024/1796/text.html
- Informacje o zawieraniu umów telefonicznych: https://prawakonsumenta.uokik.gov.pl/pytania-i-odpowiedzi/telemarketing/ (część dotycząca umów; historyczne odniesienie strony do Prawa telekomunikacyjnego nie jest podstawą obecnych reguł marketingu).
- Terminy odstąpienia: https://prawakonsumenta.uokik.gov.pl/prawo-odstapienia-od-umowy/terminy-odstapienie/
- Skutki odstąpienia i zwroty: https://prawakonsumenta.uokik.gov.pl/prawo-odstapienia-od-umowy/skutek/
- Rozliczenie rozpoczętego świadczenia: https://prawakonsumenta.uokik.gov.pl/prawo-odstapienia-od-umowy/koszty/
- RODO, zwłaszcza art. 5, 6, 13, 15–22, 28, 32–34 i rozdział V: https://uodo.gov.pl/pl/file/1460
- Supabase: https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq oraz https://supabase.com/legal/customer-resources/data-processing-addendum
- Vercel: https://vercel.com/legal/dpa
- Google: https://policies.google.com/privacy?hl=pl
- Warunki biznesowego przetwarzania Google nie obejmują automatycznie każdego Gmail: https://support.google.com/google-workspace-individual/answer/10757067?hl=en
- Resend, do uwzględnienia przy aktywacji: https://resend.com/legal/dpa

Dokumenty klienckie są opracowanym modelem umownym; nie stanowią potwierdzenia wdrożenia, podpisu za spółkę ani potwierdzenia, że spółka już przyjęła opisane role.
