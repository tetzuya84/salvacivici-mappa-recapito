# SalvaCivici — passaggio a un archivio unico iPhone / iPad

## Perché non basta la stessa icona Home
La PWA memorizza i civici nel database IndexedDB locale di ciascun dispositivo. La sincronizzazione tramite menu Condividi (Beta 0.5.9) salva una copia JSON, ma non mantiene automaticamente identici i due archivi.

## Nuova architettura proposta (Beta 0.6.0 in sviluppo)
- **Archivio cloud centrale:** Google Firebase Authentication (email/password) + Cloud Firestore nell'attuale progetto Google Cloud `salvacivici-mappa-recapito`.
- **Login senza finestra Google incorporata:** form email/password all'interno della PWA, chiamate HTTPS alle API REST ufficiali di Firebase. È un account Firebase: si può usare la propria email Gmail ma si sceglie una nuova password. Non usare password Google se non desiderato.
- **Pulsante professionale «Sincronizza i dispositivi».** Solo premendolo vengono caricate le modifiche. Entrambi i dispositivi possono importare i dati confermati, usando lo stesso account.
- **Nessun dato perso per sovrascritture simultanee:** il sistema confronta l'archivio locale, l'ultima versione sincronizzata e lo stato cloud. Cambiamenti incompatibili dello stesso ID producono un blocco/avviso, non un overwrite.
- **GPS e salvataggio sempre locali/offline.** Importazione cloud effettuata soltanto dopo confronto e conferma.
- **Stesso link Home e database**: rimangono `id="./"`, `start_url="./"`, `scope="./"`, database `salvacivici-mappa-recapito-v1`.
- Non è **backup diretto in Google Drive**: Firestore è l'archivio condiviso. I backup JSON su Drive rimangono un'esigenza separata, per cui servirà un'ulteriore integrazione o un'esportazione di sicurezza. Non confondere i due.
- **Limite tecnico temporaneo:** backup in un singolo documento Firestore limitato a 700 KiB. Prima di superarlo servirà suddividere per record. Questa beta deve essere testata prima di essere pubblicata.

## Configurazione Firebase — necessaria prima della pubblicazione
1. Aprire [Firebase Console](https://console.firebase.google.com/), stessa email usata per Google Cloud.
2. Scegliere **Aggiungi Firebase a un progetto Google Cloud esistente**, non creare inutilmente un nuovo progetto. Selezionare **SalvaCivici - Mappa Recapito** (ID `salvacivici-mappa-recapito`). La scelta aggiunge componenti Firebase al progetto Google Cloud ed è da confermare consapevolmente.
3. In Firebase Console > **Authentication** abilitare **Email/Password**. Non serve Google OAuth né il client secret precedentemente visto.
4. In **Firestore Database**, creare il database (edizione Standard, piano e area secondo disponibilità). Per la sicurezza, non usare le regole pubbliche di test: dopo la creazione pubblicare il contenuto di [firestore.rules](firestore.rules) dalla branch `feature/cloud-sync`. La regola ammette soltanto `users/{uid}/snapshots/main` per chi è autenticato come proprietario.
5. Nelle impostazioni progetto Firebase, registrare una **web app** (icona `</>`, nome «SalvaCivici Web»). Copiare `projectId` e `apiKey` dalla configurazione web. Questi valori sono identificatori pubblici dell'app, **non password**. Non divulgare mai credenziali di account, token, client secret e service account JSON.
6. Quando la beta sarà pubblicata nella branch main e aggiornata dall'icona Home, entrare in **Dati → Archivio cloud condiviso**, impostare `projectId` e `apiKey`.
7. Cliccare **Crea nuovo account cloud** sul primo dispositivo; inserire email e una password Firebase nuova. Sul secondo dispositivo usare **Accedi** con lo stesso account. Non comunicare a ChatGPT la password.
8. Prima della prima sincronizzazione, verificare o rimuovere volontariamente i record inventati di prova. Se entrambi i dispositivi contengono dati fittizi, premendo Sincronizza verranno comunque inclusi nel cloud: non farlo finché non decidi quali conservare.
9. Dopo aver controllato l'Archivio, premere **Sincronizza i dispositivi** e confermare sul primo; poi premere sul secondo. Ogni ulteriore modifica si distribuisce al prossimo clic. Se compare «conflitto», non cancellare nulla: acquisire un backup JSON e risolvere le differenze.

## Verifiche prima del rilascio
- Test autentica/registrazione email+password su due dispositivi iOS.
- Verifica Firestore Security Rules: utente B non può leggere/scrivere gli archivi di utente A; non-autenticati bloccati.
- Prima sincronizzazione, aggiornamenti bidirezionali, correzioni, eliminazioni, conflitto sullo stesso ID, perdita di rete, versioni vecchie.
- Compatibilità IndexedDB e Home; nessun reset dell'archivio.
- Ripristino backup JSON locale dopo un'eventuale riconfigurazione e una vera copia di sicurezza indipendente da Firestore.

## Stato attuale
**Implementazione preparata nel ramo separato `feature/cloud-sync`. Non è ancora pubblicata nell'app Home.** L'attuale beta installata resta la 0.5.9 fino alla configurazione e verifica del backend. Nessuna sincronizzazione reale a due dispositivi è stata eseguita.

Documentazione Firebase: https://firebase.google.com/docs/web/setup ; https://firebase.google.com/docs/auth/web/password-auth ; https://firebase.google.com/docs/firestore/security/get-started
