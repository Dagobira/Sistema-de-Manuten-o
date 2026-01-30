import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);

    // Helper para limpar strings (remove espaços e garante string)
    const clean = (str) => String(str || "").trim();

    // Helper para garantir que o Admin existe
    const ensureAdmin = (loadedUsers) => {
        const adminExists = loadedUsers.find(u => clean(u.username) === 'admin');
        if (!adminExists) {
            const masterUser = {
                id: 1,
                username: 'admin',
                password: '123', // Será tratado como string na comparação "123"
                role: 'super_admin',
                active: true,
                permissions: ['all']
            };
            return [...loadedUsers, masterUser];
        }
        return loadedUsers;
    };

    useEffect(() => {
        // 1. Carregar Sessão Atual
        const savedUser = localStorage.getItem('vx_session_user');
        if (savedUser) {
            setUser(JSON.parse(savedUser));
        }

        // 2. Carregar Base de Usuários
        const savedUsersStr = localStorage.getItem('vx_users_db');
        let loadedUsers = [];

        if (savedUsersStr) {
            try {
                loadedUsers = JSON.parse(savedUsersStr);
            } catch (e) {
                console.error("Erro ao ler users DB", e);
                loadedUsers = [];
            }
        }

        // Adiciona Admin se não existir
        const finalUsers = ensureAdmin(loadedUsers);

        setUsers(finalUsers);
        setLoading(false);
    }, []);

    // 3. Persistência Automática: Salva sempre que `users` mudar
    useEffect(() => {
        if (!loading && users.length > 0) {
            localStorage.setItem('vx_users_db', JSON.stringify(users));
        }
    }, [users, loading]);

    const login = (usernameInput, passwordInput) => {
        const userInput = clean(usernameInput);
        const passInput = clean(passwordInput);

        // 1. Master Hardcoded (Failsafe)
        if (userInput === 'admin' && passInput === '1234') {
            const master = { id: 1, username: 'admin', role: 'super_admin', active: true, permissions: ['all'] };
            setUser(master);
            localStorage.setItem('vx_session_user', JSON.stringify(master));
            return { success: true };
        }

        // 2. Busca na base (com coerção para string e trim)
        const found = users.find(u => {
            const uName = clean(u.username);
            const uPass = clean(u.password);
            return uName === userInput && uPass === passInput;
        });

        if (found) {
            if (found.active === false) {
                return { success: false, message: 'Conta desativada. Contate o suporte.' };
            }

            const sessionUser = {
                id: found.id,
                username: found.username,
                role: found.role,
                permissions: found.permissions
            };

            setUser(sessionUser);
            localStorage.setItem('vx_session_user', JSON.stringify(sessionUser));
            return { success: true };
        }

        return { success: false, message: 'Usuário ou senha incorretos' };
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('vx_session_user');
    };

    const createUser = (username, password, permissions = []) => {
        const safeUser = clean(username);
        const safePass = clean(password);

        if (users.find(u => clean(u.username) === safeUser)) {
            return { success: false, message: 'Usuário já existe' };
        }

        const newUser = {
            id: Date.now(),
            username: safeUser,
            password: safePass,
            role: 'user',
            active: true,
            permissions
        };

        setUsers(prev => [...prev, newUser]);
        return { success: true };
    };

    const updateUser = (id, updates) => {
        setUsers(prevUsers => prevUsers.map(u => {
            if (u.id === id) {
                // Logica segura de atualização
                const updatedUser = { ...u };

                // Atualizar Senha (se fornecida e não vazia)
                if (updates.password !== undefined) {
                    const passStr = clean(updates.password);
                    if (passStr !== "") updatedUser.password = passStr;
                }

                // Atualizar Status
                if (updates.active !== undefined) {
                    updatedUser.active = !!updates.active; // Força boolean
                }

                // Atualizar Permissões
                if (updates.permissions !== undefined) {
                    updatedUser.permissions = updates.permissions;
                }

                return updatedUser;
            }
            return u;
        }));
        return { success: true };
    };

    const deleteUser = (id) => {
        setUsers(prev => prev.filter(u => u.id !== id));
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
