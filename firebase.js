import{initializeApp}from'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import{getAuth,setPersistence,browserLocalPersistence}from'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import{getFirestore,enableIndexedDbPersistence}from'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const firebaseConfig={apiKey:`AIzaSyBKleLDK-Dg9smbhwIDuNz-0j3j0lX39eI`,authDomain:`rawan-f903d.firebaseapp.com`,projectId:`rawan-f903d`,storageBucket:`rawan-f903d.firebasestorage.app`,messagingSenderId:`1003852548044`,appId:`1:1003852548044:web:7b19c20e5644545a32ff69`};
const firebaseApp=initializeApp(firebaseConfig);
const auth=getAuth(firebaseApp);
const db=getFirestore(firebaseApp);
setPersistence(auth,browserLocalPersistence).catch(()=>{});
enableIndexedDbPersistence(db).catch(error=>{if(![`failed-precondition`,`unimplemented`].includes(error.code))console.warn(error)});
export{firebaseConfig,firebaseApp,auth,db};
