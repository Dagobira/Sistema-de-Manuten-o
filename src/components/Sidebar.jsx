import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ currentScreen, onNavigate, user }) {
    const { logout } = useAuth();

    // Helper robusto para permissões (Suporta Array e Objeto)
    const hasPerm = (permKey) => {
        if (!user) return false;
        if (user.role === 'super_admin') return true;

        // Mapping camelCase (New) to snake_case (Old DB)
        const map = {
            'viewDashboard': 'view_dashboard',
            'viewAnalise': 'view_analise',
            'viewLogistica': 'view_logistica',
            'viewRemanejamento': 'view_remanejamento',
            'viewCompras': 'view_compras',
            'viewBi': 'view_bi',
            'viewQualidade': 'view_qualidade'
        };

        const legacyKey = map[permKey] || permKey;

        // 1. Check Array (Legacy Users)
        if (Array.isArray(user.permissions)) {
            return user.permissions.includes(legacyKey) || user.permissions.includes(permKey);
        }

        // 2. Check Object (Master User)
        return user.permissions?.[permKey];
    };

    const navItemClass = (screen) =>
        `navItem ${currentScreen === screen ? "navItemActive" : ""}`;

    return (
        <aside className="sidebar">
            <div className="sidebarHeader">
                <img src="/logo-gestaovx.png" alt="Gestão VX" className="sidebarLogoImage" />
                <div style={{ fontSize: '11px', color: 'var(--textSec)', marginTop: '4px' }}>
                    Olá, <strong>{user?.username}</strong>
                </div>
            </div>

            <div className="navList">
                {hasPerm('viewAnalise') && (
                    <button className={navItemClass('analise')} onClick={() => onNavigate('analise')}>
                        📊 Análise de Laboratórios
                    </button>
                )}
                {hasPerm('viewLogistica') && (
                    <button className={navItemClass('logistica')} onClick={() => onNavigate('logistica')}>
                        🚚 Calendário de Atendimento
                    </button>
                )}
                {hasPerm('viewRemanejamento') && (
                    <button className={navItemClass('remanejamento')} onClick={() => onNavigate('remanejamento')}>
                        🔄 Remanejamento Inteligente
                    </button>
                )}
                {hasPerm('viewCompras') && (
                    <button className={navItemClass('compras')} onClick={() => onNavigate('compras')}>
                        🛒 Compras Manutenção
                    </button>
                )}
                {hasPerm('viewBi') && (
                    <button className={navItemClass('bi')} onClick={() => onNavigate('bi')}>
                        💎 BI Performance
                    </button>
                )}
                {hasPerm('viewQualidade') && (
                    <button className={navItemClass('qualidade')} onClick={() => onNavigate('qualidade')}>
                        🛡️ Qualidade
                    </button>
                )}

                {user?.role === 'super_admin' && (
                    <>
                        <div style={{ height: '1px', background: 'var(--border2)', margin: '8px 0' }}></div>
                        <button className={navItemClass('admin_users')} onClick={() => onNavigate('admin_users')}>
                            🔐 Gestão de Usuários
                        </button>
                    </>
                )}
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button className="themeToggle" onClick={logout} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    Sair do Sistema
                </button>
            </div>
        </aside>
    );
}
