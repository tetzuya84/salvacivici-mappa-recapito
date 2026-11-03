# SalvaCivici – Mappa Recapito

Beta **0.6.37**: applicazione PWA per raccolta locale di civici e coordinate GPS, con un'unica sezione Account Google per cloud e backup personale.

## GPS migliorato

All'apertura dell'app vengono raccolte fino a 3 letture GPS fresche, seleziona quella con la migliore precisione *stimata* e mostra la dispersione tra le letture. La precisione stimata dal sistema non garantisce l'errore reale: verificare sempre il punto sul posto.

La rilevazione impiega normalmente alcuni secondi dopo il primo fix; se il segnale non arriva, viene comunicato un errore.

## Dati e backup

I civici restano nell'archivio locale IndexedDB dell'app. L'aggiornamento mantiene lo **stesso database** della Beta 0.2. Le nuove versioni **non sincronizzano automaticamente** Google My Maps o Google Drive. Usare periodicamente **Dati → Scarica tutte le acquisizioni** e **Esporta CSV**.

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

## Beta 0.6.5 — impulso breve all'avvio della sincronizzazione (29 ottobre 2026)

Quando l'utente completa deliberatamente lo swipe verso il basso nell'Archivio, **una singola vibrazione di 20 ms** viene richiesta tramite la Web Vibration API `navigator.vibrate(20)`, prima che inizi la richiesta cloud. Non viene attivata durante lo scorrimento o il trascinamento troppo corto, né quando un'operazione è già in corso. In caso di API assente o errore, la sincronizzazione procede normalmente e rimane visibile la rotellina animata. Nessun feedback aptico al completamento, per evitare vibrazioni superflue.

**Limite iPhone/iPad (iOS 27):** Safari/WebKit non implementa la Vibration API e le vecchie scorciatoie via switch HTML non possono più essere attivate programmaticamente da iOS 26.5. Pertanto **non si può garantire alcuna vibrazione fisica su iPhone** dalla PWA GitHub Pages: il feedback visivo rimane operativo. Non aggiungere hack di switch invisibili che interferiscano con lo swipe o promettere haptic iOS senza verifiche native.

**Sicurezza e continuità:** invariati Firebase, dati locali, manifest, URL Home, merge cloud e regole che impediscono sovrascritture. Aggiornati soltanto `app.js`, badge release `index.html` e versione cache di `sw.js`. Sette simulazioni superate: vibrazione singola, gesto troppo corto, pagina scorsa, input, API assente, API che genera eccezione, gesto ripetuto mentre loading.

## Beta 0.6.6 — Home, logo e aggiornamento GPS da Salva (29 ottobre 2026)

- Apertura dell'app sempre sulla pagina **Salva / Nuovo punto**, anche dopo un ritorno in primo piano o ripristino del documento. Le altre schede restano accessibili.
- Dalla scheda **Salva** uno swipe deliberato verso il basso con la pagina in cima (almeno 86 px) mostra la rotellina, **azzera soltanto la bozza di indirizzo e comune** e avvia una nuova lettura GPS ad alta precisione. Non cancella o modifica alcun civico registrato. Una nuova lettura non riutilizza coordinate precedenti. Durante la rilevazione compare lo stato GPS; in caso di errore l'app segnala il problema senza inventare coordinate.
- Mantiene lo swipe **Archivio** per la sincronizzazione cloud volontaria: i due gesti hanno azioni diverse.
- L'immagine **del logo in testata** ora usa esattamente `assets/icon-192.png`, la stessa risorsa usata dalla Home PWA; aggiornate le icone `assets/icon-192.png` e `assets/icon-512.png` con simbolo del pin turchese a contorno su riquadro scuro.
- Badge release e cache SW portati a **0.6.6**. L'identità dell'installazione `id/start_url/scope: "./"` e la chiave IndexedDB `salvacivici-mappa-recapito-v1` non cambiano; account Firebase e merge cloud invariati.
- **Da verificare sui dispositivi reali**: gesto Salva, ritorno in primo piano e aggiornamento icona preesistente. Su iOS le icone già installate possono essere conservate in cache e non aggiornarsi automaticamente; non eliminare la PWA senza salvare prima i civici.

## Beta 0.6.7 — Fascia logo fissa e centrata in ogni sezione (29 ottobre 2026)

La fascia scura con simbolo e scritte SalvaCivici / MAPPA RECAPITO, e badge BETA 0.6.7, rimane sempre visibile in alto, centrata, durante lo scorrimento delle schermate **Salva**, **Archivio** e **Dati**. La stessa intestazione DOM viene riutilizzata in tutte e tre le sezioni, senza copie o salti di dimensioni tra tab. Implementazione CSS `position:sticky;top:0` con z-index dedicato e stessa altezza/padding per ciascuna schermata, inclusa safe-area di iPhone; a differenza di `position:fixed`, la fascia mantiene lo spazio nel flusso evitando di coprire campi, liste, pop-up e indicatori swipe. La tabbar resta fissa in basso. Nessuna modifica a dati GPS, archivio, IndexedDB, account Google/Firebase, funzioni swipe, manifest o URL Home. Test manuale su iPhone/iPad da completare; verificare permanenza della testata e gli swipe dedicati.

## Beta 0.6.8 — Correzione cornice icona iPad (29 ottobre 2026)

L'utente ha segnalato sull'iPad una cornice scura attorno al simbolo SalvaCivici assente sulla sua icona iPhone. Verificato nel sorgente: il vecchio PNG aveva una fascia esterna #0c1b29, cioè la cornice era effettivamente disegnata dentro l'immagine. Nuove icone generate da SVG del medesimo pin turcoise (#61dbcb), fondo turchese scuro uniforme #1b4b55 **a pieno bordo senza cornice né raggi degli angoli già disegnati** (la maschera con angoli arrotondati la applica il sistema operativo). Nuovi asset versionati: `assets/icon-home-192-v068.png` e `assets/icon-home-512-v068.png`; dimensioni, integrità PNG e SHA Git verificati. Aggiornati `manifest.webmanifest`, `apple-touch-icon`, favicon, immagine del logo sulla testata, `sw.js` (nuova cache), badge `0.6.8`. I vecchi PNG rimangono solo come asset storici, per non interrompere le cache esistenti.

**Limite iPadOS:** una PWA già aggiunta alla schermata Home può mantenere l'icona precedente senza riscaricarla; cambiare icona web non garantisce l'aggiornamento visivo del collegamento già installato. Non eliminare la PWA installata senza prima un backup JSON e verifica dei dati nel cloud: l'installazione può possedere dati locali separati, e rimuoverla può eliminarli. Verificare la nuova immagine in Safari sul sito e sull'icona di una eventuale nuova installazione **solo dopo** backup/sincronizzazione. URL della PWA, ID nel manifest, IndexedDB, GPS e sync Firebase non sono stati modificati.

## Beta 0.6.9 — doppia conferma per svuotare le acquisizioni e swipe laterale (29 ottobre 2026)

### Eliminazione acquisizioni dopo il passaggio a Mappa Recapito

Dalla scheda **Dati** è disponibile **Elimina tutte le acquisizioni**. Due finestre di conferma distinte:
1. numero totale di civici e avvertenza di verificare prima l'importazione negli archivi e soprattutto in Google My Maps;
2. conferma esplicita `ELIMINA TUTTI`, segnala eliminazione sia locale sia dall'archivio cloud condiviso, senza intaccare i JSON di backup su Drive o i pin My Maps.

