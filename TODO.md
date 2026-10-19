# Do uzupełnienia w przyszłości

Dane firmy (pole `COMPANY` w `build.py`). Puste wartości są **ukryte na stronie**
(wiersze tabel, akapity i sekcje znikają automatycznie); `python build.py` wypisuje
na końcu, których jeszcze brakuje. Po wpisaniu wartości wystarczy przebudować stronę.

| Pole | Co wpisać | Gdzie się pojawi |
|---|---|---|
| `name` | pełna nazwa firmy | nota prawna, polityka prywatności, regulamin, formularz |
| `form` | forma prawna (np. S.L. / autónomo) | nota prawna |
| `address` | adres siedziby (ulica, numer, kod, miasto) | nota prawna, prywatność, regulamin, formularz |
| `tax_id` | NIF / CIF | nota prawna (po jego wpisaniu pojawia się tabela danych rejestrowych), prywatność, regulamin |
| `vat_id` | numer VAT UE (ESX…) | nota prawna |
| `registry` | Registro Mercantil (tomo, folio, hoja) lub informacja o działalności jednoosobowej | nota prawna, regulamin |
| `capital` | kapitał zakładowy (tylko dla spółki) | nota prawna |
| `permits` | zezwolenia na roboty w przestrzeni publicznej; do tego czasu jest zdanie ogólne | nota prawna, sekcja 4 |

Inne rzeczy do zrobienia:
- `hosting` — obecnie GitHub Pages; zmień przy przeprowadzce (oraz `DOCS_UPDATED`).
- Imiona, nazwiska i zdjęcia zespołu (strona „O nas”, klucz `team.note`) — jest zdanie zastępcze.
- Karta techniczna robota (strona „Jak to działa”, klucz `inside.note`) — jest zdanie zastępcze.
- Podstawa / metodologia szacunku „−60%” (strona główna, przypis `fn-1`) — jest opis ogólny.
- Retencja logów serwera (polityka prywatności) — wpisane „zwykle do 90 dni”; potwierdź u dostawcy hostingu.
- Formularz kontaktowy wymaga hostingu z PHP (GitHub Pages go nie obsługuje).
