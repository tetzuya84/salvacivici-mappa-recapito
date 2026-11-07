# SalvaCivici — Mappa Recapito

**Applicazione web proprietaria — tutti i diritti riservati.**

SalvaCivici è una web app progressiva (PWA) per la gestione personale di riferimenti civici e punti geografici verificati durante il recapito.

**Versione pubblicata:** Beta 0.6.64.

## Diritti e utilizzo

Il repository è visibile pubblicamente per consentire il funzionamento della web app su GitHub Pages. **La visibilità pubblica non costituisce una licenza open source.** Il codice, il design, la documentazione originale e gli altri elementi proprietari non sono concessi in licenza per copia, ridistribuzione o riutilizzo senza autorizzazione. Per i dettagli consultare [LICENSE](LICENSE).

Restano naturalmente applicabili le licenze, le attribuzioni e i termini di utilizzo delle librerie, delle mappe, dei dati cartografici e degli altri contenuti di terze parti.

## Collegamento all'app

[Apri SalvaCivici](https://tetzuya84.github.io/salvacivici-mappa-recapito/)

## Privacy

I file di questo repository non costituiscono un archivio condiviso dei civici degli utenti. I dati dei singoli utenti sono gestiti separatamente secondo i permessi di accesso e la logica dell'app. **Non pubblicare qui** esportazioni personali, coordinate private, credenziali, token, chiavi segrete o backup.

## Manutenzione

La documentazione operativa estesa e i backup delle versioni originali sono conservati separatamente in un archivio privato del progetto. La documentazione qui pubblicata è intenzionalmente sintetica; non serve come guida di clonazione o distribuzione.

© 2026 tetzuya84 — SalvaCivici / Mappa Recapito. Tutti i diritti riservati.

**Ottimizza percorso (Beta 0.6.60):** dalla sezione Giro si può ordinare le fermate sulla base della matrice dei tempi di percorrenza stradali calcolata da Valhalla su esplicito comando, con GPS dell'iPhone come partenza e arrivo libero. Fino a 12 fermate il solver trova l'ottimo per la matrice stimata, oltre 12 utilizza una ricerca euristica multi-avvio. Senza traffico live o garanzia di tragitto globalmente migliore nella realtà; se la rete non risponde, l'ordine già salvato non viene sostituito. Al servizio vengono inviate solo coordinate, nessun civico, nome, account o backup. La demo pubblica Valhalla è soggetta a limiti; per utilizzo su larga scala serve un provider dedicato.

**Allineamento Giro (Beta 0.6.60):** titolo, descrizione, avvisi, ricerca, contatore e azioni, testi dell'anteprima e indicazioni di navigazione centrati come nelle altre schede. Le righe selezionabili e l'elenco delle fermate conservano allineamento a sinistra e maniglie trascinabili. Solo CSS: nessun cambiamento ai dati o al motore di ottimizzazione.

**Ordine iniziale e ottimizzazione (Beta 0.6.62):** la sequenza del giro segue l'ordine ESATTO in cui vengono selezionati i civici, con una traccia stradale fra fermate costruita nell'ordine scelto; non viene eseguito alcun riordino automatico per semplice vicinanza. Il pulsante «Seleziona trovati» aggiunge invece i risultati nell'ordine alfabetico visibile. Il riordino manuale tramite maniglie ≡ resta persistente, e ogni nuova fermata si aggiunge in fondo. Solo il pulsante «Ottimizza percorso» calcola una sequenza alternativa usando i tempi stradali Valhalla con partenza GPS aggiornata e arrivo libero; il calcolo parte dall'ordine effettivamente mostrato. Se la rete non risponde l'ordine resta invariato. Il tracciato non promette traffico live né un ottimo globale per giri lunghi.

### Sincronizzazione sicura (Beta 0.6.62)
La Mappa permanente e' protetta da sovrascritture silenziose fra dispositivi. Ricevere dati da Firebase puo' aggiungere ID mancanti ma non sostituire un civico locale con un record cloud diverso dello stesso ID. L'app segnala il conflitto, non cambia coordinate e non applica parzialmente la ricezione; la sincronizzazione richiesta dall'utente usa il confronto con la versione comune salvata sul dispositivo per distinguere una sola modifica legittima da due modifiche concorrenti. Se la versione comune manca o esistono due modifiche differenti, si blocca e richiede verifica manuale prima del ripristino. Google Drive resta un archivio di backup append-only, mentre Google My Maps e Google Sheets sono copie esterne e non modificano Firebase o il telefono automaticamente. Questa protezione non sposta né corregge i civici già presenti: per risolvere i conflitti rimasti serve una futura schermata di confronto per ID.

### Bussola e filtro Comune iPhone (Beta 0.6.64)
La bussola usa il rilevamento nord magnetico `webkitCompassHeading` quando disponibile su Safari iOS. Non usa più l'angolo `alpha` non assoluto per simulare un nord inesistente, esclude letture non calibrate o con incertezza superiore a 45 gradi e dà un messaggio se non arrivano orientamenti validi. L'indicazione «Bussola attiva» compare solo alla prima lettura valida. Adegua l'orientamento alla rotazione dello schermo e usa la rotazione fluida già presente in Leaflet. Il filtro Comune/Stato conserva stabile la tendina nativa durante la scelta, applica immediatamente la selezione al `change`, aggiorna i marker e lo zoom, richiude il pannello e visualizza un badge discreto con il numero di civici risultanti. Non modifica record, GPS salvati, Firebase, My Maps o backup; verifica fisica della calibrazione su iPhone ancora necessaria.

### Bussola più rapida (Beta 0.6.64)
Il primo heading valido viene applicato subito con setBearing(-heading), evitando il ritardo iniziale dell'animazione. I successivi aggiornamenti usano l'interpolatore Leaflet Rotate con ease 0,78 (prima 0,22) e deadzone 0,45° (prima 1,5°): risposta più vicina alla rotazione fisica dell'iPhone senza amplificare il rumore. L'interfaccia «Bussola attiva» viene aggiornata una sola volta, alla prima lettura valida, non a ogni evento. Restano invariati i controlli su nord magnetico, accuratezza, eventi alpha iOS e orientamento schermo. Nessun impatto su civici, coordinate o sincronizzazione; test su iPhone reale ancora necessari.
