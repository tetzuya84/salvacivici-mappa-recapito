# SalvaCivici Beta 0.6.1 — Accesso con Google

## Obiettivo
La stessa identità Google su più dispositivi corrisponde allo stesso UID Firebase e, quindi, allo stesso archivio Firestore `users/{uid}/snapshots/main`. L'archivio locale IndexedDB di ogni dispositivo resta indipendente e operativo offline. Per inviare modifiche occorre premere **Sincronizza i dispositivi**; la ricezione dei dati confermati può avvenire alla riapertura di un dispositivo senza modifiche locali in sospeso.

## Abilitazione da Firebase Console
1. Aprire Firebase Console, progetto `salvacivici-mappa-recapito` → **Authentication** → **Metodo di accesso** → **Google**.
2. Abilitare Google e impostare l'email di assistenza richiesta, poi salvare. L'accesso Email/Password può restare abilitato come alternativa, non è necessario creare nuove password se Google funziona.
3. In Authentication → **Impostazioni** → **Domini autorizzati**, aggiungere `tetzuya84.github.io` (solo dominio, non l'URL completo).
4. Aprire **SalvaCivici Beta 0.6.1** dalla stessa icona Home; andare su **Dati** e premere **Accedi con Google**. Scegliere lo stesso account Google su iPhone e iPad.
5. Verificare il messaggio di login, senza inviare password o token in chat. Prima della prima sincronizzazione ricontrollare l'Archivio e distinguere i civici inventati da quelli reali.

## Limite iPhone/iPad PWA Home — da verificare
L'app usa `signInWithPopup()` del Firebase Authentication Web SDK 12.19.0. Firebase lo raccomanda come alternativa al redirect con cookie di terze parti bloccati; tuttavia alcuni browser/app incorporati e iOS Home PWA possono bloccare il popup Google. **Il precedente tentativo OAuth Drive su iOS è fallito per browser non considerato sicuro.** Non promettere che questa modalità sia affidabile su tutti i dispositivi prima di un test reale. Se il login è bloccato, l'app mostra l'errore e lascia disponibili i civici locali e l'accesso Email/Password nella voce alternativa. Non cancellare la PWA né assumere che Safari condivida il suo IndexedDB.

Per un login Google affidabile in ogni browser iOS potrebbe essere necessaria una futura variazione di hosting/domino o un flusso server-side sicuro. **Non cambiare origine URL o manifest della PWA esistente senza migrazione verificata di tutti i civici.** GitHub Pages non consente di impostare un reverse proxy per il Firebase redirect helper; il redirect Firebase predefinito cross-origin è limitato su Safari 16.1+.

## Sicurezza e identità
- Google Login non chiede permessi Drive, non legge Gmail e non modifica My Maps.
- Ogni accesso usa Firebase Authentication e le Firestore Security Rules già pubblicate per impedire che utenti diversi leggano lo stesso archivio.
- Login Google e login Email/Password con la stessa email possono non avere automaticamente lo stesso Firebase UID. Se esiste già un archivio con un account, non creare un secondo account e non forzare la sostituzione: occorre collegare i provider o migrare i dati in modo controllato.
- L'app blocca l'accesso quando il nuovo UID Google è diverso dall'UID dell'archivio precedentemente sincronizzato sul dispositivo.
- L'importazione e l'invio dei dati di altri dispositivi restano controllati e il salvataggio locale non viene cancellato durante il login.

## Fonti tecniche
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/auth/web/redirect-best-practices
- https://support.google.com/accounts/answer/7675428?co=GENIE.Platform%3DiOS&hl=en
- https://firebase.google.com/docs/auth/web/account-linking
