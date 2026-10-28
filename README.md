# SalvaCivici – Mappa Recapito

Beta **0.3**: applicazione PWA per raccolta locale di civici e coordinate GPS da iPhone.

## GPS migliorato

Una pressione su **Rileva GPS** raccoglie fino a 3 letture fresche, seleziona quella con la migliore precisione *stimata* e mostra la dispersione tra le letture. La precisione stimata dal sistema non garantisce l'errore reale: verificare sempre il punto sul posto.

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
