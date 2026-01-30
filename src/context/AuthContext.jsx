import React, { createContext, useState, useEffect, useContext } from 'react';

// Criamos o Contexto (mas não precisamos exportar ele diretamente se usarmos o hook)
const AuthContext = createContext();

// --- HOOK PERSONALIZADO (A PEÇA QUE FALTAVA) ---
export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    // 1. O ADMIN É A LEI. Ele sempre existe e sempre entra.
    const MASTER_USER = {
        id: 'master-001',
        username: 'admin',
        password: '1234', // String explícita
        name: 'Administrador Supremo',
        role: 'super_admin',
        active: true, // Sempre ativo
        permissions: {
            viewDashboard: true,
            viewAnalise: true,
            viewCompras: true,
            viewRemanejamento: true,
            viewLogistica: true
        }
    };

    const [user, setUser] = useState(null);
    const [usersList, setUsersList] = useState([]);
    const [loading, setLoading] = useState(true);

    // Carrega usuários ao iniciar
    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = () => {
        try {
            const saved = localStorage.getItem('app_users');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setUsersList(parsed);
                }
            }
        } catch (error) {
            console.error("Erro ao carregar usuários:", error);
            setUsersList([]);
        } finally {
            setLoading(false);
        }
    };

    const login = (usernameInput, passwordInput) => {
        console.log(`Tentativa de Login: User=[${usernameInput}] Pass=[${passwordInput}]`);

        const cleanUser = String(usernameInput).trim();
        const cleanPass = String(passwordInput).trim();

        // 1. LOGIN ADMIN
        if (cleanUser === MASTER_USER.username) {
            if (cleanPass === MASTER_USER.password) {
                console.log("LOGIN ADMIN SUCESSO!");
                setUser(MASTER_USER);
                localStorage.setItem('app_session', JSON.stringify(MASTER_USER));
                return true;
            } else {
                console.error(`Senha admin errada.`);
                throw new Error('Senha incorreta.');
            }
        }

        // 2. LOGIN USUÁRIO COMUM
        let currentList = [];
        try {
            const saved = localStorage.getItem('app_users');
            if (saved) currentList = JSON.parse(saved);
        } catch (e) { currentList = []; }

        const foundUser = currentList.find(
            u => String(u.username).trim().toLowerCase() === cleanUser.toLowerCase()
        );

        if (!foundUser) {
            console.error("Usuário não encontrado.");
            throw new Error('Usuário não encontrado.');
        }

        if (foundUser.active === false) {
            throw new Error('Acesso bloqueado pelo administrador.');
        }

        const storedPass = String(foundUser.password).trim();

        console.log(`Comparando: Input=[${cleanPass}] vs Stored=[${storedPass}]`);

        if (cleanPass === storedPass) {
            console.log("LOGIN USUÁRIO SUCESSO!");
            const sessionUser = { ...foundUser, role: 'user' };
            setUser(sessionUser);
            localStorage.setItem('app_session', JSON.stringify(sessionUser));
            return true;
        } else {
            throw new Error('Senha incorreta.');
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('app_session');
        window.location.href = '/';
    };

    // --- GESTÃO (ADMIN) ---

    const createUser = (userData) => {
        const newUser = {
            ...userData,
            password: String(userData.password).trim(),
            username: String(userData.username).trim(),
            active: true
        };
        const newList = [...usersList, newUser];
        setUsersList(newList);
        localStorage.setItem('app_users', JSON.stringify(newList));
        return newUser;
    };

    const updateUser = (id, updatedData) => {
        const newList = usersList.map(u => {
            if (u.id === id) {
                let finalPass = u.password;
                if (updatedData.password && String(updatedData.password).trim() !== "") {
                    finalPass = String(updatedData.password).trim();
                }
                return { ...u, ...updatedData, password: finalPass };
            }
            return u;
        });
        setUsersList(newList);
        localStorage.setItem('app_users', JSON.stringify(newList));
    };

    const deleteUser = (id) => {
        const newList = usersList.filter(u => u.id !== id);
        setUsersList(newList);
        localStorage.setItem('app_users', JSON.stringify(newList));
    };

    // Recupera sessão
    useEffect(() => {
        const session = localStorage.getItem('app_session');
        if (session) {
            try {
                setUser(JSON.parse(session));
            } catch (e) {
                localStorage.removeItem('app_session');
            }
        }
    }, []);

    return (
        <AuthContext.Provider value={{
            user,
            usersList,
            loading,
            login,
            logout,
            createUser,
            updateUser,
            deleteUser,
            isAdmin: user?.role === 'super_admin'
        }}>
            {children}
        </AuthContext.Provider>
    );
};
