SalvaCivici – Mappa Recapito | Prototipo beta 0.2

CHE COSA FA
- Rileva le coordinate GPS su iPhone con un pulsante.
- Memorizza comune, via, civico, latitudine, longitudine, precisione stimata e data.
- Avverte quando si sta salvando di nuovo la stessa combinazione comune/via/civico, ma consente di confermare.
- Segnala senza bloccare se la posizione è entro 5 metri dall'ultimo salvataggio.
- Archivia e ricerca punti; consente di modificare l'indirizzo o eliminare un punto.
- Esporta CSV importabile in Google My Maps (colonne Latitudine e Longitudine, Civico come etichetta).
- Crea e ripristina backup JSON.
- Funziona anche offline dopo la prima apertura da un sito HTTPS (per le risorse dell'app); il GPS può funzionare offline se il telefono è in grado di determinare la posizione.

LIMITI IMPORTANTI
- Questo pacchetto contiene i file dell'app, NON un'app iPhone installata o già pubblicata.
- Il GPS sul telefono richiede che l'app sia ospitata su HTTPS (non aprire index.html come file locale per utilizzare il GPS).
- Per aggiungerla alla schermata Home dell'iPhone: apri il sito su Safari, scegli Condividi > Aggiungi alla schermata Home e lascia attivo Apri come app web.
- I civici sono conservati nel database locale IndexedDB del dispositivo e dell'origine web; cancellando i dati del sito o in caso di rimozione automatica possono andare perduti. Fare regolarmente un backup JSON, da conservare nell'app File o in un cloud personale.
- Il CSV si importa in Google My Maps manualmente; non c'è sincronizzazione automatica.
- Non è una app SwiftUI nativa / App Store. Non ci sono notifiche push né mappa offline.
- Non usare su turni di lavoro reali prima di verifiche su iPhone e una copia di backup dei dati di prova.

PUBBLICAZIONE
Il pacchetto contiene render.yaml per pubblicare come sito statico gratuito con Render.
Pubblicare il progetto su GitHub (sorgente applicazione, senza dati dei civici); collegarlo a Render e creare un Blueprint da render.yaml.
Non attivare servizi a pagamento né inserire dati privati nel repository o nell'hosting.
Dopo la pubblicazione e la prova iPhone, aggiungere l'app alla schermata Home.
Gli indirizzi del servizio devono restare stabili: cambiando dominio, l'archivio locale non migra automaticamente.

TEST
Da questa cartella: node tests/core.test.js
Per testare su computer: avviare un server locale (es. python -m http.server 8765) e aprire http://localhost:8765.

RISERVATEZZA
L'app non invia automaticamente coordinate o civici a server di terze parti. Il pulsante "Apri mappa" carica Google Maps, e le esportazioni vengono inviate solo attraverso le azioni scelte dall'utente.


VERSIONE BETA 0.3 — 28 OTTOBRE 2026
- Rilevamento GPS con una sola pressione: fino a 3 misure fresche.
- Confronto di precisione stimata, scelta di quella con precisione migliore.
- Se dopo il primo fix non arrivano altre misure, usa la prima dopo circa 4 secondi.
- Se l'acquisizione fallisce, mantiene il fix precedente, se presente.
- Mostra l'eventuale dispersione anomala tra le letture (lato diagnostico).
- Nessuna modifica al database IndexedDB esistente, CSV o JSON.
- Prima dell'uso operativo verificare la precisione reale in punti noti.
- Non inviare mai coordinate personali al repository GitHub pubblico.
