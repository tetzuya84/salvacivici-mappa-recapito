/* SalvaCivici Beta 0.6.1 — Google login, optional SDK adapter.
   Firebase Auth signInWithPopup uses Google OAuth, not the Google Drive scopes.
   Fallback email/password remains available when the OS blocks a popup. */
import {initializeApp} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const CONFIG={
  apiKey:"AIzaSyAZfrIhmPy25_xDLIvb2SMPPsW_5H8hnCg",
  authDomain:"salvacivici-mappa-recapito.firebaseapp.com",
  projectId:"salvacivici-mappa-recapito",
  appId:"1:378014081900:web:df612e79d0033d55398949"
};
const auth=getAuth(initializeApp(CONFIG));
const provider=new GoogleAuthProvider();
provider.setCustomParameters({prompt:"select_account"});
const button=document.getElementById("cloud-google-login");
let underway=false;

function notify(message,warning=false){
  const cloud=window.SCCloud;
  if(cloud?.notice)cloud.notice(message,warning);
  else {
    const node=document.getElementById("cloud-status");
    if(node){node.textContent=message;node.classList.toggle("warning",warning);}
  }
}
function readable(error){
  const code=error?.code||"";
  if(code==="auth/operation-not-allowed")return "Attiva il provider Google nella console Firebase > Authentication > Metodo di accesso.";
  if(code==="auth/unauthorized-domain")return "Aggiungi tetzuya84.github.io tra i domini autorizzati in Firebase Authentication.";
  if(code==="auth/popup-blocked"||code==="auth/operation-not-supported-in-this-environment")
    return "Questo dispositivo non permette il popup Google nell'app Home. Prova un browser compatibile; i civici locali restano al sicuro.";
  if(code==="auth/popup-closed-by-user"||code==="auth/cancelled-popup-request")return "Accesso Google annullato. Nessun civico modificato.";
  if(code==="auth/account-exists-with-different-credential")return "Questo indirizzo è già associato a un altro metodo di accesso. Occorre collegare gli account prima di cambiare modalità.";
  if(code==="auth/network-request-failed")return "Connessione non disponibile. I civici restano salvati sul dispositivo.";
  return "Accesso Google non riuscito ("+(code||"errore sconosciuto")+"). Nessun civico modificato.";
}
async function onClick(){
  if(underway)return;
  underway=true;button.disabled=true;notify("Apro l'accesso Google…");
  try{
    const result=await signInWithPopup(auth,provider);
    const user=result.user;
    if(!user?.uid||!user?.refreshToken)throw Error("Firebase non ha confermato la sessione Google.");
    const session={localId:user.uid,email:user.email||"",idToken:await user.getIdToken(),refreshToken:user.refreshToken,expiresIn:"3600"};
    if(!window.SCCloud?.acceptGoogleAuth)throw Error("Il modulo cloud non è stato caricato. Riapri l’app.");
    window.SCCloud.acceptGoogleAuth(session);
    notify("Google collegato. Controlla i civici in Archivio, poi premi Sincronizza.");
  }catch(error){
    notify(readable(error),true);
    // Non lasciare una sessione Google persistente diversa da quella dell'archivio locale.
    if(auth.currentUser)await signOut(auth).catch(()=>{});
  }finally{underway=false;button.disabled=false;}
}
if(button){button.addEventListener("click",onClick);button.disabled=false;}
window.SCGoogleAuth={logout:()=>signOut(auth).catch(()=>{})};
