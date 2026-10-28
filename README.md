# SalvaCivici – Mappa Recapito

Beta **0.5.8**: applicazione PWA per raccolta locale di civici e coordinate GPS da iPhone.

## GPS migliorato

All'apertura dell'app vengono raccolte fino a 3 letture GPS fresche, seleziona quella con la migliore precisione *stimata* e mostra la dispersione tra le letture. La precisione stimata dal sistema non garantisce l'errore reale: verificare sempre il punto sul posto.

La rilevazione impiega normalmente alcuni secondi dopo il primo fix; se il segnale non arriva, viene comunicato un errore.

## Dati e backup

I civici restano nell'archivio locale IndexedDB dell'app. L'aggiornamento mantiene lo **stesso database** della Beta 0.2. Le nuove versioni **non sincronizzano automaticamente** Google My Maps o Google Drive. Usare periodicamente **Dati → Scarica backup JSON** e **Esporta CSV**.

Repository pubblico: **non aggiungere dati reali dei civici**.

## Verifica codice

`node tests/core.test.js`

## Aggiornamenti app su iPhone (Beta 0.3.1)
Il service worker controlla gli aggiornamenti all'apertura e al ritorno in primo piano (con limite di frequenza). Quando cambia il controller, l'app mostra un avviso «Nuova versione disponibile» e un pulsante «Aggiorna»; non ricarica autonomamente una scheda con dati non ancora salvati. Il rilevamento GPS non viene modificato. L'archivio IndexedDB mantiene il nome e la versione precedenti: `salvacivici-mappa-recapito-v1`.

## Beta 0.3.2 — interfaccia iPhone compatta
La sezione «Nuovo punto» mostra campi, GPS e salvataggio nella stessa schermata sulle dimensioni tipiche di iPhone. L'archivio e le esportazioni continuano a scorrere se necessario. Nessun cambiamento al database IndexedDB, al GPS o ai file esportati. Non viene bloccato lo scroll se la tastiera, la dimensione del testo o uno schermo piccolo richiedono più spazio.

## Beta 0.4 — GPS automatico
All'apertura o al ritorno in primo piano l'app rileva automaticamente la posizione senza pulsante dedicato. Mantiene fino a tre letture e la selezione della precisione stimata migliore. Prima di salvare verifica che il fix abbia meno di 30 secondi e, se necessario, aggiorna automaticamente il GPS. Dopo aver salvato un civico prepara automaticamente un nuovo fix per quello successivo. In caso di errore o permessi negati, non usa coordinate vecchie. Nessuna modifica allo schema IndexedDB: i civici già salvati restano intatti.

## Beta 0.5 — Comune automatico e campo unico
All'apertura il campo testo viene svuotato. Il comune è riconosciuto sul dispositivo tramite poligoni comunali ISTAT (2026), fonte guglielmo/geojson-italy, licenza CC BY; perimetro: Mantova, Brescia e Cremona nel sud della Lombardia. Nessun invio di coordinate a servizi di geocodifica; funzionamento offline dopo il caricamento delle risorse in cache. Il comune può essere corretto manualmente e va verificato vicino ai confini comunali. Si scrive solo «Via e civico» in un'unica casella, es. `Strada Campagnola 51` oppure `Via Roma 73/A`. L'app separa il civico prima di salvare o segnala un indirizzo non riconosciuto. Se manca il comune, il salvataggio resta disabilitato finché non lo si corregge. Nessuna variazione al formato dati o ai backup esistenti.

## Beta 0.5.1 — interfaccia centrata
Testi, titoli, campi, comune automatico, coordinate GPS, avvisi, schede archivio e pagina Dati sono allineati al centro. L'intestazione è centrata. Resta attivo il layout compatto per iPhone; non sono modificati Javascript, API GPS, IndexedDB, salvataggi né esportazioni. La versione del service worker cambia per distribuire il nuovo CSS.

