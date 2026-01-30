import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyD4Y7FYWKK6NohXpqslGzMQdYuk6Pw27js",
    authDomain: "sistemamanutencao-8f3a7.firebaseapp.com",
    projectId: "sistemamanutencao-8f3a7",
    storageBucket: "sistemamanutencao-8f3a7.firebasestorage.app",
    messagingSenderId: "383838583604",
    appId: "1:383838583604:web:9c146cd5df7141d1e1c361"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
