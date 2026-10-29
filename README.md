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

## Beta 0.5.9 — Condivisione backup iPhone/iPad senza accesso Google incorporato (29 ottobre 2026)

Il test reale Google OAuth dalla PWA iOS/iPadOS avviata dalla Home ha restituito **«Impossibile eseguire l'accesso — Questo browser o questa app potrebbero non essere sicuri»**. È un blocco Google degli accessi in browser incorporati, non un difetto verificato del client OAuth.

**Modifica correttiva:** su iPhone/iPad SalvaCivici ora mostra **«Condividi backup su Drive»** nella schermata Dati e apre il menu Condividi nativo del dispositivo con un file JSON generato dall'archivio locale della *stessa* app Home. Il click richiede conferma, non chiede un altro login Google incorporato, non modifica i dati in archivio e non tocca My Maps. Per salvare su Google Drive, l'utente deve selezionare Google Drive fra le destinazioni di condivisione e completare il salvataggio; se non disponibile, usare «Salva su File» e trasferire in Drive. Il file si chiama `SalvaCivici_backup_YYYY-MM-DD_HH-MM-SS.json` per conservare lo storico. **Non sovrascrive il backup precedente e l'app non può verificare autonomamente che il file sia arrivato su Drive.** Il successivo controllo deve avvenire in Google Drive.

La precedente modalità di backup OAuth diretto rimane prevista nei browser non iOS supportati, ma aprire SalvaCivici in Safari su iPhone/iPad non permette di presumere l'accesso all'IndexedDB della PWA installata: gli archivi sono separati. Non ricreare l'icona Home. Manteniamo il manifest, la URL e `salvacivici-mappa-recapito-v1` invariati.

**Test simulati:** su iOS apertura della condivisione con civici di test; nessun accesso OAuth/Google API; annullamento senza salvataggio; archivio vuoto; gestione cancellazione del menu condivisione. **Test manuale necessario** sul dispositivo per verificare che Google Drive compaia nel menu e riceva il file.

## Beta 0.6.0 — archivio cloud condiviso iPhone/iPad (29 ottobre 2026)

**Novità:** la schermata Dati ora presenta «Archivio cloud condiviso». La web app Firebase del progetto `salvacivici-mappa-recapito` è già configurata. **Non è necessario inserire manualmente projectId né API key e non viene più usato il menu Condividi iOS per la sincronizzazione ordinaria.** Le vecchie funzioni di esportazione JSON/CSV restano disponibili.

**Prima connessione:** sul primo dispositivo aprire SalvaCivici dall'icona Home, aggiornare a Beta 0.6.0, andare in Dati e scegliere «Crea account SalvaCivici» con email e **nuova password per l'archivio** (non la password Google); poi accedere sul secondo dispositivo con lo stesso account. Non inviare password a ChatGPT. La modalità di accesso Firebase è Email/Password e non apre il popup OAuth bloccato su iOS.

**Modifiche:** la cattura GPS e l'archivio rimangono in IndexedDB locale (funzionano offline). Dopo aver verificato i civici, premere «Sincronizza i dispositivi» e confermare: l'app confronta i dati locali con la copia cloud Firestore, conserva gli ID originali e applica una fusione conservativa. All'apertura, i record **già confermati** possono essere importati in automatico su un dispositivo senza modifiche locali in sospeso; **l'invio delle modifiche rimane manuale**. Se lo stesso ID viene modificato diversamente sui due dispositivi, il sistema si ferma e mostra un conflitto (non sovrascrive).

**Sicurezza:** database Cloud Firestore con regole `firestore.rules` che impediscono accesso pubblico e consentono get/create/update soltanto nella cartella del proprietario autenticato `users/{uid}/snapshots/main`; divieti di list e delete. La chiave Firebase web nel codice è una configurazione pubblica, **non un client secret**. Restano invariati l'identità `manifest.webmanifest`, l'indirizzo GitHub Pages e IndexedDB `salvacivici-mappa-recapito-v1`. Il database precedente non viene cancellato.

**Stato:** verifica logica e simulazioni multi-dispositivo superate; prova reale dell'account Firebase e della sincronizzazione sul dispositivo dell'utente ancora necessaria. Tutti i civici finora registrati nell'app sono dati inventati, per cui conviene controllarli/eliminarli volontariamente prima della prima sincronizzazione; non toccare Google My Maps.

**Nota:** Firestore mantiene l'archivio cloud condiviso, ma **non è un backup su Google Drive**. Per maggiore sicurezza continuare a esportare JSON periodicamente. Limite provvisorio per la copia cloud in un documento: circa 700 KiB.

Istruzioni di configurazione e test: [CLOUD_SETUP.md](CLOUD_SETUP.md). Test locali: `node tests/cloud-merge.test.js`, `node tests/core.test.js`.

## Beta 0.6.1 — Accedi con Google (sperimentale su iOS Home)

