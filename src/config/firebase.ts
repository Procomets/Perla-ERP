import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDbI-wlJd7fYSTZSp6je7wmXRAt04lMgxQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "perla-erp-efafc.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "perla-erp-efafc",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "perla-erp-efafc.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "991164485280",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:991164485280:web:d3e6760bd5bd7e981e83c5",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-ML8WSH6FKF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
