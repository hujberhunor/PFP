# PocketRoom

Mobil-first, magyar nyelvu koltsegkoveto app valtozo napi kiadasokhoz. A cel nem teljes penzugyi adminisztracio, hanem gyors valasz arra, hogy mennyi fer meg bele a havi keretbol, es havi CSV-ben at lehessen vinni a kolteseket Excelbe.

## Cel

- Valtozo napi kiadasok kovetese kategoriankent.
- A havi budget a fo keret.
- A heti nezet csak a havi maradek aktualis heti leosztasa.
- Havi CSV nezet es export Excelhez.
- Kulon, a havi budgetbe nem beleszamito utazas / event wallet modul.

## Nem cel

- Fix kiadasok kovetese, pl. koli, Spotify, BKK, iCloud.
- Eves vagy nagy egyszeri tetelek kovetese, pl. laptop, koncertjegy.
- Banki integracio.
- Teljes konyvelesi app.

## Jelenlegi stack

- Vanilla HTML, CSS, JavaScript.
- Nincs framework es nincs build step.
- Adattarolas: `localStorage`.
- Futtatas lokalisan:

```bash
python3 -m http.server 8000
```

Majd: `http://localhost:8000`

## Budget logika

### Havi keret

A havi keret a fo igazsag. A kategoriakhoz havi limit tartozik, es a havi nezet ezt hasonlitja az aktualis honap kolteseihez.

### Heti keret

A heti keret nem onallo budget. A heti nezet azt mutatja, hogy a havi keretbol a het elejen megmaradt osszegbol mennyi jut az aktualis het honapba eso napjaira.

Pelda:

```text
heti kategoriakeret =
(havi kategoriakeret - honapban a het elott mar elkoltott osszeg)
/
honapbol a het elejetol hatralevo napok
*
aktualis het honapba eso napjai
```

Kovetkezmeny: ha az elso heten tulkoltes tortenik, a masodik heti keret automatikusan kisebb lesz.

## Jelenlegi funkciok

- Heti dashboard kategoriakartyakkal.
- Heti es havi osszesito nagy maradek osszeggel es progress barral.
- Havi nezetben napok es penz szerinti maradek jelzes.
- Jobb also lebego `+` gomb uj kiadashoz.
- Uj kiadas mentese utan telefonrezges, ahol a bongeszo tamogatja.
- Kategoriara kattintva megjelennek a kategoriaba tartozo heti kiadasok.
- Havi CSV tabla:
  - Category
  - Amount
  - Description
  - Date
  - Acc
  - Muvelet
- Havi CSV sor szerkesztese es torlese.
- Kategoria hozzaadas.
- Kategoria torles megerositessel.
- CSV export aktualis honapra vagy minden adatra.
- Kulon utazas modul sajat CSV exporttal.

## CSV / Excel cel

Az app fo outputja az Excelbe viheto CSV. A havi CSV tablaban a rekordok javithatok, igy:

- elrontott kiadas javithato,
- masik napra konyvelt kiadas atirhato,
- felesleges rekord torolheto.

Kovetkezo javitas: CSV export kapjon UTF-8 BOM-ot a magyar Excel kompatibilitas miatt.

## Utazas / event wallet cel

Az utazas modul legyen kulon allo event wallet, ami nem keveredik a havi budgettel, es kulon CSV-be exportal. A cel peldaul egy fesztival, varoslatogatas vagy hetvegi ut kulon penztarca-szeru kovetese.

Shared/Splitwise elszamolas egyelore nem cel. Most a fokusz az, hogy sajat utazasi koltesek kulon CSV-ben legyenek, a fo havi tarcatol fuggetlenul. Az input flow legyen majdnem ugyanaz, mint a heti kiadasnal: kategoria, osszeg, megjegyzes, opcionális penznem.

### Javasolt adatmodell

Utazas:

```text
id
name
baseCurrency
budget
expenses[]
```

Koltes:

```text
id
date
description
amount
currency
category
note
```

### Penznemek

- Minden koltesnek lehet sajat `currency` mezoje.
- Az utazasnak legyen `baseCurrency`, ebben tortenik az osszesites.
- A koltes penzneme opcionális input, alapbol a tarca penzneme.

### Utazas UI javaslat

Fooldal:

- aktiv utazas valaszto,
- osszes koltes base currency-ben,
- opcionalis event budget maradeka.

Uj koltes:

- datum,
- kategoria,
- osszeg,
- megjegyzes,
- opcionális penznem,
- megjegyzes.

Lista:

- pure CSV-szeru tabla,
- szerkesztes,
- torles,
- export.

### Utazas CSV javasolt oszlopok

```text
Trip,Date,Category,Amount,Currency,Note
```

## Prioritasok

1. Stabilizalni a mostani havi budget + CSV flow-t.
2. CSV export BOM hozzaadas.
3. Uj kiadas formba opcionális datum mezo.
4. Utazas/event wallet modul teljes rewrite a fenti adatmodell szerint.
5. PWA shell: `manifest.json`, `sw.js`, offline app shell.
6. Kesobb opcionális Google Sheets sync.

## Nev

Valasztott nev: **PocketRoom**
