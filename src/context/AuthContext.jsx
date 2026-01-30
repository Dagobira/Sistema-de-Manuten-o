import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

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
                // Garante que é um array
                if (Array.isArray(parsed)) {
                    setUsersList(parsed);
                }
            }
        } catch (error) {
            console.error("Erro ao carregar usuários:", error);
            // Se der erro, zera a lista para não travar o admin
            setUsersList([]);
        } finally {
            setLoading(false);
        }
    };

    const login = (usernameInput, passwordInput) => {
        // 🔍 DEBUG - Vamos ver o que está chegando
        console.log(`Tentativa de Login: User=[${usernameInput}] Pass=[${passwordInput}]`);

        // Limpeza de entrada (Trim remove espaços acidentais e converte para string)
        const cleanUser = String(usernameInput).trim();
        const cleanPass = String(passwordInput).trim();

        // 1. TENTA LOGAR COMO ADMIN PRIMEIRO (Hardcoded)
        if (cleanUser === MASTER_USER.username) {
            if (cleanPass === MASTER_USER.password) {
                console.log("LOGIN ADMIN SUCESSO!");
                setUser(MASTER_USER);
                localStorage.setItem('app_session', JSON.stringify(MASTER_USER));
                return true;
            } else {
                console.error(`Senha admin errada. Esperado: [${MASTER_USER.password}] Recebido: [${cleanPass}]`);
                throw new Error('Senha incorreta.');
            }
        }

        // 2. TENTA LOGAR COMO USUÁRIO COMUM
        // Recarrega a lista do localStorage na hora H para garantir dados frescos
        let currentList = [];
        try {
            const saved = localStorage.getItem('app_users');
            if (saved) currentList = JSON.parse(saved);
        } catch (e) { currentList = []; }

        const foundUser = currentList.find(
            u => String(u.username).trim().toLowerCase() === cleanUser.toLowerCase()
        );

        if (!foundUser) {
            console.error("Usuário não encontrado na lista.");
            throw new Error('Usuário não encontrado.');
        }

        // Verifica se está ativo (Se active for undefined, assume true para não bloquear antigos)
        if (foundUser.active === false) {
            throw new Error('Acesso bloqueado pelo administrador.');
        }

        // Comparação de senha (Forçando String para resolver o bug do "010203")
        const storedPass = String(foundUser.password).trim();

        console.log(`Comparando Senhas: Input=[${cleanPass}] vs Stored=[${storedPass}]`);

        if (cleanPass === storedPass) {
            console.log("LOGIN USUÁRIO SUCESSO!");
            // Define a sessão completa
            const sessionUser = { ...foundUser, role: 'user' }; // Garante role de user
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
        window.location.href = '/'; // Força recarregamento limpo para limpar estados
    };

    // --- GESTÃO DE USUÁRIOS (ADMIN) ---

    const createUser = (userData) => {
        // Sempre salva a senha como String limpa
        const newUser = {
            ...userData,
            password: String(userData.password).trim(),
            username: String(userData.username).trim(),
            active: true // Novos nascem ativos
        };

        // Atualiza estado e localStorage
        const newList = [...usersList, newUser];
        setUsersList(newList);
        localStorage.setItem('app_users', JSON.stringify(newList));
        return newUser;
    };

    const updateUser = (id, updatedData) => {
        const newList = usersList.map(u => {
            if (u.id === id) {
                // Se a senha veio vazia, mantém a antiga. Se veio preenchida, limpa e salva.
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

    // Verifica sessão salva ao recarregar página
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
