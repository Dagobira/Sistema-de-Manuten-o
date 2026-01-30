import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Mantemos o state users para a UI (tabela de administração), 
    // mas o login vai ler direto do storage para garantir consistencia.
    const [users, setUsers] = useState([]);

    const DB_KEY = 'vx_users_db';
    const SESSION_KEY = 'vx_session_user';

    // --- HELPER: NORMALIZAÇÃO SEGURA ---
    const normalize = (val) => String(val || "").trim();

    // --- HELPER: LOAD USERS FRESH ---
    const loadUsersFresh = () => {
        try {
            const raw = localStorage.getItem(DB_KEY);
            const parsed = raw ? JSON.parse(raw) : [];

            // Garante que o Admin Hardcoded sempre exista na lista retornada
            const adminExists = parsed.find(u => normalize(u.username) === 'admin');

            if (!adminExists) {
                const master = {
                    id: 1,
                    username: 'admin',
                    password: '123', // Será salvo como string
                    role: 'super_admin',
                    active: true,
                    permissions: ['all']
                };
                // Retorna merged
                return [master, ...parsed];
            }
            return parsed;
        } catch (e) {
            console.error("Erro critico lendo DB:", e);
            return [];
        }
    };

    useEffect(() => {
        // 1. Load Session
        const savedSession = localStorage.getItem(SESSION_KEY);
        if (savedSession) setUser(JSON.parse(savedSession));

        // 2. Load Initial Users to State
        const freshUsers = loadUsersFresh();
        setUsers(freshUsers);

        // Se o DB estava vazio/corrompido e recriamos o admin, salva de volta
        if (!localStorage.getItem(DB_KEY)) {
            localStorage.setItem(DB_KEY, JSON.stringify(freshUsers));
        }

        setLoading(false);
    }, []);

    // Sync state changes to LocalStorage (para Create/Delete funcionar na UI)
    const saveUsersToStorage = (newUsers) => {
        setUsers(newUsers);
        localStorage.setItem(DB_KEY, JSON.stringify(newUsers));
    };

    // --- LOGIN COM LEITURA EM TEMPO REAL ---
    const login = (usernameInput, passwordInput) => {
        console.log("--- TENTATIVA DE LOGIN ---");
        console.log("Input Original:", { u: usernameInput, p: passwordInput });

        // 1. Normalização Imediata
        const safeUser = normalize(usernameInput);
        const safePass = normalize(passwordInput);

        console.log("Input Normalizado:", { u: safeUser, p: safePass });

        // 2. Leitura FRESCA do banco (fura o state potencialmente stale)
        const freshUsersList = loadUsersFresh();

        // 3. Busca exata (String vs String)
        const found = freshUsersList.find(u => {
            const dbUser = normalize(u.username);
            const dbPass = normalize(u.password);

            // Debug de comparação
            const match = dbUser === safeUser && dbPass === safePass;
            if (dbUser === safeUser) {
                console.log(`Usuário Encontrado [${dbUser}]. Senha Correta? ${match}. (DB: '${dbPass}' vs Input: '${safePass}')`);
            }
            return match;
        });

        if (!found) {
            console.warn("Login falhou: Usuário ou senha não batem.");
            return { success: false, message: 'Usuário ou senha incorretos' };
        }

        // 4. Checagem de Status (Active Check)
        // Se active for undefined, consideramos true. Só bloqueia se for explicitamente false.
        if (found.active === false) {
            console.warn("Login falhou: Conta desativada.");
            return { success: false, message: 'Conta desativada. Contate o administrador.' };
        }

        // 5. Sucesso
        console.log("Login SUCESSO!", found);
        const sessionData = {
            id: found.id,
            username: found.username,
            role: found.role,
            permissions: found.permissions
        };

        setUser(sessionData);
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
        return { success: true };
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem(SESSION_KEY);
    };

    // --- CREATE USER ---
    const createUser = (username, password, permissions = []) => {
        const currentList = loadUsersFresh();
        const safeUser = normalize(username);
        const safePass = normalize(password);

        if (currentList.find(u => normalize(u.username) === safeUser)) {
            return { success: false, message: 'Usuário já existe' };
        }

        const newUser = {
            id: Date.now(),
            username: safeUser,
            password: safePass, // Salva string normalizada
            role: 'user',
            active: true, // REGRA DE OURO: Sempre active=true ao criar
            permissions
        };

        const newList = [...currentList, newUser];
        saveUsersToStorage(newList);
        return { success: true };
    };

    // --- UPDATE USER ---
    const updateUser = (id, updates) => {
        const currentList = loadUsersFresh();

        const newList = currentList.map(u => {
            if (u.id === id) {
                const updated = { ...u };

                // Senha
                if (updates.password !== undefined) {
                    const cleanPass = normalize(updates.password);
                    if (cleanPass !== "") updated.password = cleanPass;
                }

                // Status
                if (updates.active !== undefined) updated.active = !!updates.active;

                // Permissões
                if (updates.permissions !== undefined) updated.permissions = updates.permissions;

                return updated;
            }
            return u;
        });

        saveUsersToStorage(newList);
        return { success: true };
    };

    const deleteUser = (id) => {
        const currentList = loadUsersFresh();
        const newList = currentList.filter(u => u.id !== id);
        saveUsersToStorage(newList);
    };

    const hasPermission = (viewName) => {
        if (!user) return false;
        if (user.role === 'super_admin') return true;
        return user.permissions.includes(viewName);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, createUser, updateUser, deleteUser, users, hasPermission }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