**Non premere prima di aver verificato la pubblicazione in My Maps**: i CSV/fogli Drive da soli non creano automaticamente i segnaposto. Nessuna eliminazione parte automaticamente e nessuna operazione di distruzione dati è stata eseguita in fase di deploy. Il comando richiede:
- accesso Google Firebase attivo e dispositivo online;
- archivi locale e remoto **identici**. Se differenti, chiede di sincronizzarli nell'Archivio e ricontrollare;
- stesso numero civici dopo le due conferme e nessun cambiamento mentre opera;
- aggiornamento Firestore condizionale alla revisione cloud (`updateTime`), che impedisce la sovrascrittura di modifiche contemporanee;
- **prima** aggiornamento cloud a `[]`, **solo dopo** svuotamento IndexedDB e aggiornamento baseline locale. Se l'aggiornamento cloud fallisce, nessun civico locale viene rimosso.

L'archivio vuoto si propaga ai dispositivi collegati che non hanno modifiche non sincronizzate quando riaprono l'app o ricevono l'aggiornamento cloud. Eventuali nuovi civici o modifiche rimaste solo su un altro dispositivo vengono protetti dalla logica di conflitto; non è garantito che siano eliminati senza una sincronizzazione concordata. Il JSON originale in Drive continua a costituire un backup recuperabile.

### Navigazione con gesto orizzontale

- Da Salva, swipe verso **sinistra** → Archivio → Dati; verso **destra** → direzione opposta. Ai margini non c'è cambio ciclico.
- Viene richiesto uno swipe laterale netto (almeno 78px) e prevalentemente orizzontale. Lo scroll e gli swipe verticali di GPS/Archivio continuano a funzionare.
- Il gesto non parte da `input`, `button`, `a`, `label`, `select`, `dialog` o controlli modificabili; inoltre rispetta l'area del bordo per Indietro Safari.
- Navigazione tramite pulsanti inferiori mantenuta e compatibilità tastiera garantita.

**Test:** `node tests/bulk-clear-swipe.test.js`; i test simulano i casi positivi, offline, senza login, cloud divergente, conteggio locale mutato, errore CAS Firestore e gesti orizzontali/verticali. Test browser reali su iPhone/iPad ancora da effettuare.

URL PWA, `manifest.webmanifest` `id`/`start_url`/`scope`, database IndexedDB e account Google/Firebase restano invariati. Badge e SW cache: **0.6.9**.

## Beta 0.6.10 — barra GPS, 3 letture obbligatorie, navigazione uniforme (29 ottobre 2026)

- **Barra inferiore:** le schede Salva, Archivio e Dati hanno la stessa barra a tre pulsanti, con dimensioni identiche e corrispondenti al layout più grande. Rimangono inalterati gli swipe laterali e quelli verticali per GPS/cloud.
- **GPS compatto:** sostituito il grande riquadro delle coordinate con una barra colorata di **qualità stimata della posizione**, calcolata dall'accuratezza orizzontale in metri restituita dalla Web Geolocation API. La barra non misura la potenza radio, il numero di satelliti o l'intensità effettiva del segnale: i browser iOS non espongono queste informazioni. Le coordinate rimangono disponibili in un piccolo pannello espandibile.
- **Tre letture GPS distinte obbligatorie:** il pulsante «Salva civico» rimane disabilitato fino a 3 fix validi e con timestamp distinti; non esiste più il completamento anticipato con 1–2 letture anche quando il primo GPS ha accuratezza migliore di ±5 m. La posizione utilizzata è quella di accuratezza stimata migliore fra i 3 campioni. Il pulsante resta disabilitato in caso di timeout, errore o mancanza di permesso. In fase di scrittura l'app ricontrolla tre campioni e la freschezza della posizione.
- **Retry sicuro:** con letture incomplete compare «Riprova GPS senza cancellare i campi». Il retry mantiene l'indirizzo digitato; resta disponibile anche il trascinamento verso il basso della schermata Salva, che invece azzera volontariamente la bozza. Per ottenere tre letture su iOS anche da fermi, watchPosition è affiancato da richieste getCurrentPosition ad alta accuratezza; si contano solo timestamp realmente distinti.
- **Sicurezza:** nessuna modifica al nome/versione IndexedDB, ai civici salvati, alla struttura dei record, al manifest/PWA ID, alle regole cloud o alla sincronizzazione manuale Firebase. Il nuovo blocco riguarda solo le acquisizioni future, non la visualizzazione dei civici esistenti.
- **Test:** test funzionali simulati per 1, 2 e 3 letture, timestamp duplicati e timeout con pulsante retry; tests/gps-three-readings.test.js, oltre ai test precedenti. Da verificare ancora su iPhone/iPad reali sul campo, perché l'emissione di fix GPS varia tra dispositivi e browser.
- **Versione:** badge Beta 0.6.10, cache service worker salvacivici-v0.6.10.

## Beta 0.6.11 — Mappa live per posizionare il pin sull'ingresso (29 ottobre 2026)

Motivazione: rilievi del 29/10 in Piazza Castello (Redondesco) riscontrati anche molto spostati; Corte Maestà (Mariana Mantovana) necessita di rettifiche minori. Tre letture GPS distinte possono avere un errore comune e NON certificano l'ingresso.

### Come funziona

- **Salva:** dopo la prima lettura GPS compare il pulsante «Verifica o sposta il pin sulla mappa». Al clic la mappa Leaflet/OpenStreetMap (richiede Internet) apre il punto GPS; il pin è trascinabile e si può anche toccare l'ingresso sulla mappa. Il piccolo punto verde e l'area stimata GPS rimangono come riferimento. La posizione della mappa viene aggiornata durante le tre letture, senza sovrascrivere una modifica manuale in corso.
- **Conferma:** il pulsante «Conferma questo punto» si abilita soltanto con tutte e tre le letture GPS valide e con almeno una tessera cartografica effettivamente caricata. Si può tornare alla posizione GPS, annullare senza scrivere, oppure confermare il punto spostato. Non viene salvato automaticamente alcun civico quando si conferma il pin: occorre ancora toccare «Salva civico».
- **Salvataggio non verificato:** se non si apre la mappa, la normale acquisizione GPS continua a funzionare anche offline con tre letture; un'ulteriore richiesta esplicita avverte che il GPS non identifica l'ingresso, consentendo un salvataggio marcato `gps_unverified`. Le conferme cartografiche scadono dopo 3 minuti; un nuovo fix GPS invalida la precedente conferma.
- **Archivio:** ogni civico mostra «Sposta pin»: apre la stessa mappa centrata sulla posizione memorizzata; la modifica salva lo stesso ID e i dati originali, senza creare duplicati. I vecchi record senza metadati rimangono validi. Le modifiche restano locali finché non si effettua lo swipe di sincronizzazione Archivio. My Maps NON viene aggiornato automaticamente e va corretto separatamente.
- **Tracciabilità:** nuova funzione pura `SC.applyVerifiedPosition` conserva `gpsOriginal:{lat,lon,accuracy}`, `positionSource` (`manual` oppure `gps_confirmed`), `manualOffsetM`, `positionVerifiedAt`; `lat`/`lon` restano le coordinate definitive. `accuracy` descrive soltanto il GPS originale, non la precisione dell'aggiustamento manuale. In CSV le colonne aggiuntive identificano provenienza e coordinate GPS originali; `Precisione_m` è vuoto per pin spostati manualmente.
- **Privacy:** nessuna ricerca inversa di indirizzi/geocodifica. Solo all'apertura volontaria della mappa i server OpenStreetMap ricevono richieste delle tessere relative all'area visualizzata; attribuzione OSM sempre visibile. Leaflet 1.9.4 viene caricato a richiesta con controllo SHA-256. Nessun download offline o prefetch delle tessere OSM. Gli archivi IndexedDB e Firebase, il manifest e la home icon NON vengono ricreati o cancellati.
- **Sicurezza e fallback:** se mappa o Internet non funzionano, il pin non viene marcato come verificato e il processo GPS continua. Gli swipe tra schede e il trascinamento verticale rimangono distinti dai gesti sul dialog della mappa.
- **Test:** eseguiti core (35), GPS tre letture, mappa con Leaflet simulato e casi di conferma, annullamento, modifica archivio e provenienza CSV. Test permanenti `tests/map-review.test.js`. Necessaria prova reale su iPhone prima dell'uso sul campo: trascinamento pin su iOS, rendering tessere e correttezza delle coordinate all'atto di Salva.
- **Deploy:** badge BETA 0.6.11, cache `salvacivici-v0.6.11`, aggiunto `map-review.js` all'elenco asset della cache. Source ufficiale nel branch GitHub main; nessun incremento della versione schema IndexedDB.

