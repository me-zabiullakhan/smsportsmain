import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAHttj5cj_yd4vQMQHy7pH-S8APG2RUhIc",
    authDomain: "sm-sports-1d8ee.firebaseapp.com",
    projectId: "sm-sports-1d8ee",
    storageBucket: "sm-sports-1d8ee.firebasestorage.app",
    messagingSenderId: "701916968860",
    appId: "1:701916968860:web:8df9de53e28c7b4c8a3a59",
    measurementId: "G-CFW20VFVJ7"
};

// Initialize Firebase using Compat singleton pattern
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const app = firebase.app();
const db = app.firestore();
const auth = app.auth();

/**
 * Syncing settings with main firebase.ts to prevent initialization conflicts.
 */
db.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
    experimentalForceLongPolling: true
});

// Enable offline persistence
try {
    db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn("Firebase Persistence: Multiple tabs open");
        } else if (err.code === 'unimplemented') {
            console.warn("Firebase Persistence: Browser not supported");
        }
    });
} catch (e) {
    console.warn("Persistence init error:", e);
}

export { db, auth };