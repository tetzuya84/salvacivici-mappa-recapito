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
