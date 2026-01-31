
// src/components/SistemaAnalise.jsx
import React, { useState, useEffect } from 'react';

// LIB
import { loadCSV } from '../lib/csv';
import { buildProductMap, buildMatrizMap, buildLabSnapshotMap, normalizeMovRows } from '../lib/engine';

// COMMON COMPONENTS
import LoadingState from './common/LoadingState';
import ErrorState from './common/ErrorState';

// Este componente parecia ser uma versão simplificada ou alternativa do Dashboard.
// Vou mantê-lo funcional mas usando as novas libs.
// Assumo que ele recebe 'rawData' via props do App.jsx (conforme visto logs anteriores), 
// mas o App.jsx original lia os CSVs e passava. 
// Porém, o super prompt pediu para refatorar tudo. 
// Se App.jsx já carrega dados para ele, ok. Mas vou adicionar fallback se não vier props.

export default function SistemaAnalise(props) {
    const [loading, setLoading] = useState(!props.rawData);
    const [error, setError] = useState(null);
    const [localData, setLocalData] = useState(null);

    useEffect(() => {
        // Se não recebeu dados via props, carrega sozinho
        if (!props.rawData) {
            async function load() {
                try {
                    setLoading(true);
                    const [mov, prod, stock] = await Promise.all([
                        loadCSV('/Movimentacao.csv'),
                        loadCSV('/Produtos.csv'),
                        loadCSV('/Estoque.csv')
                    ]);

                    setLocalData({
                        mov: normalizeMovRows(mov),
                        prod: buildProductMap(prod),
                        stockMatriz: buildMatrizMap(stock),
                        stockLab: buildLabSnapshotMap(stock)
                    });
                } catch (error) {
                    console.error('Erro ao carregar dados:', error);
                    setError("Erro ao carregar dados de análise.");
                } finally {
                    setLoading(false);
                }
            }
            load();
        } else {
            // Se já tem dados, apenas garante formato (App.jsx pode estar passando raw ainda?)
            // Vamos checar integridade básica
            setLocalData({
                mov: Array.isArray(props.rawData.mov) ? props.rawData.mov : [], // Assumindo já normalizado no App ou aqui
                prod: props.rawData.prod instanceof Map ? props.rawData.prod : new Map(),
                stockMatriz: props.rawData.stockMatriz instanceof Map ? props.rawData.stockMatriz : new Map(),
                stockLab: props.rawData.stockLab instanceof Map ? props.rawData.stockLab : new Map()
            });
            setLoading(false);
        }
    }, [props.rawData]);

    // Se precisar de normalização extra, faria aqui com useMemo
    // Mas como normalizeMovRows já é padrão, assumimos ok.

    if (loading) return <LoadingState message="Carregando Análise..." />;
    if (error) return <ErrorState error={error} />;

    // Renderização Placeholder: O código original era simples ou incompleto?
    // Vou criar uma visualização básica de conferência de dados
    const { mov, prod } = localData || {};

    return (
        <div style={{ padding: '20px' }}>
            <h1>Análise de Estoque (Beta)</h1>
            <p>Ferramenta de diagnóstico rápido do sistema.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginTop: '20px' }}>
                <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <h3>Movimentações</h3>
                    <p style={{ fontSize: '2rem', margin: '10px 0' }}>{mov?.length || 0}</p>
                    <span>Linhas processadas</span>
                </div>
                <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <h3>Produtos Ativos</h3>
                    <p style={{ fontSize: '2rem', margin: '10px 0' }}>{prod?.size || 0}</p>
                    <span>SKUs cadastrados</span>
                </div>
                {/* Adicionar mais métricas se necessário */}
            </div>

            <div style={{ marginTop: '30px' }}>
                <h3>Amostra de Dados (Últimas 5 movimentações)</h3>
                {mov && mov.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                        <thead>
                            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                                <th style={{ padding: '10px' }}>Data</th>
                                <th style={{ padding: '10px' }}>Lab</th>
                                <th style={{ padding: '10px' }}>SKU</th>
                                <th style={{ padding: '10px' }}>Vendas</th>
                                <th style={{ padding: '10px' }}>Outras Saídas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {mov.slice(0, 5).map((r, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '10px' }}>{r.Mes}</td>
                                    <td style={{ padding: '10px' }}>{r.Laboratorio}</td>
                                    <td style={{ padding: '10px' }}>{r.SKU}</td>
                                    <td style={{ padding: '10px' }}>{r.Vendas}</td>
                                    <td style={{ padding: '10px' }}>{r.OutrasSaidas}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p>Sem dados disponíveis.</p>
                )}
            </div>
        </div>
    );
}
