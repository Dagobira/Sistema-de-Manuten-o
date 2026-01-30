import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();

// Hook exportado para evitar erro no Login.jsx
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const MASTER_USER = {
        id: 'master-001',
        username: 'admin',
        password: '1234',
        name: 'Admin Supremo',
        role: 'super_admin',
        active: true,
        permissions: { viewDashboard: true, viewAnalise: true, viewCompras: true, viewRemanejamento: true, viewLogistica: true }
    };

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // Estado para forçar atualização da lista de usuários quando houver mudanças
    const [usersTick, setUsersTick] = useState(0);

    useEffect(() => {
        // Tenta recuperar sessão existente
        const session = localStorage.getItem('app_session');
        if (session) {
            try {
                setUser(JSON.parse(session));
            } catch (e) { localStorage.removeItem('app_session'); }
        }
        setLoading(false);
    }, []);

    const login = (usernameInput, passwordInput) => {
        const cleanUser = String(usernameInput || '').trim();
        const cleanPass = String(passwordInput || '').trim();

        console.log("🚀 [Login] Tentativa:", { user: cleanUser, pass: cleanPass });

        // 1. Check Admin
        if (cleanUser === MASTER_USER.username) {
            if (cleanPass === MASTER_USER.password) {
                console.log("✅ [Login] Admin autenticado!");
                setUser(MASTER_USER);
                localStorage.setItem('app_session', JSON.stringify(MASTER_USER));
                return true;
            }
        }

        // 2. Check Users do LocalStorage
        let users = [];
        try {
            const saved = localStorage.getItem('app_users');
            if (saved) users = JSON.parse(saved);
        } catch (e) { users = []; }

        const found = users.find(u => String(u.username).trim().toLowerCase() === cleanUser.toLowerCase());

        if (!found) {
            console.error("❌ [Login] Usuário não encontrado.");
            throw new Error('Usuário não encontrado.');
        }

        const storedPass = String(found.password || '').trim();
        console.log("🔍 [Login] Comparando senha salva:", storedPass);

        if (found.active === false) throw new Error('Conta desativada.');

        if (cleanPass === storedPass) {
            console.log("✅ [Login] Usuário autenticado!");
            const sessionUser = { ...found, role: 'user' };
            setUser(sessionUser);
            localStorage.setItem('app_session', JSON.stringify(sessionUser));
            return true;
        } else {
            console.error("❌ [Login] Senha incorreta.");
            throw new Error('Senha incorreta.');
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('app_session');
        window.location.href = '/';
    };

    // Funções de Admin
    const getUsers = () => {
        try { return JSON.parse(localStorage.getItem('app_users') || '[]'); }
        catch { return []; }
    };

    const createUser = (username, password, permissions) => {
        const users = getUsers();
        // Verifica se usuário já existe
        if (users.find(u => u.username === username)) {
            return { success: false, message: 'Usuário já existe' };
        }

        const newUser = {
            id: Date.now(),
            username,
            password: String(password).trim(),
            permissions,
            active: true,
            role: 'user'
        };

        users.push(newUser);
        localStorage.setItem('app_users', JSON.stringify(users));
        setUsersTick(t => t + 1); // Força render
        return { success: true };
    };

    const updateUser = (id, data) => {
        let users = getUsers();
        users = users.map(u => {
            if (u.id === id) {
                let pass = u.password;
                if (data.password && String(data.password).trim()) pass = String(data.password).trim();
                return { ...u, ...data, password: pass };
            }
            return u;
        });
        localStorage.setItem('app_users', JSON.stringify(users));
        setUsersTick(t => t + 1); // Força render
    };

    const deleteUser = (id) => {
        let users = getUsers();
        users = users.filter(u => u.id !== id);
        localStorage.setItem('app_users', JSON.stringify(users));
        setUsersTick(t => t + 1); // Força render
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, usersList: getUsers(), createUser, updateUser, deleteUser }}>
            {children}
        </AuthContext.Provider>
    );
};
