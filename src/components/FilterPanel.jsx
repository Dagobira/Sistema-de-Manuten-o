// src/components/FilterPanel.jsx
import React from 'react';

// Painel de Filtros com Acessibilidade (Labels) e sem comentários desnecessários

export default function FilterPanel({ filters, setFilters, months, labsAvailable }) {
  const update = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));

  return (
    <div className="filter-panel" style={{
      background: '#fff',
      padding: '20px',
      borderRadius: '12px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
      marginBottom: '20px',
      display: 'flex',
      gap: '20px',
      flexWrap: 'wrap',
      alignItems: 'center'
    }}>
      <h3 style={{ margin: 0, marginRight: '10px', fontSize: '1rem', color: '#64748b' }}>Filtros</h3>

      {/* Range de Meses */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <label className="filter-label" style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#64748b' }}>
          De
          <select
            value={filters.mesInicio}
            onChange={e => update('mesInicio', e.target.value)}
            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          >
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <span style={{ paddingTop: '15px' }}>até</span>
        <label className="filter-label" style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#64748b' }}>
          Para
          <select
            value={filters.mesFim}
            onChange={e => update('mesFim', e.target.value)}
            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          >
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>

      {/* Filtro de Laboratório */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <label className="filter-label" style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#64748b' }}>
          Laboratório
          <select
            value={filters.labs[0] || ""}
            onChange={e => update('labs', e.target.value ? [e.target.value] : [])}
            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', minWidth: '150px' }}
          >
            <option value="">Todos da Rede</option>
            {labsAvailable.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
      </div>

      {/* Filtro de SKUs (Input Livre) */}
      <div style={{ flex: 1 }}>
        <label className="filter-label" style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#64748b' }}>
          Filtrar SKUs (separados por vírgula)
          <input
            type="text"
            value={filters.skuInput || ""}
            onChange={e => update('skuInput', e.target.value)}
            placeholder="Ex: 1001, 1002"
            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%' }}
          />
        </label>
      </div>

    </div>
  );
}