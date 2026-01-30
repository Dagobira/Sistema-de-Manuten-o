import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);

    useEffect(() => {
        // Carregar sessão
        const savedUser = localStorage.getItem('vx_session_user');
        if (savedUser) {
            setUser(JSON.parse(savedUser));
        }

        // Carregar base de usuários
        const savedUsers = localStorage.getItem('vx_users_db');
        if (savedUsers) {
            setUsers(JSON.parse(savedUsers));
        } else {
            // Cria usuário Mestre
            const masterUser = {
                id: 1,
                username: 'admin',
                password: '123',
                role: 'super_admin',
                active: true,
                permissions: ['all']
            };
            setUsers([masterUser]);
            localStorage.setItem('vx_users_db', JSON.stringify([masterUser]));
        }
        setLoading(false);
    }, []);

    // Atualiza DB no localStorage sempre que mudar
    useEffect(() => {
        if (users.length > 0) {
            localStorage.setItem('vx_users_db', JSON.stringify(users));
        }
    }, [users]);

    const login = (username, password) => {
        // 1. Master Hardcoded
        if (username === 'admin' && password === '1234') {
            const master = { id: 1, username: 'admin', role: 'super_admin', active: true, permissions: ['all'] };
            setUser(master);
            localStorage.setItem('vx_session_user', JSON.stringify(master));
            return { success: true };
        }

        // 2. Base de usuários
        const found = users.find(u => u.username === username && u.password === password);

        if (found) {
            // Checagem de Status
            if (found.active === false) {
                return { success: false, message: 'Usuário desativado. Contate o administrador.' };
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
        if (users.find(u => u.username === username)) {
            return { success: false, message: 'Usuário já existe' };
        }
        const newUser = {
            id: Date.now(),
            username,
            password,
            role: 'user',
            active: true, // Padrão: Ativo
            permissions
        };
        setUsers([...users, newUser]);
        return { success: true };
    };

    // NOVA FUNÇÃO: Atualizar Usuário
    const updateUser = (id, updates) => {
        const newUsers = users.map(u => {
            if (u.id === id) {
                // Se a senha vier vazia, não altera
                const finalPassword = (updates.password && updates.password.trim() !== "") ? updates.password : u.password;
                return { ...u, ...updates, password: finalPassword };
            }
            return u;
        });
        setUsers(newUsers);
        return { success: true };
    };

    const deleteUser = (id) => {
        setUsers(users.filter(u => u.id !== id));
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
