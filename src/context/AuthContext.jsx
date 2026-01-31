import React, { createContext, useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    collection,
    onSnapshot,
    query
} from 'firebase/firestore';

const AuthContext = createContext();

export { AuthContext };

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [usersList, setUsersList] = useState([]);

    // 1. Monitora estado do Auth
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            try {
                if (currentUser) {
                    // BYPASS ADMIN: Se for o email do chefe, dá poder total imediatamente
                    if (currentUser.email === 'addmin@vx.com') {
                        setUser({
                            uid: currentUser.uid,
                            email: currentUser.email,
                            role: 'super_admin',
                            username: 'Admin',
                            permissions: [],
                            active: true
                        });
                        return; // Finally will handle validation
                    }

                    // Para outros mortais, busca no Firestore
                    const docRef = doc(db, "users", currentUser.uid);
                    let docSnap;
                    try {
                        docSnap = await getDoc(docRef);
                    } catch (firestoreErr) {
                        console.error("Erro Firestore:", firestoreErr);
                        alert("Erro ao conectar no banco de dados. Verifique sua conexão ou permissões.");
                        await signOut(auth);
                        setUser(null);
                        return;
                    }

                    if (docSnap.exists()) {
                        const userData = docSnap.data();

                        // Bloqueio de segurança
                        if (userData.active === false) {
                            await signOut(auth);
                            alert("Sua conta está inativa. Contate o administrador.");
                            setUser(null);
                        } else {
                            setUser({ ...userData, uid: currentUser.uid, email: currentUser.email });
                        }
                    } else {
                        // Logou no Auth mas não tem doc no Firestore (erro de integridade)
                        // await signOut(auth); // Opcional, ou deixa entrar como guest? Melhor deslogar.
                        console.warn("Usuário sem registro no Firestore.");
                        await signOut(auth);
                        setUser(null);
                    }
                } else {
                    setUser(null);
                }
            } catch (err) {
                console.error("Erro fatal Auth:", err);
                setUser(null);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    // 2. Monitora Lista de Usuários (Realtime)
    useEffect(() => {
        const q = query(collection(db, "users"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const list = [];
            querySnapshot.forEach((doc) => {
                list.push({ id: doc.id, ...doc.data() });
            });
            setUsersList(list);
        });
        return () => unsubscribe();
    }, []);

    const formatEmail = (login) => {
        if (login.includes('@')) return login;
        return `${login}@vx.com`; // Alterado para @vx.com para ficar curto
    };

    const login = async (usernameInput, passwordInput) => {
        try {
            const email = formatEmail(usernameInput);
            await signInWithEmailAndPassword(auth, email, passwordInput);
            return { success: true };
        } catch (error) {
            console.error("Erro Login:", error);
            // Default to the actual error message or code to help debugging
            let msg = error.message || 'Erro desconhecido.';
            if (error.code) {
                msg = `Erro: ${error.code}`; // Show code by default for accurate debugging
                if (error.code.includes('invalid-credential') || error.code.includes('wrong-password')) {
                    msg = 'Usuário ou senha incorretos.';
                } else if (error.code.includes('user-not-found')) {
                    msg = 'Usuário não encontrado.';
                } else if (error.code.includes('network-request-failed')) {
                    msg = 'Erro de conexão/rede.';
                } else if (error.code.includes('too-many-requests')) {
                    msg = 'Muitas tentativas. Tente mais tarde.';
                }
            }
            return { success: false, message: msg };
        }
    };

    const logout = async () => {
        await signOut(auth);
        setUser(null);
    };

    // 3. Criação de Usuário (Com Hack para não deslogar o Admin)
    const createUser = async (username, password, permissions) => {
        try {
            const email = formatEmail(username);

            // Importação dinâmica para criar instância isolada do Firebase App
            // Isso permite criar um usuário novo sem trocar a sessão atual do Auth principal
            const { initializeApp: initApp } = await import('firebase/app');
            const { getAuth: getAuthSec, createUserWithEmailAndPassword: createAuthSec } = await import('firebase/auth');

            // Reusa a config existente
            const config = {
                apiKey: "AIzaSyD4Y7FYWKK6NohXpqslGzMQdYuk6Pw27js",
                authDomain: "sistemamanutencao-8f3a7.firebaseapp.com",
                projectId: "sistemamanutencao-8f3a7",
                storageBucket: "sistemamanutencao-8f3a7.firebasestorage.app",
                messagingSenderId: "383838583604",
                appId: "1:383838583604:web:9c146cd5df7141d1e1c361"
            };

            const secondaryApp = initApp(config, "SecondaryApp" + Date.now()); // Nome único
            const secondaryAuth = getAuthSec(secondaryApp);

            // Cria no Auth (na sessão secundária)
            const userCredential = await createAuthSec(secondaryAuth, email, password);
            const newUser = userCredential.user;

            // Salva no Firestore (usando o db principal autenticado como admin)
            await setDoc(doc(db, "users", newUser.uid), {
                username: username,
                email: email,
                role: 'user',
                permissions: permissions,
                active: true,
                createdAt: new Date().toISOString()
            });

            return { success: true };

        } catch (error) {
            console.error("Erro Criar User:", error);
            let msg = error.message || 'Erro desconhecido ao criar usuário.';
            if (error.code === 'auth/email-already-in-use') msg = 'Este usuário já existe.';
            if (error.code === 'auth/weak-password') msg = 'Senha muito fraca (min 6 digitos).';
            return { success: false, message: msg };
        }
    };

    const updateUser = async (id, data) => {
        try {
            const userRef = doc(db, "users", id);
            // Remove senha dos dados (não atualizamos senha do Auth por aqui)
            const { password: _password, ...firestoreData } = data;
            await updateDoc(userRef, firestoreData);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    };

    const deleteUser = async (id) => {
        try {
            // Nota: O usuário continua no Auth, mas sem doc no Firestore ele não entra mais.
            await deleteDoc(doc(db, "users", id));
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            login,
            logout,
            usersList,
            createUser,
            updateUser,
            deleteUser
        }}>
            {children}
        </AuthContext.Provider>
    );
};
