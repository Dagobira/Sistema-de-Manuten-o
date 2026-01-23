import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null); // Usuário Logado
    const [users, setUsers] = useState([]); // Lista de todos usuários (para admin)
    const [loading, setLoading] = useState(true);

    // Carregar dados iniciais
    useEffect(() => {
        async function initAuth() {
            // 1. Tentar recuperar sessão atual
            const savedUser = localStorage.getItem('loggedUser');
            if (savedUser) {
                setUser(JSON.parse(savedUser));
            }

            // 2. Carregar Lista de Usuários
            try {
                const res = await fetch('/data/users.json');
                if (res.ok) {
                    const jsonUsers = await res.json();
                    const localUsersRaw = localStorage.getItem('allUsers');

                    let finalUsers = jsonUsers;

                    if (localUsersRaw) {
                        const localUsers = JSON.parse(localUsersRaw);
                        // MESCLAGEM INTELIGENTE:
                        // Pegamos o Admin (ID 1) SEMPRE do JSON (para garantir senha atualizada)
                        // Pegamos os outros usuários do LocalStorage (se existirem) para manter criados

                        const adminFromJson = jsonUsers.find(u => u.id === 1);
                        const othersFromLocal = localUsers.filter(u => u.id !== 1);

                        // Se houver users no JSON que não estão no local (novos users padrão?), adiciona também
                        // Mas simplificando: Admin é a fonte da verdade para ID 1.

                        finalUsers = [adminFromJson, ...othersFromLocal];
                    }

                    setUsers(finalUsers);
                    localStorage.setItem('allUsers', JSON.stringify(finalUsers));
                } else {
                    throw new Error("Falha ao carregar users.json");
                }
            } catch (err) {
                console.error("Erro ao carregar users.json", err);
                // Fallback: Se falhar fetch, confia no local storage antigo
                const localUsers = localStorage.getItem('allUsers');
                if (localUsers) setUsers(JSON.parse(localUsers));
            }

            setLoading(false);
        }
        initAuth();
    }, []);

    const login = (email, password) => {
        // Busca user na lista carregada
        const found = users.find(u => u.email === email && u.password === password);
        if (found) {
            const sessionUser = { ...found };
            delete sessionUser.password;
            setUser(sessionUser);
            localStorage.setItem('loggedUser', JSON.stringify(sessionUser));
            return { success: true };
        }
        return { success: false, message: 'Email ou senha inválidos' };
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('loggedUser');
    };

    // Funções de Admin
    const addUser = (newUser) => {
        const updatedList = [...users, { ...newUser, id: Date.now() }];
        setUsers(updatedList);
        localStorage.setItem('allUsers', JSON.stringify(updatedList));
    };

    const editUserPermissions = (id, newPermissions) => {
        const updatedList = users.map(u =>
            u.id === id ? { ...u, permissions: newPermissions } : u
        );
        setUsers(updatedList);
        localStorage.setItem('allUsers', JSON.stringify(updatedList));

        if (user && user.id === id) {
            const updatedUser = { ...user, permissions: newPermissions };
            setUser(updatedUser);
            localStorage.setItem('loggedUser', JSON.stringify(updatedUser));
        }
    };

    const getAccessibleScreens = () => {
        return ['analise', 'qualidade', 'logistica', 'compras', 'admin'];
    };

    const canAccess = (screen) => {
        if (!user) return false;
        if (user.role === 'admin') return true;
        return user.permissions.includes(screen);
    };

    return (
        <AuthContext.Provider value={{
            user,
            users,
            loading,
            login,
            logout,
            canAccess,
            addUser,
            editUserPermissions,
            getAccessibleScreens
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