### Correzione lotto 29/10 già importato su My Maps

I 26 punti distinti del 29/10 sono segnalati DA VERIFICARE nei fogli Drive; l'utente ha segnalato di averli già importati su Google My Maps. Per correggerli su My Maps, identificare mappa e layer, poi modificare il marker esistente o reimportare una copia rettificata dopo backup del layer. La correzione effettuata dentro SalvaCivici NON sposta automaticamente il marker precedentemente importato in My Maps. Non eliminare mappe o layer con civici storici.

## Beta 0.6.14 — Zoom a due dita senza rimbalzo (30/10/2026)

- Corretto il problema per cui l'utente ingrandiva la mappa con due dita e questa tornava al livello iniziale: la mappa partiva già al massimo zoom 19 e Leaflet applicava il rimbalzo ai limiti.
- `maxZoom:21`, `zoomSnap:0.25`, `touchZoom:true` e `bounceAtZoomLimits:false` per mantenere il livello scelto dopo il pinch; le tessere OpenStreetMap hanno `maxNativeZoom:19` e vengono ingrandite oltre 19, senza richiedere livelli nativi inesistenti. Lo zoom oltre 19 può risultare meno nitido.
- Non è cambiato nulla nell'applicazione delle coordinate, GPS, trascinamento e conferma del pin, dati IndexedDB/Firebase, mappe My Maps o URL PWA.
- Regressione in `tests/map-review.test.js`: opzioni zoom, tenuta del livello scelto dopo un aggiornamento GPS e dopo spostamento manuale del pin; verifica logica simulata riuscita. Prova touch su iPhone ancora necessaria.
- In Beta 0.6.13 è stato rimosso dalla scheda Salvataggi il pulsante di ripristino manuale, mantenendo «Scarica tutte le acquisizioni» e il download JSON.

## Beta 0.6.15 — aggiornamento e icone (30/10/2026)

- Il pulsante «Aggiorna» ora gestisce il nuovo service worker e usa una navigazione con parametro anti-cache, con una singola ricarica protetta da doppio tocco. L'avvio da una versione precedente può dipendere dal vecchio codice ancora in memoria. La verifica non cancella IndexedDB né credenziali.
- Nuovo modulo `updates.js` con protezioni per GPS in corso, finestra mappa aperta e bozza non salvata; ritorno da background e controlli rete mantengono il limite di 45 secondi.
- Service worker v0.6.15 network-first per le navigazioni; la cache delle pagine con query di refresh è normalizzata su `index.html`, evitando copie progressive; attivazione `SKIP_WAITING` supportata.
- La scheda CSV per Google My Maps è stata spostata dopo «Elimina tutte le acquisizioni», mantenendo invariati export e dati.
- Nuovo set di icone ispirato all'immagine di riferimento: fondo verde petrolio, pin turchese, senza testo nell'icona (nome mostrato dal sistema). Asset versionati SVG, favicon 16/32, Apple touch 180, PNG 192, PNG 512 e maskable 512; riferimenti nel manifest e HTML aggiornati. Su iOS l'icona già presente sulla Home può restare in cache: non rimuovere la PWA senza prima un backup verificato dei civici.
- Resta necessario il collaudo touch sul dispositivo reale e la conferma visiva della nuova icona installata; le modifiche non toccano dati GPS, Firebase, Sheets o My Maps.

## Beta 0.6.16 — «Trova pin sulla mappa» per ogni civico

- La scheda del singolo civico nell'Archivio mostra un pulsante principale «Trova pin sulla mappa» (ex «Sposta pin»). Apre la cartografia interna sul pin già salvato; il dialogo indica la via e il civico.
- La mappa consente sola visione oppure tap/trascinamento sul punto reale; la conferma esplicita aggiorna lo stesso record con ID e data originali, GPS di origine conservato, spostamento e timestamp verifica. Chiudere/annullare non salva nulla.
- Distinzione dei badge: «Da verificare» per dati GPS storici non confermati, «Verificato» per conferma senza spostamento, «Pin corretto» per ingresso riposizionato.
- L'esportazione JSON/CSV riflette i record aggiornati. Google My Maps e i fogli su Drive NON si aggiornano automaticamente: richiedono successiva sincronizzazione controllata, evitando duplicati. Le operazioni cloud rispettano il flusso già esistente.
- Test di regressione aggiornato per apertura archivio, nome civico, annullamento senza scritture e conferma mantenendo ID, oltre agli esistenti controlli GPS/pinch. Collaudo su iPhone ancora necessario.

## Beta 0.6.17 — Mappa generale e navigazione Apple Mappe (30/10/2026)

- Nuova scheda «Mappa» accanto a Salva, Archivio e Dati: tutti i record del database locale IndexedDB su mappa Leaflet/OSM, senza trasmettere l'elenco a terzi.
- Numero civico visualizzato sul segnaposto. Colori diversi per «Da verificare», «Verificato» e «Pin corretto». Filtri per comune e stato.
- Toccare il civico apre una scheda con nome, comune, coordinate e i comandi «Verifica pin», «Naviga con Apple Mappe» e «Alternativa: Google Maps». La navigazione usa le coordinate effettivamente salvate, non l'indirizzo rilevato da un geocoder.
- Apple Mappe: URL `https://maps.apple.com/?daddr=<lat>,<lon>&dirflg=d`; Google: `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lon>&travelmode=driving`. L'utente sceglie l'avvio, nessun tracciamento in background. Il routing stradale potrebbe terminare nella strada accessibile più vicina all'ingresso.
- «Verifica pin» apre l'editor preesistente e modifica solo lo stesso record dopo conferma. Sincronizzazione cloud volontaria dall'Archivio invariata. Swipe orizzontale preservato fuori dalla superficie della mappa; pannello cartografico escluso dallo swipe per non interferire con zoom/trascinamento.
- Mappa e libreria Leaflet si caricano solo quando la scheda viene aperta; richiedono Internet. Archiviazione ed esportazioni continuano a funzionare offline. `map-overview.js` in cache service-worker v0.6.17.
- **Privacy**: gli attuali due fogli Sheets e la mappa My Maps Generale mantengono la condivisione «chiunque abbia il link» finché non viene rimossa manualmente tramite Google/Work; repository GitHub e GitHub Pages restano pubblici. Non applicare falsa schermata di accesso lato client: hosting privato richiede controllo server/edge, migrazione accurata di IndexedDB e test su iPhone.

## Beta 0.6.18 — barre bloccate e mappa confinata

- Corretto il difetto visivo confermato da due screenshot su iPad: la mappa Leaflet veniva disegnata sopra l'intestazione con il logo e sopra la barra inferiore.
- Intestazione `position: sticky`, `z-index:2000`, sfondo opaco; navigazione `position:fixed`, `z-index:2000`, sfondo completamente bianco. Entrambe rimangono visibili mentre la parte centrale scorre.
- La mappa generale è contenuta in un proprio stacking context (`isolation:isolate`, `contain:paint`, `overflow:hidden`): livelli Leaflet, pin e controlli non possono superare le due fasce.
- Nessuna modifica ai record, IndexedDB, GPS, Firebase, backup, mappa dei civici o navigazione; solo CSS e versione HTML/SW/README. Dialog di verifica pin resta nel livello superiore nativo.
- Test layout CSS: presenza e priorità di z-index rispetto ai livelli Leaflet, due barre fisse/sticky e mappa isolata; collaudo reale su iPad/iPhone ancora da verificare dopo l'aggiornamento.