Nella scheda **Dati → Archivio cloud condiviso** il pulsante principale è **Accedi con Google**: l'utente può usare il suo account Google su iPhone, iPad e altri dispositivi senza creare una nuova password SalvaCivici. La login è gestita da Firebase Authentication, **non** dall'accesso diretto a Google Drive; l'archivio cloud e le regole Firestore rimangono quelli della Beta 0.6.0.

**Attivazione necessaria nella Firebase Console:** Authentication → Metodo di accesso → Google (abilitato con email di assistenza) e Authentication → Impostazioni → Domini autorizzati → `tetzuya84.github.io`. Nessun client secret va inserito in GitHub, nell'app o in chat. L'accesso alternativo Email/Password rimane disponibile sotto il riquadro espandibile e non modifica i civici.

**Stato tecnico:** login Google tramite `signInWithPopup()` Firebase SDK ufficiale; errori per provider inattivo, dominio non autorizzato, popup bloccato e account diverso gestiti senza cancellare l'archivio. Il vecchio blocco OAuth sulla PWA iOS significa che la compatibilità su iPhone/iPad dalla Home **deve ancora essere provata**. Non si promette il funzionamento su tutti i dispositivi finché non è testato. Non cambiare né ricreare l'icona Home. Il database locale, il manifest PWA e l'identità cloud restano invariati.

Guida completa e precauzioni: [GOOGLE_LOGIN.md](GOOGLE_LOGIN.md). Test mock: `node tests/google-login.test.js`.

## Beta 0.6.2 (29/10/2026)

Corretta una lettera maiuscola errata nella configurazione Firebase web dei due moduli di accesso. Aggiornata la cache PWA. La prova di accesso Google e sincronizzazione reale su iPhone/iPad rimane da completare. Manifest e civici locali invariati.

## Beta 0.6.3 (29/10/2026) — ricezione automatica senza chiudere l'app

**Confermato dal test reale:** un civico fittizio `Kennedy, 51` è stato sincronizzato da iPad e ricevuto su iPhone tramite Google/Firebase. Modificato in `Kennedy, 52` su iPhone e inviato manualmente al cloud, è comparso anche su iPad dopo chiusura e riapertura: sincronizzazione bidirezionale confermata.

**Novità:** per ricevere cambiamenti già pubblicati da altri dispositivi **non è più necessario riavviare l'app**. SalvaCivici controlla Firestore al ritorno in primo piano, entrando in Archivio/Dati, e ogni 30 secondi mentre resta visibile. Dalla scheda Dati è disponibile anche «Controlla aggiornamenti cloud» per richiedere subito il controllo. La ricezione automatica è sospesa se ci sono modifiche locali in attesa, durante l'editing, quando l'app è in background o senza connessione. La risposta Firestore non effettua nessuna scrittura cloud, e il pulsante **Sincronizza i dispositivi** con conferma rimane necessario per inviare nuove modifiche.

**Test effettuati:** simulazioni GET remoto, aggiornamento locale senza scritture cloud, protezione delle modifiche locali pendenti, nessuna interrogazione periodica quando l'app è nascosta. La verifica reale sui due dispositivi resta da ripetere dopo l'aggiornamento. Manifest, indirizzo Home e archivio IndexedDB invariati.

## Beta 0.6.4 — Swipe per sincronizzare dall'Archivio (29 ottobre 2026)

L'utente ha confermato la sincronizzazione bidirezionale tra iPhone e iPad con il civico fittizio Kennedy 52, che si aggiorna anche premendo Sincronizza i dispositivi. Per semplificare l'app, **rimossi entrambi i pulsanti** «Sincronizza i dispositivi» e «Controlla aggiornamenti cloud» dalla scheda Dati.

**Nuovo gesto:** aprire **Archivio**, scorrere fino all'inizio dell'elenco e **trascinare verso il basso per almeno 86 px**; la rotellina mostra la progressione e la scritta «Rilascia per sincronizzare». Al rilascio parte la sincronizzazione cloud (confronto, merge, invio modifiche locali, ricezione modifiche remote), con indicatore durante l'operazione e risultato nell'Archivio. **Il gesto volontario equivale alla conferma dell'invio**, non c'è un secondo pulsante; toccare e scorrere normalmente non invia dati. Il gesto non parte se si è scorsi verso il basso nella pagina, se si interagisce con input o pulsanti, durante un dialogo, su gesture orizzontali/multitouch o se una sincronizzazione è già attiva.

**Sicurezza:** l'invio non avviene in background; la ricezione automatica della Beta 0.6.3 continua solo quando è sicuro farla. La fusione confronta anche il cloud aggiornato e blocca modifiche contemporanee sullo stesso record. In caso di offline, login assente o conflitti, si mostra errore senza cancellare i civici. L'Archivio rimane operativo offline. Manifest, URL Home e IndexedDB locale non modificati.

**Test:** 6 casi simulati del gesto (successo, swipe corto, pagina non in cima, input, multitouch, errore), sintassi dei moduli e controlli version/cache/identità. Da validare realmente su iPhone/iPad con Beta 0.6.4 prima di considerare completo il comportamento nativo dello swipe iOS.
