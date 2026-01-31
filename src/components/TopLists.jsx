// src/components/TopLists.jsx
import React from 'react';
import MiniTable from './common/MiniTable';
import { CARD_COLORS } from '../constants/business';

export default function TopLists({ topVendas, topReposicao }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <MiniTable
        title="🏆 Top 15 Mais Vendidos"
        data={topVendas}
        valueField="Vendas"
        color={CARD_COLORS.green}
      />

      <MiniTable
        title="📦 Maior Necessidade de Reposição"
        data={topReposicao}
        valueField="Reposicao"
        color={CARD_COLORS.blue}
      />
    </div>
  );
}