## Beta 0.6.19 — «La mia posizione» nella mappa generale

- Pulsante in alto a destra del riquadro cartografico «◎ La mia posizione». La richiesta GPS parte **solo su pressione esplicita**; un fix ad alta precisione, timeout 14 s, `maximumAge:0` per evitare coordinate vecchie.
- La mappa si ricentra sulla posizione attuale (zoom 18), con un punto azzurro bordato bianco e un cerchio di precisione stimata (solo per accuracy ≤500 m), distinti dai civici. Il punto GPS rimane visibile anche filtrando i civici.
- Indicatore per ricerca, successo, permesso negato, scadenza GPS o assenza segnale. Durante la ricerca la pressione ripetuta viene bloccata; una nuova pressione successiva legge un fix nuovo.
- Nessun tracciamento in background, nessuna nuova acquisizione, nessuna scrittura IndexedDB o sincronizzazione Firebase/Drive/My Maps. Tasto confinato nel riquadro della mappa, senza interferire con le barre fisse della Beta 0.6.18.
- Verifica automatica simulata e collaudo iPhone/iPad sono parte del rilascio.

## Beta 0.6.20 — Vista Satellite, rotazione a due dita e bussola iOS

- Aggiunti comandi «Satellite/Stradale» e «Segui bussola» sia nella Mappa generale sia nell'editor «Verifica pin». La cartografia stradale OSM resta predefinita; il livello satellite usa ArcGIS World Imagery (Esri e fornitori, attribuzione obbligatoria), e si carica solo dopo averlo selezionato. L'uso continuativo professionale può richiedere autorizzazione/licenza del fornitore: verificarne le condizioni prima della diffusione o dello sfruttamento commerciale.
- Rotazione manuale con due dita attivata mediante componente leaflet-rotate v0.3.0, distribuito localmente con licenza MIT nel repository. Nessuna dipendenza di rete aggiuntiva per il plugin, ma libreria Leaflet e map tiles richiedono Internet alla prima apertura.
- «Segui bussola» richiede il permesso dei sensori iOS *solo al tocco*; quando disponibile la mappa viene orientata in base al telefono. Un nuovo tocco interrompe la modalità; la rotazione manuale interrompe l'inseguimento per evitare conflitti. Il sensore bussola può non essere disponibile su iPad o in alcuni browser; in tal caso la rotazione a due dita rimane operativa. Nessun ascolto sensori persistente quando si lascia la scheda o si chiude il dialog.
- L'uso della cartografia satellitare invia al provider soltanto le tile dell'area inquadrata, non l'archivio civici; la posizione esatta non viene caricata come record. Le immagini possono essere datate e non costituiscono conferma della posizione del portone. Nessun cambiamento a IndexedDB, GPS multiplo, Firebase, dati cloud, record, backup o Google My Maps.
- Entrambe le barre fisse mantengono il layout approvato 0.6.18; nessun CSS globale di overflow.
- Test statici e simulati da eseguire e prova reale iPhone/iPad ancora necessaria.

## Beta 0.6.21 — Modifica pin nella Mappa generale e pulsanti di salvataggio sempre visibili

- Un pulsante verde «✎ Modifica pin» compare **nel riquadro della Mappa generale** dopo aver toccato un civico e apre lo stesso editor usato dall'Archivio. Anche il pulsante nella scheda di dettaglio è ora «Modifica pin». Se non si è selezionato un civico, il pulsante sulla mappa non è presente. Nessun nuovo record viene creato; si lavora sull'ID selezionato e si salva solo alla conferma.
- Risolto il difetto su iPhone in cui Leaflet e il pannello satellite coprivano i comandi in basso dell'editor. La finestra di correzione ha ora una **zona centrale a scorrimento autonomo** (titolo, istruzioni, controlli mappa, cartografia, coordinate, informativa) e un **footer indipendente sempre visibile** con «Torna al GPS», «Salva pin corretto/Conferma posizione verificata» e «Annulla, non modificare». La mappa è contenuta nel proprio stacking context (`isolation:isolate`, `contain:paint`, `overflow:hidden`), non può più coprire il footer.
- Altezza cartografia responsive in base alla finestra e safe-area iPhone; test su device reale da confermare. Restano invariati satellite, bussola, rotazione a due dita, barra logo e tabbar, acqusizioni GPS, IndexedDB, Firebase, esportazioni, backup e My Maps.

## Beta 0.6.22 — didascalie delle fotografie del 31 ottobre 2026

- IMG_4609.jpeg (didascalia EXIF): «Portare modifica pin della mappa subito sotto la mappa; rimuovere modifica pin dal salvataggio civico; Naviga con apple mappe deve diventate solo naviga». Il comando `overview-edit-pin` passa immediatamente sotto il riquadro mappa e rimane visibile solo dopo scelta di un civico. Tolto il pulsante duplicato `overview-verify` dalla scheda «Civico selezionato». Titolo visibile del link Apple Maps ora «Naviga»; link e funzione restano invariati.
- IMG_4608.jpeg (didascalia EXIF «Togliere»): eliminata la spiegazione «Seleziona un numero…» dalla Mappa generale.
- IMG_4605.jpeg (didascalia EXIF «Togli questa sezione»): rimossa la sezione espandibile «Mostra coordinate GPS» da Salva, insieme alle sue dipendenze di rendering e CSS; coordinate, letture GPS, controllo freschezza, precisione, verifiche, persistenza ed esportazione intatti.
- IMG_4607.png: screenshot di Salva privo di didascalia personalizzata incorporata (solo «Screenshot»); la logica GPS non viene arbitrariamente cambiata. Non confondere lo stato GPS «Da aggiornare» con la verifica manuale del pin, perché la freschezza GPS rimane un controllo di sicurezza del salvataggio.
- Nessuna migrazione database, modifica record, sincronizzazione automatica, aggiornamento cloud o My Maps. Test simulati e verifica pubblicazione richiesti prima di considerare il rilascio completato.

## Beta 0.6.23 — conferma pin non sovrapposta a «Salva civico» (31 ottobre 2026)

- Dalla prova iPhone dell'utente: dopo aver confermato il pin corretto, la notifica scura fixed `toast('Ingresso corretto sulla mappa. Pronto per il salvataggio.')` copriva temporaneamente il bottone «Salva civico» (notifica globale, NON parte della mappa).
- Tolta **solo** la notifica `toast` da `onCaptureConfirm`; il feedback resta nel testo inline `#map-review-note.reviewed`, aggiornato da `updateGpsUI`, che mostra distanza della correzione dal fix originale e «posizione verificata» o, se non spostato, «ingresso confermato». Non interrompe né impedisce il clic su «Salva civico».
- Nessuna modifica a CSS del toast globale (mantiene messaggi errori/salvataggio), IndexedDB, GPS, regole di freschezza, salvataggio, mappe, backup, condivisioni o fonti My Maps. Nessuna cancellazione dati; test su dispositivo da confermare.

## Beta 0.6.24 — intestazione ridotta, versione in Dati (31 ottobre 2026)

- Richiesta dalla didascalia EXIF di `IMG_4596.jpeg`: «Diminuisci altezza fascia scura, sposta versione da qualche altra parte».
- Testata scura: solo logo + dicitura SalvaCivici / MAPPA RECAPITO, centrati; altezza minima `58px + safe-area-inset-top` e spaziature compatte, icona `40px`, scritta SVG `130×42px`. Rimane `sticky` sopra i livelli Leaflet e l'intestazione è condivisa da tutte le quattro sezioni.
- Indicazione `SalvaCivici · BETA 0.6.24` trasferita alla fine della sezione **Dati**, fuori dalla barra scura. Badge precedente rimosso dal DOM della testata. Non vengono duplicati i loghi o create nuove barre fisse.
- Service worker cache v0.6.24 per aggiornare CSS e HTML. Nessuna modifica alle acquisizioni, localizzazione, verifica pin, navigazione, Firebase, backup o Google My Maps. L'anteprima CSS è verificata automaticamente; resa effettiva su iPhone da confermare.

