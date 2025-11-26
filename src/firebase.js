import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAlIId917avJwPkjddIBEefwTnIUstovR0",
  authDomain: "emergency-app-807e2.firebaseapp.com",
  projectId: "emergency-app-807e2",
  storageBucket: "emergency-app-807e2.appspot.com",
  messagingSenderId: "367668944105",
  appId: "1:367668944105:web:6d88afce5953287cf4a478",
  measurementId: "G-5MJ0JBRE99"
};

const app = initializeApp(firebaseConfig);

const analytics = getAnalytics(app);

const auth = getAuth(app);
// Enable local persistence to allow offline login with saved credentials
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn("Firebase auth persistence setup failed:", error);
});

const db = getFirestore(app);
const storage = getStorage(app);

export { app, analytics, auth, db, storage };
