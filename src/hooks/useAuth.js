import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/**
 * Custom hook para acessar o contexto de autenticação
 * @returns {Object} Contexto de autenticação com user, login, logout, etc.
 */
export const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
};
