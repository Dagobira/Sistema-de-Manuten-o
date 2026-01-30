import React from 'react';

export default function Header({ title }) {
    const displayTitle = () => {
        const map = {
            'ANALISE': 'Análise de Laboratórios',
            'QUALIDADE': 'Qualidade',
            'LOGISTICA': 'Calendário de Atendimento',
            'COMPRAS': 'Compras Manutenção',
            'REMANEJAMENTO': 'Remanejamento Inteligente',
            'ADMIN_USERS': 'Gestão de Usuários',
            'DASHBOARD': 'BI Performance',
            'BI': 'BI Performance'
        };
        return map[title] || title;
    };

    return (
        <div className="topbar">
            <h1>{displayTitle()}</h1>
        </div>
    );
}
