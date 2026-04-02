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
let app;
if (!firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
} else {
    app = firebase.app();
}

const db = app.firestore();
const auth = app.auth();

/**
 * Robust Firestore Settings
 * experimentalForceLongPolling: true is used to bypass WebSocket connection issues 
 * which often cause the "Could not reach Cloud Firestore backend" error in 
 * certain network environments or browser security sandboxes.
 * 
 * NOTE: We do not set experimentalAutoDetectLongPolling to avoid conflicts.
 */
db.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
    experimentalForceLongPolling: true
});

// Enable offline persistence with enhanced error handling
const initPersistence = async () => {
    try {
        await db.enablePersistence({ synchronizeTabs: true });
        console.log("Firestore: Persistence enabled successfully.");
    } catch (err: any) {
        if (err.code === 'failed-precondition') {
            // Multiple tabs open, persistence can only be enabled in one tab at a time.
            console.warn("Firestore: Persistence failed (multiple tabs). Operating in online-only mode.");
        } else if (err.code === 'unimplemented') {
            // The current browser does not support all of the features required to enable persistence
            console.warn("Firestore: Persistence not supported by browser.");
        } else {
            console.error("Firestore Persistence Error:", err.message);
        }
    }
};

// Initialize persistence without blocking the main execution thread
initPersistence();

export { db, auth };