## Beta 0.6.25 — rimozione sfumatura barra di stato iOS 27 (31 ottobre 2026)

- Feedback EXIF IMG_4617.jpeg: «Mi va bene l'altezza della fascia scura, ma non sopporto quella sfumatura». La fascia blu notte 0.6.24 (altezza e logo) è approvata, **non modificarla**.
- La sfumatura mostrata tra status bar e intestazione è applicata dal sistema iOS 27 alle PWA installate con `apple-mobile-web-app-status-bar-style=black-translucent` (segnalazione WebKit 317153). Lo stile gradient non è presente nel CSS dell'app. Un riscontro di test su iOS 27 suggerisce un elemento fixed reale al bordo superiore, alto almeno 6 px e largo almeno l'80% del viewport, per indurre il sistema a usare uno sfondo opaco uniforme.
- Inserito `div.status-bar-color-anchor[aria-hidden=true]` come figlio diretto di body prima di app-shell, e in CSS soltanto sui browser WebKit iOS `@supports (-webkit-touch-callout: none)` un elemento opaco blu notte `position:fixed;top:0;left:0;width:100%;height:8px;background:#0c1b29;z-index:2002;pointer-events:none`.
- Si è scelto di **non cambiare** la meta `black-translucent` perché iOS può fissare il suo valore quando si installa la PWA: richiedere una nuova installazione rischierebbe di separare l'archivio IndexedDB locale dalla vecchia icona. Si conserva inoltre il `viewport-fit=cover`, le safe-area, la testata sticky e la navigazione fissa.
- Nessuna modifica a GPS, dati civici, Firebase, backup, URL, My Maps, autorizzazioni, altezza fascia scura e logo. Validazione automatica HTML/CSS e pubblicazione server; risultato della sfumatura sul reale iPhone va confermato dall'utente, perché il rendering è controllato da iOS.

## Beta 0.6.26 — didascalie IMG_4619/4618/4622/4621/4620 (31/10/2026)

- Precisione GPS: al posto del testo lungo, solo «Precisione stimata» con valore ±metri, entrambi centrati (foto 4619).
- Mappa: all'ingresso si tenta l'attivazione della bussola; l'eventuale permesso iOS viene chiesto nel gesto di apertura, prima del caricamento asincrono della cartografia. L'esito è memorizzato solo nella sessione; dopo un diniego l'utente può riprovare con il pulsante. I listener sensore si fermano uscendo dalla scheda (foto 4618).
- Salva: badge «GPS pronto» eliminato e intestazione «Posizione GPS» colorata secondo precisione stimata GPS del sistema già in uso: buona verde, discreta gialla, scarsa arancione, assente grigia; non è potenza radio né prova di correttezza dell'ingresso (foto 4622).
- Sparisce l'avviso iniziale «Il GPS non identifica necessariamente l'ingresso». Si mostra il feedback verde solo dopo effettiva conferma o correzione del pin (foto 4621).
- Il messaggio «3 letture completate · Puoi salvare il civico» è centrato (foto 4620).
- L'archivio civici IndexedDB, i fix multipli GPS, l'originale GPS di ogni record, il salvataggio, i CSV, la navigazione, Firebase e My Maps non sono cambiati. Prova reale dei sensori su iPhone ancora necessaria.

## Beta 0.6.27 — correzioni da foto IMG_4630/4628/4623/4624 (31 ottobre 2026)

- IMG_4630.jpeg (EXIF «Sfumatura ancora presente»): il workaround CSS Beta 0.6.25 con elemento fixed di 8px non risolve nell'installazione iOS dell'utente. Allineato il markup all'indicazione ufficiale WebKit bug 317153: **rimosso il meta deprecato** `apple-mobile-web-app-status-bar-style=black-translucent` da index.html, mantenendo `viewport-fit=cover`, `theme-color`, intestazione approvata e attuale fixed anchor per campionamento colore. Nota: sulle PWA già installate il sistema iOS può mantenere le impostazioni della status bar al momento dell'installazione, quindi il fix non è garantito per l'icona già presente. NON richiedere di eliminare/reinstallare l'app perché l'archivio IndexedDB potrebbe essere perso. Nessuna pretesa di risultato visivo prima del test iPhone.
- IMG_4628(1).jpeg (EXIF «Snellisci questa frase»): aiuto Archivio abbreviato in «Verifica i pin sulla mappa prima di esportare i civici.»; funzioni archivio invarianti.
- IMG_4623(1).jpeg (EXIF «Se premo il pulsante di aggiornamento appena aperta l’app, mi dice che deve prima trovare il gps, ma vorrei fosse una operazione indipendente»): rimosso il guard `gpsBusy` dal callback `beforeUpdate`. Ora Aggiorna procede anche durante le tre rilevazioni iniziali, purché la pagina abbia accesso a Internet. Resta il blocco durante edit/pin dialog e la conferma per una bozza di indirizzo non salvata; l’archivio esistente IndexedDB resta intatto. Al reload, il GPS si riacquisisce automaticamente come previsto.
- IMG_4624.png: screenshot tastiera durante inserimento indirizzo, senza didascalia specifica; nessuna modifica arbitraria alla tastiera, al testo o ai dati del civico.
- Nessuna cancellazione/migrazione IndexedDB, modifiche a GPS, backup, Firebase, My Maps, permessi o coordinate. Test e collaudo fisico iOS da verificare.


## Beta 0.6.28 — primo collegamento automatico Mappa ↔ cloud (2 novembre 2026)

- Aprire **Mappa** avvia un controllo **di sola lettura** sullo stesso archivio Firebase già utilizzato da SalvaCivici. Se un altro dispositivo ha sincronizzato nuovi civici o pin corretti, i record ricevuti vengono salvati in IndexedDB sul dispositivo e i numeri civici sulla mappa si aggiornano tramite l'evento `salvacivici:datachanged`. Il passaggio a Mappa non richiede un altro pulsante.
- Un avviso nella Mappa indica se il cloud è stato verificato, se è stato aggiornato o se resta da effettuare la sincronizzazione nell'Archivio. Anche offline si vedono i civici locali.
- **Protezione dati**: la lettura cloud non sostituisce dati locali ancora diversi dall'ultima base sincronizzata, impedisce letture con un altro UID già associato, non esegue upload, cancellazioni o merge forzati. Restano i controlli sui conflitti Firebase; gli aggiornamenti in uscita richiedono sempre l'azione **Sincronizza** nell'Archivio.
- **Non ancora realizzato**: riconciliazione fra i 122 civici già presenti nei fogli privati Google Drive/My Maps e i record eventualmente presenti su ogni iPhone/iPad/Firebase; bridge cifrato per propagare correzioni effettuate tramite ChatGPT da Drive a Firebase; import dei pin in Google My Maps tramite Work. Nessuna modifica a My Maps, Drive, dati privati o regole Firebase deriva da questa release.
- **Da collaudare sul dispositivo**: aprire Mappa su iPhone/iPad con lo stesso account dopo la sincronizzazione di un nuovo civico e verificare il conteggio, la posizione del segnaposto, il comportamento offline e l'assenza di sovrascrittura di civici locali in attesa d'invio. La verifica del codice/deploy non sostituisce questa prova reale.

## Beta 0.6.29 — backup verificato nel Google Drive personale (2 novembre 2026)

Questa è la **prima fase non distruttiva** della migrazione all'account Google personale. **Non è ancora il passaggio completo a Drive come archivio principale**. Firebase resta il servizio che sincronizza i dispositivi; la mappa interna continua a usare i record dell'archivio locale e quelli recuperati dal cloud.

