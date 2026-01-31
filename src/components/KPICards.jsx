// src/components/KPICards.jsx
import React from 'react';
import { CARD_COLORS } from '../constants/business';

const Card = ({ label, value, sub, color }) => (
  <div style={{
    background: '#fff',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    borderLeft: `4px solid ${color}`,
    flex: 1
  }}>
    <div style={{ color: '#64748b', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '5px' }}>{label}</div>
    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1e293b' }}>{value}</div>
    {sub && <div style={{ fontSize: '0.8rem', color: color, marginTop: '5px' }}>{sub}</div>}
  </div>
);

export default function KPICards({ stats }) {
  if (!stats) return null;

  // Definição dos cartões usando constantes e dados passados
  const items = [
    { label: "Sugestão de Reposição (Peças)", value: stats.totalReposicao, sub: "Itens a comprar", color: CARD_COLORS.blue },
    { label: "Excesso para Remanejo", value: stats.totalExcesso, sub: "Itens a mover", color: CARD_COLORS.orange },
    { label: "SKUs Críticos (Ruptura)", value: stats.criticos, sub: "Estoque zero com venda", color: CARD_COLORS.red },
    { label: "SKUs Estáveis", value: stats.ok, sub: "Dentro da meta", color: CARD_COLORS.green }
  ];

  return (
    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
      {items.map((item, idx) => (
        <Card key={idx} {...item} />
      ))}
    </div>
  );
}