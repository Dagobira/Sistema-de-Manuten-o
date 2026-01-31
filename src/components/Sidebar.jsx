import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ currentScreen, onNavigate, user, theme, toggleTheme }) {
    const { logout } = useAuth();

    const menuItems = [
        { id: 'bi', label: '📊 BI Dashboard', perm: 'view_bi' },
        { id: 'analise', label: '🔍 Análise Estoque', perm: 'view_analise' },
        { id: 'compras', label: '🛒 Sugestão Compras', perm: 'view_compras' },
        { id: 'remanejamento', label: '📦 Remanejamento', perm: 'view_remanejamento' },
        { id: 'logistica', label: '🚚 Logística', perm: 'view_logistica' },
        { id: 'qualidade', label: '🛡️ Qualidade', perm: 'view_qualidade' },
    ];

    const hasPerm = (perm) => {
        if (user.role === 'super_admin') return true;
        const map = { 'viewDashboard': 'view_bi' };
        const strictKey = map[perm] || perm;
        if (Array.isArray(user.permissions)) return user.permissions.includes(strictKey);
        return user.permissions?.[perm];
    };

    return (
        <aside className="sidebar">
            <div className="logoArea">
                <div className="logoIcon">🚀</div>
                <span className="logoText">Gestão VX</span>
            </div>

            <nav className="navMenu">
                {menuItems.map(item => (
                    hasPerm(item.perm) && (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            className={`navItem ${currentScreen === item.id ? 'active' : ''}`}
                        >
                            {item.label}
                        </button>
                    )
                ))}

                {user.role === 'super_admin' && (
                    <button
                        onClick={() => onNavigate('users')}
                        className={`navItem ${currentScreen === 'users' ? 'active' : ''}`}
                    >
                        👥 Usuários
                    </button>
                )}
            </nav>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                    onClick={toggleTheme}
                    className="navItem"
                    style={{ justifyContent: 'center', border: '1px solid var(--border2)' }}
                >
                    {theme === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Escuro'}
                </button>

                <button className="themeToggle" onClick={logout} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    Sair do Sistema
                </button>
            </div>
        </aside>
    );
}
