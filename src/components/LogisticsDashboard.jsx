// src/components/LogisticsDashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';

// LIB IMPORTS
import { loadCSV, normalizeString } from '../lib/csv';
import {
  buildProductMap,
  buildMatrizMap,
  buildLabSnapshotMap,
  computeFelipeTable,
  buildLojasMap,
  normalizeMovRows,
  normalizeDefectRows
} from '../lib/engine';
import { buildMonthOptions } from '../lib/date';
import { WEEK_DAYS } from '../constants/business';

// COMMON COMPONENTS
import LoadingState from './common/LoadingState';
import ErrorState from './common/ErrorState';

// ICONS (SVGs inline para evitar dependências extras, mantidos do original)
const TruckIcon = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
  </svg>
);

const BoxIcon = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const AlertIcon = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

export default function LogisticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ESTADOS GERAIS
  const [data, setData] = useState({
    movRows: [],
    defectRows: [],
    prodMap: new Map(),
    matrizMap: new Map(),
    labSnapMap: new Map(),
    lojasMap: new Map(),
    months: []
  });

  const [filters, setFilters] = useState({
    mesInicio: '',
    selectedLojaId: null // ID ou Key normalizada da loja selecionada
  });

  const [params] = useState({
    transferenciaMinima: 2,
    regra6m: 6,
    regra12m: 12,
    coberturaAlvoMeses: 3
  });

  // CARREGAMENTO
  useEffect(() => {
    async function loadAll() {
      try {
        setLoading(true);
        const [mov, prod, stock, stores, defects] = await Promise.all([
          loadCSV('/Movimentacao.csv'),
          loadCSV('/Produtos.csv'),
          loadCSV('/Estoque.csv'),
          loadCSV('/Lojas.csv'),
          loadCSV('/Defeituosos.csv')
        ]);

        // Processamento usando Engine
        const prodMap = buildProductMap(prod);
        const matrizMap = buildMatrizMap(stock);
        const labSnapMap = buildLabSnapshotMap(stock);
        const lojasMap = buildLojasMap(stores);

        const movRows = normalizeMovRows(mov);
        const defectRows = normalizeDefectRows(defects, lojasMap);

        const months = buildMonthOptions(movRows);
        const lastMonth = months[months.length - 1] || '';

        setData({
          movRows, defectRows, prodMap, matrizMap, labSnapMap, lojasMap, months
        });

        setFilters(prev => ({ ...prev, mesInicio: lastMonth }));

      } catch (err) {
        console.error(err);
        setError("Erro ao carregar dados de logística.");
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  // --- MEMOIZED CALCULATIONS ---

  // 1. Dados da Loja Selecionada
  const selectedLoja = useMemo(() => {
    if (!filters.selectedLojaId) return null;
    // lojasMap usa chave normalizada
    return data.lojasMap.get(filters.selectedLojaId);
  }, [data.lojasMap, filters.selectedLojaId]);

  // 2. Cálculo de Estoque (Engine)
  const calculatedStock = useMemo(() => {
    if (!data.movRows.length || !filters.mesInicio) return [];

    // Filtra params para computeFelipeTable
    const engineFilters = {
      mesInicio: filters.mesInicio, // Analisa DO inicio ATÉ o fim (pode ser o mesmo)
      mesFim: filters.mesInicio,    // Simplificação: Logistics analisa mês a mês ou acumulado?
      // O app original permitia range, aqui fixamos para simplicidade da UI
      // Se quiser range, precisaria de state mesFim. Assumindo mês único ou "até hoje"
      labs: [],                     // Calcula para todos, depois filtramos ou agrupamos
      categorias: [],
      skuList: []
    };

    return computeFelipeTable({
      prodMap: data.prodMap,
      matrizMap: data.matrizMap,
      labSnapMap: data.labSnapMap,
      movRows: data.movRows,
      filters: engineFilters,
      params
    }).rows;

  }, [data, filters.mesInicio, params]);

  // 3. Agenda de Entrega
  const agenda = useMemo(() => {
    const agendaMap = {};
    WEEK_DAYS.forEach(d => agendaMap[d] = []);

    if (!data.lojasMap.size || !calculatedStock.length) return agendaMap;

    // Agrupar reposições por loja
    const reposicaoPorLoja = {}; // { labNormalized: count }

    calculatedStock.forEach(row => {
      if (row.Reposicao > 0) {
        // row.Laboratorio vem do nome no CSV de Movimentação.
        // Precisamos normalizar para bater com Lojas.csv
        const labKey = normalizeString(row.Laboratorio);
        reposicaoPorLoja[labKey] = (reposicaoPorLoja[labKey] || 0) + row.Reposicao;
      }
    });

    // Distribuir na agenda
    data.lojasMap.forEach((loja, key) => {
      const dias = loja.diasAtendimento ? loja.diasAtendimento.split(',').map(s => s.trim()) : [];
      const totalPecas = reposicaoPorLoja[key] || 0;

      if (dias.length && totalPecas > 0) {
        dias.forEach(diaRaw => {
          // Tenta dar match no dia da semana
          const diaMatch = WEEK_DAYS.find(wd => normalizeString(wd).includes(normalizeString(diaRaw)));
          if (diaMatch) {
            agendaMap[diaMatch].push({
              loja: loja.nomeFantasia,
              pecas: totalPecas,
              tempo: loja.tempoEntrega
            });
          }
        });
      }
    });

    return agendaMap;
  }, [calculatedStock, data.lojasMap]);

  // 4. Defeitos Recentes
  const recentDefects = useMemo(() => {
    if (!selectedLoja) return [];
    // Filtra defeitos da loja selecionada
    return data.defectRows.filter(d =>
      normalizeString(d.Laboratorio) === filters.selectedLojaId || // Se d.Laboratorio for nome da loja
      (selectedLoja.nomeOriginal && normalizeString(d.Laboratorio) === normalizeString(selectedLoja.nomeOriginal))
    ).slice(0, 5);
  }, [data.defectRows, selectedLoja, filters.selectedLojaId]);


  // 5. KPIs da Loja Selecionada
  const lojaKPIs = useMemo(() => {
    if (!selectedLoja) return null;

    const lojaIdNorm = filters.selectedLojaId;

    // Filtrar rows calculadas para esta loja
    const myRows = calculatedStock.filter(r => normalizeString(r.Laboratorio) === lojaIdNorm);

    const totalReposicao = myRows.reduce((acc, r) => acc + r.Reposicao, 0);
    const totalRemanejar = myRows.reduce((acc, r) => acc + r.Remanejamento, 0);
    const criticalItens = myRows.filter(r => r.Status === 'Crítico').length;

    return { totalReposicao, totalRemanejar, criticalItens };
  }, [calculatedStock, selectedLoja, filters.selectedLojaId]);


  // --- RENDER ---
  if (loading) return <LoadingState message="Carregando Logística..." />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="logistics-dashboard fade-in" style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto' }}>
      <header style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', color: '#1e293b', margin: 0 }}>Logística & Operações</h1>
          <p style={{ color: '#64748b' }}>Visão geral de distribuição e atendimento às lojas</p>
        </div>

        <div style={{ background: '#fff', padding: '10px 20px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
          <label style={{ fontSize: '0.9rem', color: '#475569', marginRight: '10px' }}>
            Mês Base:
          </label>
          <select
            value={filters.mesInicio}
            onChange={(e) => setFilters(prev => ({ ...prev, mesInicio: e.target.value }))}
            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          >
            {data.months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </header>

      {/* LAYOUT GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 3fr', gap: '30px' }}>

        {/* SIDEBAR: SELEÇÃO DE LOJA E AGENDA */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

          {/* LISTA DE LOJAS */}
          <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', color: '#0f172a' }}>Lojas / Rotas</h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {Array.from(data.lojasMap.values()).map(loja => {
                const key = normalizeString(loja.nomeOriginal);
                const active = filters.selectedLojaId === key;
                return (
                  <button
                    key={key}
                    onClick={() => setFilters(prev => ({ ...prev, selectedLojaId: key }))}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px',
                      marginBottom: '8px',
                      borderRadius: '8px',
                      border: 'none',
                      background: active ? '#eff6ff' : 'transparent',
                      color: active ? '#2563eb' : '#475569',
                      fontWeight: active ? '600' : '400',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {loja.nomeFantasia}
                  </button>
                );
              })}
            </div>
          </div>

          {/* AGENDA SEMANAL */}
          <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', color: '#0f172a' }}>Agenda Semanal</h3>
            {WEEK_DAYS.map(day => (
              <div key={day} style={{ marginBottom: '15px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '5px' }}>
                  {day}
                </div>
                {agenda[day].length === 0 ? (
                  <div style={{ fontSize: '0.9rem', color: '#cbd5e1', fontStyle: 'italic' }}>Nada agendado</div>
                ) : (
                  agenda[day].map((item, idx) => (
                    <div key={idx} style={{
                      background: '#f8fafc', padding: '8px 12px', borderRadius: '6px',
                      marginBottom: '5px', fontSize: '0.9rem', borderLeft: '3px solid #3b82f6',
                      display: 'flex', justifyContent: 'space-between'
                    }}>
                      <span>{item.loja}</span>
                      <span style={{ fontWeight: 'bold', color: '#3b82f6' }}>{item.pecas} pcs</span>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* MAIN CONTENT: DETALHES DA LOJA */}
        <main>
          {selectedLoja ? (
            <div className="animate-fade-in">
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '15px' }}>
                <div style={{ width: '60px', height: '60px', background: '#3b82f6', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  <TruckIcon />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#1e293b' }}>{selectedLoja.nomeFantasia}</h2>
                  <p style={{ margin: 0, color: '#64748b' }}>
                    {selectedLoja.uf} • Entrega em {selectedLoja.tempoEntrega} dias • {selectedLoja.diasAtendimento}
                  </p>
                </div>
              </div>

              {/* KPIS DE OPERAÇÃO */}
              {lojaKPIs && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
                  <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #3b82f6', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ color: '#64748b', fontSize: '0.9rem' }}>A Enviar (Sugestão)</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>{lojaKPIs.totalReposicao}</div>
                    <div style={{ fontSize: '0.8rem', color: '#3b82f6' }}>Peças para reposição</div>
                  </div>
                  <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #eab308', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ color: '#64748b', fontSize: '0.9rem' }}>A Recolher</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>{lojaKPIs.totalRemanejar}</div>
                    <div style={{ fontSize: '0.8rem', color: '#eab308' }}>Excesso de estoque</div>
                  </div>
                  <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #ef4444', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Rupturas Críticas</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>{lojaKPIs.criticalItens}</div>
                    <div style={{ fontSize: '0.8rem', color: '#ef4444' }}>SKUs zerados com venda</div>
                  </div>
                </div>
              )}

              {/* ROW: DEFEITOS RECENTES + CHAMADOS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>

                {/* DEFEITOS */}
                <div style={{ background: '#fff', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <AlertIcon />
                    <h3 style={{ margin: 0 }}>Histórico de Defeitos (Recentes)</h3>
                  </div>
                  {recentDefects.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: '#64748b' }}>
                          <th style={{ padding: '8px' }}>SKU</th>
                          <th style={{ padding: '8px' }}>Motivo</th>
                          <th style={{ padding: '8px' }}>Qtd</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentDefects.map((d, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px' }}>{d.SKU}</td>
                            <td style={{ padding: '8px' }}>{d.Motivo}</td>
                            <td style={{ padding: '8px', fontWeight: 'bold', color: '#ef4444' }}>{d.Qtd}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Nenhum registro recente.</p>
                  )}
                </div>

                {/* EXPEDIÇÃO / STATUS (Simulado) */}
                <div style={{ background: '#fff', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <BoxIcon />
                    <h3 style={{ margin: 0 }}>Status de Expedição</h3>
                  </div>
                  <div style={{ background: '#f0fdf4', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0', color: '#166534', marginBottom: '10px' }}>
                    <strong>✅ Pedido Semanal Processado</strong><br />
                    <span style={{ fontSize: '0.85rem' }}>Enviado para separação 14:00</span>
                  </div>
                  <div style={{ background: '#fff7ed', padding: '15px', borderRadius: '8px', border: '1px solid #fed7aa', color: '#9a3412' }}>
                    <strong>⚠️ Coleta de Defeitos Pendente</strong><br />
                    <span style={{ fontSize: '0.85rem' }}>Aguardando autorização da gerência</span>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#94a3b8', background: '#f8fafc', borderRadius: '20px', border: '2px dashed #cbd5e1' }}>
              <TruckIcon />
              <h2 style={{ marginTop: '20px', color: '#64748b' }}>Selecione uma loja ao lado</h2>
              <p>Visualize métricas de operação, entrega e qualidade.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}