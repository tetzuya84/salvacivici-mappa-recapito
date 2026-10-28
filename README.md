# SalvaCivici – Mappa Recapito

Beta **0.4**: applicazione PWA per raccolta locale di civici e coordinate GPS da iPhone.

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
