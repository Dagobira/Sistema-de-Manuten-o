import React from 'react';

export default function Header({ title }) {
    const displayTitle = () => {
        const map = {
            'analise': 'Análise de Laboratórios',
            'qualidade': 'Qualidade',
            'logistica': 'Calendário de Atendimento',
            'compras': 'Compras Manutenção',
            'remanejamento': 'Remanejamento Inteligente',
            'users': 'Gestão de Usuários',
            'kpi': 'BI Performance',
            'dashboard': 'BI Performance',
            'bi': 'BI Performance'
        };
        return map[title?.toLowerCase()] || title;
    };

    return (
        <div className="topbar">
            <h1>{displayTitle()}</h1>
        </div>
    );
}