- **Google Sign-In:** chiede anche il permesso limitato `https://www.googleapis.com/auth/drive.file`. I dati Drive appartengono all'account Google dell'utente. Un eventuale login Firebase via email/password non concede accesso a Drive: il pulsante **Collega Drive personale** richiede autenticazione Google. Il token Drive viene mantenuto **solo in memoria**, non in GitHub o localStorage. Una nuova sessione può richiedere di collegare di nuovo Drive.
- **Dati → Google Drive personale · Beta:** con `Collega Drive personale` autorizza il Drive dello stesso **UID e indirizzo email Firebase**; con `Salva copia su Drive ora` archivia una copia manuale. Dopo uno **Sincronizza** Firebase completato nell'Archivio, l'app prova a salvare automaticamente anche una copia personale, ma **solo quando il permesso Drive è presente**. In caso di errore Firebase rimane sincronizzato, Drive segnala l'errore separatamente.
- **Formato e posizione:** cartella visibile `SalvaCivici - Backup app` creata dall'app, file JSON nominati `SalvaCivici_auto_<timestamp>_<uuid>.json`. Ogni nuova versione è un file indipendente: **non vengono cancellate o sovrascritte versioni precedenti**, né i file creati manualmente. Una copia identica già presente non viene duplicata; una copia priva di ID presenti nel precedente backup viene bloccata per evitare retrocessioni dell'archivio. Il backup nuovo viene riletto e confrontato byte-per-contenuto significativo (record per ID) prima di mostrarlo come riuscito.
- **Protezione:** richiede account esatto, record validi, identificativi univoci; se trova più cartelle uguali o errori Drive interrompe senza cancellare dati. Nessuna modifica ad archivio IndexedDB, Firebase già presente, fogli Google canonici, Google My Maps, coordinate civici o file privati esterni. Solo accesso ai file creati/autorizzati dalla nostra app tramite `drive.file`.
- **Limiti di questa versione:** NON importa i backup da Drive nell'app, NON sincronizza ancora bidirezionalmente i dispositivi tramite Drive, NON importa i 122 civici dei fogli Google storici, NON aggiorna My Maps, NON trasferisce dati alla chat ChatGPT. Il confronto e la riconciliazione prima della migrazione richiedono test reali. Il backup automatico è disponibile solo mentre l'app è aperta e autorizzata in una sessione Google valida; su iOS PWA i popup OAuth possono essere bloccati.
- **Test di accettazione in campo:** accedi con Google, autorizza Drive, premi Sincronizza su un archivio non vuoto; verifica il messaggio 'Backup Drive verificato', il file JSON nella cartella del tuo Google Drive, e il contenuto dei civici. Verifica una seconda sync senza modifiche (non deve duplicare) e una correzione del pin (deve creare una nuova versione). Verifica che l'accesso email/password continui a funzionare e che offline siano ancora utilizzabili archivio e mappa. Non eliminare/reinstallare l'app iOS o resettare i dati locali.


## Beta 0.6.30 — un solo login Google per cloud e Drive (2 novembre 2026)

- **Un solo pulsante «Accedi con Google»** nella sezione Dati: Firebase Authentication chiede insieme l'accesso Google e il permesso limitato `drive.file`. Dopo un unico popup/autorizzazione, l'app associa l'account Firebase (UID e email) al Drive personale e visualizza separatamente lo stato di entrambi. Non viene più mostrato il pulsante «Collega Drive personale».
- I file Drive continuano a essere backup versionati privati con lettura di verifica, **non** una sostituzione del backend Firebase. Le copie si attivano automaticamente dopo una sincronizzazione riuscita solo quando Drive è autorizzato; il pulsante «Salva copia su Drive ora» permette un backup esplicito, non un secondo login.
- **Limitazione reale di OAuth:** il token di Google Drive rimane solo in memoria, per sicurezza. Alla riapertura dell'app o quando il token scade può essere necessario toccare di nuovo lo **stesso pulsante Google** per rinnovare il permesso; non viene memorizzato un token Drive permanente, non si forza un popup silenzioso su iOS, e non si richiede una seconda credenziale Drive. L'account Firebase e i civici locali/cloud restano salvi anche senza token Drive, il quale serve esclusivamente a scrivere/verificare i backup personali. Un futuro flusso OAuth backend con refresh token consentirebbe sessioni Drive più persistenti, ma non è incluso.
- Per un account Firebase email/password già esistente, l'accesso Google è possibile solo se appartiene allo stesso UID Firebase; la protezione impedisce collegamenti o sovrascritture fra account diversi. Alternativa email/password per il cloud resta accessibile.
- **Collaudo**: UI e JavaScript verificati senza login reale; prova su iPhone/iPad e conferma del popup `drive.file` e della creazione del primo backup Drive non eseguite in questa release. Non disinstallare la PWA per effettuare prove: il database IndexedDB potrebbe andare perso.
- Nessun Google My Maps, foglio canonico, civico o backup privato modificato; nessun nuovo scope di accesso globale al Drive.

## Beta 0.6.31 — Account Google: accesso e Drive nella stessa sezione (2 novembre 2026)

- Dati: rimosse le due schede separate «Archivio cloud condiviso» e «Google Drive personale». Ora compare un **solo riquadro Account Google** con il login Google (e fallback email/password quando necessario), account attivo e disconnessione, due stati distinti «Sincronizzazione dispositivi» e «Backup su Google Drive» e pulsante facoltativo «Salva copia su Drive ora».
- Il riquadro mantiene **gli stessi ID HTML** per la gestione JS dei token, dello stato cloud, del logout e dei backup. Non cambia il flusso di OAuth né richiede un nuovo account; solo disposizione e testi.
- Cloud Firebase mantiene la sincronizzazione fra dispositivi e la mappa aggiornata all'apertura; Drive personale mantiene i backup privati append-only. Per trasferire modifiche dall'iPhone si continua a trascinare nell'Archivio; il backup Drive dopo sync riuscita dipende dal permesso Google attivo.
- Nessuna migrazione/cancellazione degli archivi locali, nessun cambiamento alle coordinate, alla geolocalizzazione, ai file Google Drive preesistenti, ai fogli Google My Maps o alle mappe My Maps. Service worker cache incrementata a `salvacivici-v0.6.31`, senza cambio del database IndexedDB.
- Test statici e verifica dell'HTML pubblicato non equivalgono alla prova visiva sull'iPhone: verificare che in Dati ci sia un riquadro solo, il proprio account e i due stati, e che la sincronizzazione continui a funzionare senza eseguire nuovamente il login inutilmente.


## Beta 0.6.32 — elenco Google Sheets leggibile, senza toccare i backup JSON (2 novembre 2026)

Problema emerso dalla prova iPhone: il backup JSON valido viene salvato nel Drive dell'utente, ma Google Drive per iOS mostra «Tipo di file non supportato» quando si cerca di visualizzarlo. Il file NON è danneggiato; il limite riguarda solo l'anteprima.