## Beta 0.5.2 — disposizione uniforme nel riquadro Comune e indirizzo
I due gruppi di contenuti del modulo Salva hanno ora spaziature verticali controllate e coerenti: etichetta Comune, nome Comune + pulsante Correggi, etichetta Indirizzo e civico e campo di scrittura. Testi centrati, riquadro compatto, nessuna modifica al GPS, al riconoscimento Comune o ai civici conservati. Il CSS evita margini irregolari nelle etichette, anche quando viene aperto il campo di correzione.

## Beta 0.5.3 — proporzioni logo e intestazione
Il gruppo composto da icona e due righe SalvaCivici / MAPPA RECAPITO è centrato nel riquadro scuro. Il nome è ingrandito e dimensionato visivamente alla larghezza del sottotitolo; il simbolo viene portato all'altezza complessiva delle due righe. Il badge della versione BETA è ridotto e centrato sotto il gruppo. Il resto della schermata e l'archivio locale rimangono invariati.

## Beta 0.5.4 — riquadro GPS uniformato
La sezione Coordinate rilevate è distribuita con spaziature verticali uniformi tra intestazione, coordinate, precisione e messaggio di qualità. Un elemento grafico invisibile bilancia l'icona a sinistra, mantenendo il titolo e la descrizione realmente centrati. Latitudine e longitudine hanno colonne simmetriche. Rimane compatto il layout iPhone; CSS e badge di versione soltanto, senza modifiche al GPS né all'archivio locale.


## Beta 0.5.8 — Backup Google Drive solo su richiesta (29 ottobre 2026)

Nella pagina **Dati** c'è il pulsante «Sincronizza con Drive». Non viene caricato nessun civico in background o quando premi «Salva civico»: prima controlla e correggi i record nell'**Archivio**, poi premi volontariamente il pulsante e conferma.

**Prima connessione, obbligatoria:**
1. In [Google Cloud Console](https://console.cloud.google.com/) crea o seleziona un progetto, abilita **Google Drive API** e configura la schermata di consenso OAuth (in modalità Test aggiungi l'account Google che userai).
2. Crea credenziali OAuth di tipo **Applicazione web**; fra le origini JavaScript autorizzate inserisci esattamente `https://tetzuya84.github.io` (senza il percorso). Questa integrazione usa il modello popup con Google Identity Services.
3. In SalvaCivici → Dati → **Configura collegamento Google**, incolla soltanto il **Client ID** pubblico che termina con `.apps.googleusercontent.com`. NON inserire client secret, password o token.
4. Premi **Sincronizza con Drive**; autorizza Google e conferma il numero di civici. Su iPhone il popup OAuth deve essere verificato nell'app della Home.

L'app chiede il permesso limitato `https://www.googleapis.com/auth/drive.file`. Non accede indiscriminatamente agli altri documenti: crea in **Il mio Drive** una nuova cartella `SalvaCivici - Backup app` con `SalvaCivici_backup.json` (ultimo archivio aggiornato) e `SalvaCivici_backup_YYYY-MM-DD.json` (copia giornaliera; aggiornata più volte nello stesso giorno). Se desideri, dopo la prima sincronizzazione puoi spostare quella cartella sotto `SalvaCivici` da Google Drive. Non presupporre di poter creare subito file dentro una cartella preesistente con il permesso drive.file.

Il token di accesso Google è mantenuto solo nella memoria della sessione, non inserito in GitHub o nel database dei civici. Il Client ID pubblico si salva nella configurazione locale. Se Google non è configurato, o non risponde, i dati restano solo sul dispositivo e la schermata mostra che nessun backup è stato confermato. Rimane il comando **Scarica backup JSON**.

**Limiti:** la sincronizzazione non aggiorna Google My Maps. Gli upload singoli sono limitati a 5 MB (per file più grandi usare per ora l'esportazione manuale). La prova reale della login OAuth su iPhone e della scrittura nel Drive dell'utente è ancora da eseguire. Tutti i civici registrati finora nella app sono fittizi per test, e non vanno trasferiti nelle mappe reali. La PWA mantiene invariati `id`, `start_url`, `scope` e il database `salvacivici-mappa-recapito-v1`.

**Test:** `node tests/core.test.js`; il backup ZIP Beta 0.5.8 contiene anche un test simulato per Drive (`node tests/drive-sync.test.js`).
