/**
 * SISTEM KANTIN SMPN 77 - GOOGLE FIREBASE CONFIGURATION & INITIALIZER
 * Menghubungkan seluruh perangkat (HP Android, Laptop Kasir, Tablet) 
 * ke satu database Cloud Firestore terpusat secara real-time.
 */

const firebaseConfig = {
  apiKey: "AIzaSyAF2q99LH9PaLefvFj2sRUDGk4ihVpvMdg",
  authDomain: "kantin-smpn77.firebaseapp.com",
  projectId: "kantin-smpn77",
  storageBucket: "kantin-smpn77.firebasestorage.app",
  messagingSenderId: "731484508072",
  appId: "1:731484508072:web:c38492591d8907a094d79d",
  measurementId: "G-D4BS5H8DVE"
};

// Inisialisasi Firebase Compat SDK
let firestoreDb = null;
try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    firestoreDb = firebase.firestore();
    console.log('🔥 Firebase Cloud Database berhasil diinisialisasi!');
  } else {
    console.warn('⚠️ Library Firebase SDK belum dimuat di halaman.');
  }
} catch (e) {
  console.warn('⚠️ Gagal menginisialisasi Firebase:', e);
}

window.firestoreDb = firestoreDb;
window.firebaseConfig = firebaseConfig;