- **Google Drive personale**: oltre ai backup JSON già presenti, l'app ora può creare una **copia in un Foglio Google nativo** leggibile da iPhone, partendo dai civici dell'ultimo backup JSON verificato. Il foglio comprende numero, via, comune, coordinate, stato verifica, precisione GPS, data e ID. L'app usa il medesimo accesso Google già autorizzato con scope `drive.file`, senza secondo login.
- Dopo il salvataggio di una nuova versione JSON, l'app prova a generare il foglio corrispondente; la mancata conversione NON invalida il backup. Quando il backup risulta già presente e identico, cerca o crea il foglio senza duplicarlo. Per i backup creati con versioni precedenti c'è **Prepara elenco leggibile in Fogli Google**; al completamento si mostra il collegamento **Apri elenco in Fogli Google**.
- Ogni foglio è associato alla specifica versione di backup per nome e nella stessa cartella Drive; non vengono sovrascritti fogli o backup precedenti. Le modifiche effettuate manualmente in quel foglio **NON vengono riportate automaticamente** nell'app, in Firebase o My Maps. Il JSON resta la copia tecnica affidabile; il foglio è **solo per consultazione**, non è ancora l'archivio centrale bidirezionale.
- La conversione usa l'API Drive di importazione CSV in Google Sheets. Sono presenti controlli sul proprietario UID, record, univocità ID e tipo MIME restituito, senza accesso all'intero Drive. Se la conversione richiede permessi/servizi Google non disponibili, il messaggio indica l'errore e la copia JSON resta intatta. Non eliminare/reinstallare la PWA per aggiornare.
- **Verifiche**: codice e simulazioni dei casi di creazione/duplicazione/snapshot svolti; test di importazione reale con l'account Google dell'utente, visualizzazione Fogli Google su iPhone e sincronizzazione bidirezionale ancora da svolgere. Nessun civico esistente, Google My Maps, foglio master o backup modificato dalla pubblicazione del codice.


## Beta 0.6.33 — recupero protetto dal Drive, blocco cloud vuoto e focus iOS (2 novembre 2026)

Motivazione: l'utente ha mostrato in **Dati** «Sincronizzati 0 civici» e «Archivio vuoto: nessuna copia inviata» benché sul suo Drive personale esistesse un backup valido di 1 civico. La cartella Drive `SalvaCivici - Backup app` e il JSON storico erano ancora presenti; in Google Sheets è stato anche verificato un foglio leggibile con quel civico. Questa divergenza fra dati del dispositivo/Firebase e backup Drive non deve essere interpretata automaticamente come cancellazione dei dati.

- **Controllo recupero dopo login Google:** se l'app è autorizzata a Drive, legge l'ultimo backup JSON verificato per lo stesso UID e confronta gli identificativi con i record del dispositivo. Se mancano civici, compare «Recupera civici dal Drive». Non avviene importazione senza consenso esplicito. Al tocco mostra numero e provenienza, e richiede conferma.
- **Aggiunta non distruttiva:** il codice rilegge e ricontrolla l'archivio prima dell'importazione e blocca il recupero in caso di ID con dati diversi o civici con lo stesso indirizzo e altro ID. I soli record mancanti vengono aggiunti con IndexedDB `add()` in transazione: se un ID esiste già, l'intera transazione abortisce e non sovrascrive alcun civico. Verifica dell'aggiunta al termine. I dati ripristinati appaiono in Archivio e Mappa locale; per inviarli a Firebase serve poi lo swipe esplicito in Archivio.
- **Protezione contro azzeramenti involontari:** il pull Firebase di sola lettura NON sostituisce un archivio locale non vuoto con un cloud remoto vuoto. Uno swipe Sync che eliminerebbe tutti i record presenti viene bloccato; la cancellazione totale rimane esclusivamente nel proprio percorso con doppia conferma. Una sincronizzazione senza record visualizza una spiegazione esplicita e suggerisce il recupero da Drive invece di far credere che gli storici siano stati salvati.
- **iOS:** abbandonando una pagina, il campo di testo attivo perde il focus per chiudere la tastiera e la barra nativa «Inserisci info»; i campi via/comune disattivano l'autocompletamento non necessario. Si tratta comunque di interfaccia di sistema iOS: l'app non può eliminarne sempre ogni comparsa.
- **Non effettuato:** nessuna eliminazione del backup, nessuna importazione dei 122 civici dei fogli canonici, nessun aggiornamento My Maps, nessuna migrazione Drive↔Firebase completa, nessun trasferimento non autorizzato di coordinate. I civici nel Drive personale non sono stati cambiati dall'assistente.
- **Verifiche richieste:** test unitario/mock per backup remoto 1 record e archivio locale vuoto, conferma/aggiunta, secondo tentativo senza duplicato; gestione UID e conflitti; test dal dispositivo iPhone dopo release. L'effettivo recupero nel tuo IndexedDB non può essere dichiarato completato senza la prova in app.



## Beta 0.6.34 — Archivio di acquisizione e Mappa PERMANENTE separati (2 novembre 2026)

**Decisione dell'utente:** SalvaCivici salva una nuova acquisizione SOLO in Archivio. Il comando di sincronizzazione esplicito nell'Archivio invia i civici e li aggiunge/aggiorna sulla Mappa; una successiva eliminazione (singola o totale) dall'Archivio NON deve eliminare alcun punto già pubblicato nella Mappa.

### Implementazione tecnica

- **Due store diversi nello stesso IndexedDB**: vecchio `civici` per la coda Archivio e nuovo `civici-mappa` per la Mappa permanente. Upgrade DB `salvacivici-mappa-recapito-v1` da schema 1 a 2, senza distruggere `civici`. Mappa e navigazione leggono *soltanto* `civici-mappa`; un salvataggio nell'Archivio non compare in Mappa fino alla sincronizzazione cloud confermata.
- **Due dataset nello stesso documento Firebase, separati logicamente**: `payload` = acquisizioni, `mapPayload` = punti permanenti; `format=2`. L'unico accesso Google/UID resta invariato. Ogni sincronizzazione confronta entrambi e scrive con precondizione `updateTime` evitando di sovrascrivere modifiche concorrenti. Il catalogo Mappa conserva l'unione dei punti già pubblicati e i nuovi; le correzioni per ID già pubblicati sono accettate solo se coerenti con la base sincronizzata o con il punto già conservato localmente; conflitti e duplicati tra ID differenti bloccano la pubblicazione.
- **Retrocompatibilità**: quando un vecchio documento Firebase non possiede `mapPayload`, i civici già presenti nella *precedente copia Firebase* vengono considerati già sincronizzati e inizializzano il catalogo Mappa. Le acquisizioni esistenti solo su iPhone/iPad NON sono trasferite in Mappa finché l'utente non sincronizza. Nessuna correzione viene persa intenzionalmente; conflitti bloccati.
- **Indipendenza della cancellazione**: singola eliminazione dall'Archivio elimina solo dallo store `civici`, senza toccare `civici-mappa`. L'operazione «Elimina tutte le acquisizioni» svuota `payload` e il locale `civici` dopo due conferme, ma scrive `mapPayload` invariato/unito e conserva lo store Mappa. Se sul dispositivo l'Archivio è vuoto e il cloud ancora contiene vecchie acquisizioni, un successivo sync può svuotare lo staging solo quando i civici precedenti risultano già pubblicati nella Mappa. La ricezione di un Archivio cloud vuoto da un altro dispositivo non elimina punti locali non pubblicati.
- **Altri dispositivi**: aprendo Mappa viene letto il catalogo pubblicato via Firebase e aggiunto nella copia locale permanente. Consultazione locale offline dopo il primo download. Nessun pulsante aggiuntivo, nessun passaggio obbligatorio tramite ChatGPT.
- **Correzioni**: un punto sulla Mappa che è stato eliminato dall'Archivio rimane navigabile. Per correggerlo dal pin, dopo consenso viene rimesso in Archivio con lo stesso ID; la Mappa rimane sul punto già pubblicato fino alla successiva sincronizzazione.
- **Google My Maps**: la funzione «Esporta CSV» legge **Mappa permanente** invece dell'Archivio, così non genera una mappa vuota dopo la pulizia delle acquisizioni. Nessun segnaposto di Google My Maps è modificato automaticamente dalla release.
- **Google Drive**: i file JSON precedenti restano intatti. Il recupero opzionale da Drive non ripopola l'Archivio con civici già presenti in `civici-mappa`. Drive non è ancora l'archivio bidirezionale principale della Mappa; **Firebase rimane il backend di pubblicazione in questa versione**.
- **Limitazioni**: correzioni cloud non testate su due dispositivi reali; nessun import dei 122 civici storici Google Sheets in questa release. La sincronizzazione va verificata sul dispositivo iPhone/iPad e la cancellazione totale non va testata sui civici reali prima di backup e confronto.

