// src/components/ResultTable.jsx
// Simplified version WITHOUT virtualization to fix build issues
import React from 'react';

export default function ResultTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Nenhum resultado encontrado</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* HEADER */}
      <div style={{
        display: 'flex',
        background: '#f9fafb',
        fontWeight: 600,
        padding: '12px 0',
        borderBottom: '2px solid #e5e7eb',
        fontSize: '0.85rem',
        color: '#374151'
      }}>
        <div style={{ flex: 1, padding: '0 10px' }}>LABORATÓRIO</div>
        <div style={{ flex: 1, padding: '0 10px' }}>SKU</div>
        <div style={{ flex: 2, padding: '0 10px' }}>DESCRIÇÃO</div>
        <div style={{ flex: 0.8, padding: '0 10px', textAlign: 'center' }}>MÊS MÉD</div>
        <div style={{ flex: 0.8, padding: '0 10px', textAlign: 'center' }}>COBERTURA</div>
        <div style={{ flex: 0.8, padding: '0 10px', textAlign: 'center' }}>ALVO</div>
        <div style={{ flex: 1, padding: '0 10px', textAlign: 'center', fontWeight: 700 }}>SUGESTÃO</div>
      </div>

      {/* TABLE BODY - Simple scrollable div */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
        {rows.map((item, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              borderBottom: '1px solid #f0f0f0',
              alignItems: 'center',
              fontSize: '0.9rem',
              padding: '12px 0',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ flex: 1, padding: '0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.Laboratorio}
            </div>
            <div style={{ flex: 1, padding: '0 10px' }}>
              {item.SKU}
            </div>
            <div style={{ flex: 2, padding: '0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.Descricao}>
              {item.Descricao}
            </div>
            <div style={{ flex: 0.8, padding: '0 10px', textAlign: 'center' }}>
              {item.MediaMensalConsumo?.toFixed?.(1) || '0.0'}
            </div>
            <div style={{ flex: 0.8, padding: '0 10px', textAlign: 'center' }}>
              {item.CoberturaMeses?.toFixed?.(1) || '0.0'}
            </div>
            <div style={{ flex: 0.8, padding: '0 10px', textAlign: 'center' }}>
              {item.EstoqueAlvo || 0}
            </div>
            <div style={{
              flex: 1,
              padding: '0 10px',
              textAlign: 'center',
              fontWeight: 700,
              color: (item.SugestaoTransferencia || 0) > 0 ? '#059669' : '#6b7280'
            }}>
              {item.SugestaoTransferencia || 0}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}