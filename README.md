# PocketRoom

Mobil-first, magyar nyelvu koltsegkoveto app valtozo napi kiadasokhoz. A cel nem teljes penzugyi adminisztracio, hanem gyors valasz arra, hogy mennyi fer meg bele a havi keretbol, es havi CSV-ben at lehessen vinni a kolteseket Excelbe.

## Cel

- Valtozo napi kiadasok kovetese kategoriankent.
- A havi budget a fo keret.
- A heti nezet csak a havi maradek aktualis heti leosztasa.
- Havi CSV nezet es export Excelhez.
- Kulon, a havi budgetbe nem beleszamito utazas / kozos koltes modul.

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

## Utazas modul jelenlegi allapot

Az utazas resz jelenleg alap mini Splitwise:

- tobb utazas hozhato letre,
- utazasonkent egy alap penznem van,
- vannak resztvevok,
- egy kozos kolteshez egy fizeto tartozik,
- a koltes egyenlo aranyban oszlik meg a kijelolt resztvevok kozott,
- az app kiszamolja az egyenlegeket es az egyszerusitett rendezeseket,
- kulon CSV export van az aktiv utazasra.

### Jelenlegi korlatok

- Egy utazason belul gyakorlatilag egy penznemmel szamol.
- Nincs penzvaltas / arfolyam logika.
- Nincs fizetesi mod: kartya, keszpenz, Revolut, OTP stb.
- Nincs sajat koltes vs kozos koltes kulonvalasztva.
- Csak egyenlo split van.
- Nincs reszaranyos vagy konkret osszeges split.
- Nincs utazason beluli kategoria.
- Nincs szerkesztes / torles a trip kiadasokra.
- Nincs kulon "ki mit fizetett kartyaval/kp-ban" kimutatas.

## Utazas rewrite cel

Az utazas modul legyen kulon allo mini Splitwise + utazasi penztar, ami nem keveredik a havi budgettel, es kulon CSV-be exportal.

### Javasolt adatmodell

Utazas:

```text
id
name
baseCurrency
people[]
expenses[]
exchangeRates[]
```

Koltes:

```text
id
date
description
amount
currency
baseAmount
paidBy
paymentMethod
category
splitMode
splitBetween[]
shares
note
```

### Penznemek

- Minden koltesnek sajat `currency` mezot kell kapnia.
- Az utazasnak legyen `baseCurrency`, ebben tortenik az elszamolas.
- Ha a koltes mas penznemben tortent, kell `exchangeRate` vagy kezzel megadott `baseAmount`.
- CSV-ben mindketto szerepeljen:
  - original amount
  - original currency
  - base amount
  - base currency

### Fizetesi mod

Minden koltesnel legyen `paymentMethod`, peldaul:

- cash
- card
- Revolut
- OTP
- other

Ez azert kell, mert utazasnal gyakran kulon kerdes, hogy kinek mennyi kp-ja fogyott, es mi ment kartyarol.

### Split modok

Minimum:

- `equal`: egyenlo elosztas kijelolt emberek kozott.
- `shares`: reszaranyos elosztas, pl. Hunor 2 resz, Anna 1 resz.
- `amounts`: konkret osszeg szemelyenkent.
- `personal`: sajat koltes, nem kell elszamolni.

### Utazas UI javaslat

Fooldal:

- aktiv utazas valaszto,
- osszes koltes base currency-ben,
- "ki mennyit fizetett",
- "ki mennyivel tartozik",
- egyszerusitett rendezesek.

Uj koltes:

- datum,
- leiras,
- osszeg,
- penznem,
- arfolyam vagy base osszeg,
- ki fizette,
- fizetesi mod,
- split mod,
- resztvevok / aranyok / osszegek.

Lista:

- pure CSV-szeru tabla,
- szerkesztes,
- torles,
- export.

### Utazas CSV javasolt oszlopok

```text
Trip,Date,Description,Amount,Currency,BaseAmount,BaseCurrency,PaidBy,PaymentMethod,Category,SplitMode,SplitBetween,Shares,Note
```

Kulon settlement blokk:

```text
From,To,Amount,Currency
```

## Prioritasok

1. Stabilizalni a mostani havi budget + CSV flow-t.
2. CSV export BOM hozzaadas.
3. Uj kiadas formba opcionális datum mezo.
4. Utazas modul teljes rewrite a fenti adatmodell szerint.
5. PWA shell: `manifest.json`, `sw.js`, offline app shell.
6. Kesobb opcionális Google Sheets sync.

## Nev

Valasztott nev: **PocketRoom**