### Test effettuati e mancanti

Verifica V8 della sintassi JS. Simulazione integrata del Firestore REST (documento `users/<UID>/snapshots/main`): 1 civico in Archivio + Mappa vuota → Sincronizza → Archivio 1, Mappa 1; elimina staging → Sincronizza → Archivio 0, Mappa 1 anche nel cloud; scarica la Mappa su altro dispositivo → Mappa 1. Test unitario della fusione: aggiunta, correzione, conflitto e ID duplicati. **Non equivale a test OAuth/Firestore reale**: dopo pubblicazione verificare con account dell'utente, evitando di cancellare dati senza backup.


## Beta 0.6.35 — civici vicini in Mappa e contatori distinti (2 novembre 2026)

**Caso reale:** l'utente ha salvato/sincronizzato `Kennedy Prova, 51` a pochi metri da `Kennedy, 51`, entrambi Acquanegra sul Chiese. Due screenshot mostrano Archivio con prima 1 acquisizione e poi 2 acquisizioni, ma non mostrano lo stato della Mappa dopo la seconda sincronizzazione. Le coordinate ricavate dagli screenshot sono circa 45.160331,10.437370 e 45.160346,10.437432: distanza 5,14 m. Quando la Mappa contiene almeno due punti, la precedente `fitBounds` con zoom massimo 17 sovrapponeva i pin identici `51` e uno poteva coprire l'altro **anche quando entrambi erano presenti**. Non confondere questa visualizzazione con una mancata pubblicazione non ancora verificata sul dispositivo.

**Intervento senza cambiare coordinate o dati**:
- Mappa: per un gruppo di civici concentrati entro 55 m dallo stesso primo punto, lo zoom iniziale può arrivare a 20 anziché fermarsi a 17, per distinguere ingressi ravvicinati. Per aree geografiche ampie resta massimo 17.
- Se alla scala corrente le etichette dei pin si sovrappongono (entro 40 px), la Mappa lo segnala nel conteggio e, dopo tocco su uno dei segnaposti, propone **una scelta fra i civici vicini con via e numero completi**. Selezionare una voce aggiorna il dettaglio e la navigazione verso le sue coordinate GPS originali, senza spostare o unire marker.
- Messaggio di sincronizzazione: mostra separatamente `Archivio: N` e `Mappa permanente: M civici`. Il numero in Archivio non indica quanti segnaposti siano pubblicati nella Mappa; il successo del comando espone entrambi i conteggi.
- Test V8 con Leaflet/dom simulati: due indirizzi con numero 51 a 5,14 m, mappa iniziale con 2 marker e zoom 20, a zoom 17 messaggio di sovrapposizione e selezione funzionante fra le due voci; coordinate inalterate. I dati reali, il Firestore dell'utente, Drive e My Maps non sono stati modificati.

**Verifica sul dispositivo da effettuare:** dopo aggiornamento PWA, completare sincronizzazione e leggere in Archivio entrambi i contatori; aprire Mappa con filtri `Tutti i comuni` e `Tutti i punti`, verificare il conteggio `2 civici sulla mappa`, cliccare `Kennedy` e `Kennedy Prova` e controllare i dettagli. Se il conteggio Mappa è 1 dopo una sync riuscita, il problema non è solo visivo: non cancellare acquisizioni, raccogliere esatto stato e correggere il backend. Non eliminare backup o civici di prova fino a test completo.


## Beta 0.6.36 — responsabilità definitive delle quattro sezioni (2 novembre 2026)

**Decisione utente:**
1. **Salva**: acquisizione GPS già concreta e approvata. Non modificata.
2. **Archivio**: spazio di lavoro per civici acquisiti durante il turno, consultabili e modificabili (dati e pin). Lo swipe di sincronizzazione pubblica le acquisizioni nella Mappa permanente. I dati acquisiti restano in Archivio fino a cancellazione manuale; NON vengono cancellati automaticamente al termine del turno o della sincronizzazione. Il catalogo Mappa NON viene cancellato insieme all'Archivio. Ogni scheda in Archivio indica `Da pubblicare nella Mappa`, `Già pubblicato nella Mappa` oppure `Modifiche da sincronizzare`, in base al confronto con il punto già pubblicato.
3. **Mappa**: mantiene l'attuale cartografia, i pin numerati, filtri e navigazione. Nuovi controlli: ricerca per comune/via/civico e **tendina dei civici già sincronizzati** (ordinate per comune e via); scegliere un civico azzera i filtri che lo nascondono, lo seleziona, centra il pin a zoom 19 e ne mostra informazioni, coordinate e navigazione. Conservata la scelta dei punti a pochi metri, introdotta in Beta 0.6.35. **Modifica pin** e nuovo **Modifica dati** sono due operazioni distinte. Una correzione su un civico già pubblicato viene preparata nell'Archivio (stesso ID): Mappa rimane al dato pubblicato fino a successiva sincronizzazione, così un cambio accidentale non altera il catalogo permanente. Se il civico è ancora nell'Archivio, i comandi riutilizzano quella scheda. Nessuna riscrittura diretta di Firebase, Drive o Google My Maps.
4. **Dati**: connessione Google, sincronizzazione/backup e export come già approvati. Non modificata.

**Implementazione:** `index.html` aggiunta ricerca e select native accessibili nel tab Mappa, nuovo pulsante Modifica dati e descrizioni Archivio/Mappa; `map-overview.js` ricerca dinamica, selezione, centratura, callback correzione dati; `app.js` riutilizzo del dialogo modifica dati con recupero conservativo dal catalogo Mappa all'Archivio quando necessario; badge di pubblicazione sulle acquisizioni, messaggio chiaro che una correzione diventa visibile sulla Mappa solo dopo nuova sync; `styles.css` stile selettore e pulsanti; `sw.js` cache 0.6.36. NON modificati codice di acquisizione, backend cloud-sync, modello dati IndexedDB, File Drive, 122 civici storici, My Maps, né permessi Firestore.

**Test:** JS parsing eseguito sui file modificati. Simulazione controlli Mappa con 3 punti pubblicati: tendina include tutti; filtro «Prova» riduce la lista a uno; scelta seleziona Kennedy Prova 51, centra lat/lon originali con zoom19 e richiama callback Modifica dati. Mancano ancora il test effettivo sull'iPhone/iPad e l'esito di una correzione in Firebase reale. NON svuotare Archivio con acquisizioni di prova non ancora pubblicate. L'idea «Archivio per turno» è per ora implementata come elenco di lavoro svuotabile manualmente, SENZA data di scadenza e senza eliminazioni automatiche: non chiamare implementata una sessione giornaliera automatica.


## Beta 0.6.37 — ricerca live direttamente sui pin della Mappa (3 novembre 2026)

Corretto il difetto della Beta 0.6.36: prima il campo «Cerca un civico sulla Mappa» filtrava solo la tendina, mentre sulla cartografia rimanevano tutti i segnaposti. Ora la ricerca per via, comune, civico o combinazioni (anche senza accenti, senza vincoli sull'ordine delle parole) filtra **gli stessi dati** visualizzati dalla Mappa permanente, restringe immediatamente i pin e centra la cartografia sui risultati. Un risultato unico viene selezionato automaticamente, mantenendo disponibili navigazione e modifica; più risultati restano selezionabili nella tendina. Svuotando la ricerca ricompaiono tutti i punti pubblicati. La nuova ricerca ripristina i filtri Comune/Stato per non nascondere risultati di altri comuni. Zero corrispondenze mostra un messaggio dedicato. Non viene modificato alcun civico, archivio, IndexedDB o Firebase. Cache PWA `salvacivici-v0.6.37`, URL e manifest invariati.
