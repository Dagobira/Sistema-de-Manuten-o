// src/components/ParamsPanel.jsx
import React from 'react';

// Painel de Parâmetros com validação de input

export default function ParamsPanel({ params, update }) {

  const handleNumberChange = (key, value, min, max) => {
    const val = parseInt(value, 10);
    if (!isNaN(val) && val >= min && val <= max) {
      update({ [key]: val });
    }
  };

  return (
    <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
      <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#475569', textTransform: 'uppercase' }}>Parâmetros do Algoritmo</h4>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>

        <label style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Cobertura Alvo (Meses):
          <input
            type="number"
            value={params.coberturaAlvoMeses}
            onChange={e => handleNumberChange('coberturaAlvoMeses', e.target.value, 1, 12)}
            style={{ width: '50px', padding: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          />
        </label>

        <label style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Transferência Mínima:
          <input
            type="number"
            value={params.transferenciaMinima}
            onChange={e => handleNumberChange('transferenciaMinima', e.target.value, 1, 100)}
            style={{ width: '50px', padding: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          />
        </label>

        <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center' }}>
          Regras: Se sem venda em {params.regra6m}m (alvo=1) ou {params.regra12m}m (alvo=0).
        </span>

      </div>
    </div>
  );
}