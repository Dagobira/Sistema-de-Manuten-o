import React, { useState, useEffect, useMemo } from 'react';
import { loadCSV } from '../lib/csv';
import { normalizeMovRows } from '../lib/engine';
import './Remanejamento.css'; // Reutilizando base de estilos (cards, sombras)

// Utils
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(val);

export default function KPIDashboard() {
    const [loading, setLoading] = useState(true);
    const [rawData, setRawData] = useState({ sales: [], products: [], labs: [] });

    // FILTROS & MODOS
    const [selectedPeriod, setSelectedPeriod] = useState(''); // YYYY-MM
    const [selectedLab, setSelectedLab] = useState('');

    // MODO COMPARADOR
    const [mode, setMode] = useState('dashboard'); // 'dashboard' | 'comparison'
    const [compLabA, setCompLabA] = useState('');
    const [compLabB, setCompLabB] = useState('');

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                const [salesRows, prodRows, labsRows] = await Promise.all([
                    loadCSV('/data/stg_lab_mov_mensal.csv'),
                    loadCSV('/data/stg_produto.csv'),
                    loadCSV('/data/stg_lojas.csv')
                ]);

                // Normalizar Vendas (Engine já trata AnoMes -> Mes via fallback, mas garantimos)
                const sales = normalizeMovRows(salesRows).filter(r => r.Mes);

                // Helper interno para buscar valor insensível a case
                const getVal = (row, keys) => {
                    if (!row) return undefined;
                    const found = keys.find(k => row[k] !== undefined) || Object.keys(row).find(k => keys.some(key => k.toLowerCase() === key.toLowerCase()));
                    return found ? row[found] : undefined;
                };

                // Indexar Produtos
                const prodMap = new Map();
                prodRows.forEach(p => {
                    const sku = String(getVal(p, ['SKU', 'Codigo']) || '').trim();
                    const priceRaw = getVal(p, ['PrecoVenda', 'Preco', 'Price']);
                    const costRaw = getVal(p, ['Custo', 'Cost']);

                    const parseMoney = (v) => {
                        if (typeof v === 'number') return v;
                        if (!v) return 0;
                        return parseFloat(String(v).replace('R$', '').replace(/\./g, '').replace(',', '.') || 0);
                    };

                    prodMap.set(sku, {
                        price: parseMoney(priceRaw),
                        cost: parseMoney(costRaw)
                    });
                });

                // Enriquecer Vendas
                const enrichedSales = sales.map(s => {
                    const p = prodMap.get(s.SKU) || { price: 0, cost: 0 };
                    return {
                        ...s,
                        // FIX: Revenue é só sobre Vendas reais
                        revenue: s.Vendas * p.price,
                        // CostVal considera tudo que saiu (custo do que foi consumido/perdido)
                        // FALLBACK: Se não tem custo, usa preço como proxy de "Valor"
                        costTotal: s.TotalConsumido * (p.cost || p.price),
                        costSales: s.Vendas * (p.cost || p.price),
                        // Lucro Bruto = Receita - Custo da Venda (Se custo=0, margem 100%)
                        profit: (s.Vendas * p.price) - (s.Vendas * (p.cost || 0)),
                        // Perdas financeiras (Usar Preço cheia se não tiver custo para dar peso)
                        lossVal: s.OutrasSaidas * (p.cost || p.price)
                    };
                });

                // Definir Período
                const allMonts = [...new Set(enrichedSales.map(s => s.Mes))].sort();
                const lastMonth = allMonts[allMonts.length - 1];
                if (lastMonth) setSelectedPeriod(lastMonth);

                const validLabs = labsRows.map(l => getVal(l, ['Nome_Sistema', 'Nome Sistema', 'Laboratorio', 'Loja'])).filter(Boolean).sort();

                setRawData({
                    sales: enrichedSales,
                    products: prodRows,
                    labs: validLabs
                });

                // Defaults Comparison
                if (validLabs.length >= 2) {
                    setCompLabA(validLabs[0]);
                    setCompLabB(validLabs[1]);
                }

            } catch (err) {
                console.error("Erro ao carregar dados BI", err);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    // PROCESSAMENTO DE KPIS GERAIS
    const metrics = useMemo(() => {
        if (!selectedPeriod) return null;

        const [currYear] = selectedPeriod.split('-');
        const prevYear = Number(currYear) - 1;
        const comparePeriod = `${prevYear}-${selectedPeriod.split('-')[1]}`;

        // Helper Filter
        const getMetrics = (labFilter) => {
            const currentSales = rawData.sales.filter(s => s.Mes === selectedPeriod && (!labFilter || s.Laboratorio === labFilter));
            const prevSales = rawData.sales.filter(s => s.Mes === comparePeriod && (!labFilter || s.Laboratorio === labFilter));

            const agg = (ds) => ({
                revenue: ds.reduce((acc, s) => acc + s.revenue, 0),
                profit: ds.reduce((acc, s) => acc + s.profit, 0),
                qty: ds.reduce((acc, s) => acc + s.Vendas, 0), // Ticket médio usa qtd vendas
                loss: ds.reduce((acc, s) => acc + s.lossVal, 0)
            });

            const curr = agg(currentSales);
            const prev = agg(prevSales);
            const deltaRev = prev.revenue > 0 ? ((curr.revenue - prev.revenue) / prev.revenue) * 100 : 0;

            // Top Losses
            const lossMap = new Map();
            currentSales.forEach(s => {
                if (s.lossVal > 0) {
                    lossMap.set(s.SKU, (lossMap.get(s.SKU) || 0) + s.lossVal);
                }
            });
            const topLosses = Array.from(lossMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

            return {
                curr, prev, deltaRev, topLosses,
                ticket: curr.qty > 0 ? curr.revenue / curr.qty : 0
            };
        };

        if (mode === 'comparison') {
            return {
                labA: getMetrics(compLabA),
                labB: getMetrics(compLabB)
            };
        }

        // Mode Dashboard
        const main = getMetrics(selectedLab);

        // Rankings (Dashboard Only)
        const currentAll = rawData.sales.filter(s => s.Mes === selectedPeriod);
        const rankRevenue = !selectedLab ? getRanking(currentAll, 'revenue') : [];
        const rankProfit = !selectedLab ? getRanking(currentAll, 'profit') : [];
        const evolution = getEvolutionData(rawData.sales, selectedLab, currYear);

        return { ...main, rankRevenue, rankProfit, evolution };

    }, [rawData, selectedPeriod, selectedLab, mode, compLabA, compLabB]);

    // Helpers
    function getRanking(dataset, key) {
        const map = new Map();
        dataset.forEach(s => {
            map.set(s.Laboratorio, (map.get(s.Laboratorio) || 0) + s[key]);
        });
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    }

    function getEvolutionData(allSales, lab, year) {
        const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
        const prevYear = Number(year) - 1;

        return months.map(m => {
            const periodIso = `${year}-${m}`;
            const prevIso = `${prevYear}-${m}`;

            const filterPeriod = (d, p) => d.filter(s => s.Mes === p && (!lab || s.Laboratorio === lab));
            const sumRev = (arr) => arr.reduce((acc, s) => acc + s.revenue, 0);

            const valCurr = sumRev(filterPeriod(allSales, periodIso));
            const valPrev = sumRev(filterPeriod(allSales, prevIso));

            return {
                month: m,
                curr: valCurr,
                prev: valPrev,
                delta: valPrev > 0 ? ((valCurr - valPrev) / valPrev) * 100 : 0
            };
        });
    }

    if (loading) return <div className="loading">Carregando Inteligência...</div>;
    if (!metrics) return null;

    return (
        <div className="remanejamento-container" style={{ gap: '30px' }}>
            {/* --- HEADER --- */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text)', margin: 0 }}>
                        KPI Board <span style={{ color: 'var(--primary)', fontSize: '0.6em', verticalAlign: 'middle', background: 'rgba(30,136,229,0.1)', padding: '4px 8px', borderRadius: '6px' }}>BETA</span>
                    </h1>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                        <button
                            onClick={() => setMode('dashboard')}
                            className={mode === 'dashboard' ? 'btn-primary' : ''}
                            style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', border: '1px solid var(--border)' }}
                        >
                            📊 Visão Geral
                        </button>
                        <button
                            onClick={() => setMode('comparison')}
                            className={mode === 'comparison' ? 'btn-primary' : ''}
                            style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', border: '1px solid var(--border)' }}
                        >
                            ⚔️ Comparador
                        </button>
                    </div>
                </div>

                <div className="filters-bar" style={{ padding: '10px', background: 'var(--bg)', border: 'none', boxShadow: 'none', gap: '10px' }}>
                    {mode === 'dashboard' ? (
                        <div>
                            <label>Laboratório</label>
                            <select value={selectedLab} onChange={e => setSelectedLab(e.target.value)} style={{ width: '200px' }}>
                                <option value="">🏢 Toda a Rede</option>
                                {rawData.labs.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div>
                                <label>Lab A</label>
                                <select value={compLabA} onChange={e => setCompLabA(e.target.value)} style={{ width: '150px' }}>
                                    {rawData.labs.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>
                            <div style={{ alignSelf: 'center', paddingTop: '16px', fontWeight: 'bold', color: 'var(--textSec)' }}>VS</div>
                            <div>
                                <label>Lab B</label>
                                <select value={compLabB} onChange={e => setCompLabB(e.target.value)} style={{ width: '150px' }}>
                                    {rawData.labs.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                    <div>
                        <label>Período</label>
                        <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} style={{ width: '120px' }}>
                            {[...new Set(rawData.sales.map(s => s.Mes))].sort().reverse().map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* --- COMPARISON MODE --- */}
            {mode === 'comparison' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                    <LabColumn metrics={metrics.labA} label={compLabA} />
                    <LabColumn metrics={metrics.labB} label={compLabB} />
                </div>
            )}

            {/* --- DASHBOARD MODE --- */}
            {mode === 'dashboard' && (
                <>
                    <div className="remanejamento-metrics" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                        <KpiCard
                            label="Faturamento Total"
                            value={formatCurrency(metrics.curr.revenue)}
                            sub={`${formatCurrency(metrics.prev.revenue)} ano ant.`}
                            delta={metrics.deltaRev}
                            icon="💰"
                        />
                        <KpiCard
                            label="Lucro Bruto (Est.)"
                            value={formatCurrency(metrics.curr.profit)}
                            sub={`Margem: ${metrics.curr.revenue > 0 ? ((metrics.curr.profit / metrics.curr.revenue) * 100).toFixed(1) : 0}%`}
                            icon="📈"
                            color="green"
                        />
                        <KpiCard
                            label="Ticket Médio"
                            value={formatCurrency(metrics.ticket)}
                            sub={`${formatNumber(metrics.curr.qty)} vendas`}
                            icon="🏷️"
                            color="blue"
                        />
                        <KpiCard
                            label="Perdidos (Defeito/Outros)"
                            value={formatCurrency(metrics.curr.loss)}
                            sub={`${metrics.curr.revenue > 0 ? ((metrics.curr.loss / metrics.curr.revenue) * 100).toFixed(1) : 0}% da Rec.`}
                            icon="📉"
                            color="orange"
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        {/* Rankings Revenue */}
                        <div className="rm-card">
                            <h3 className="rm-label" style={{ marginBottom: '16px' }}>🏆 Top 5 Faturamento</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {metrics.rankRevenue.map(([lab, val], i) => (
                                    <RankRow key={lab} i={i} label={lab} value={val} max={metrics.rankRevenue[0][1]} fmt={formatCurrency} />
                                ))}
                                {metrics.rankRevenue.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: 'var(--textSec)' }}>Selecione "Toda a Rede"</div>}
                            </div>
                        </div>

                        {/* Top LOSSES (New) */}
                        <div className="rm-card" style={{ borderColor: 'var(--danger)' }}>
                            <h3 className="rm-label" style={{ color: 'var(--danger)', marginBottom: '16px' }}>🚨 Top Produtos com Prejuízo</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {metrics.topLosses.map(([sku, val], i) => (
                                    <RankRow key={sku} i={i} label={sku} value={val} max={metrics.topLosses[0][1]} fmt={formatCurrency} color="red" />
                                ))}
                                {metrics.topLosses.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--textSec)', fontSize: '0.85rem' }}>
                                        <p style={{ margin: '0 0 8px 0' }}>Sem registro de perdas neste período.</p>
                                        <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                                            (Monitorando: Defeito, Danificado, Garantia, Erro Op, Exceção, Não Orçado)
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="rm-card">
                        <h3 className="rm-label" style={{ marginBottom: '16px' }}>📅 Evolução Mensal</h3>
                        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                            <table className="transfer-table">
                                <thead>
                                    <tr>
                                        <th>Mês</th>
                                        <th style={{ textAlign: 'right' }}>Vendas {Number(selectedPeriod.split('-')[0]) - 1}</th>
                                        <th style={{ textAlign: 'right' }}>Vendas {selectedPeriod.split('-')[0]}</th>
                                        <th style={{ textAlign: 'center' }}>Delta</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {metrics.evolution.map((row, idx) => (
                                        <tr key={idx} style={{ background: row.month === selectedPeriod.split('-')[1] ? 'var(--bg)' : 'transparent', fontWeight: row.month === selectedPeriod.split('-')[1] ? 'bold' : 'normal' }}>
                                            <td>Mês {row.month}</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(row.prev)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(row.curr)}</td>
                                            <td style={{ textAlign: 'center', color: row.delta >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                                {row.delta > 0 ? '+' : ''}{row.delta.toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// COMPONENTS
const LabColumn = ({ metrics, label }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 style={{ textAlign: 'center', color: 'var(--text)', borderBottom: '2px solid var(--primary)', paddingBottom: '10px' }}>{label}</h2>
        <KpiCard label="Faturamento" value={formatCurrency(metrics.curr.revenue)} sub={`YoY: ${metrics.deltaRev.toFixed(1)}%`} delta={metrics.deltaRev} icon="💰" />
        <KpiCard label="Lucro Bruto" value={formatCurrency(metrics.curr.profit)} icon="📈" color="green" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <KpiCard label="Ticket Médio" value={formatCurrency(metrics.ticket)} icon="🏷️" color="blue" isText small />
            <KpiCard label="Perdas" value={formatCurrency(metrics.curr.loss)} icon="📉" color="orange" isText small />
        </div>
    </div>
);

const KpiCard = ({ label, value, sub, delta, icon, color = 'blue', isText = false, small = false }) => (
    <div className={`rm-card ${color}`} style={{ padding: small ? '16px' : '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div className="rm-label">{label}</div>
            <div style={{ fontSize: '1.2rem', opacity: 0.8 }}>{icon}</div>
        </div>
        <div className="rm-value" style={{ fontSize: isText || small ? '1.5rem' : '1.8rem' }}>{value}</div>
        {sub && (
            <div className="rm-sub" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {delta !== undefined && (
                    <span style={{
                        color: delta >= 0 ? 'var(--success)' : 'var(--danger)',
                        fontWeight: 'bold',
                        background: delta >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        padding: '2px 6px', borderRadius: '4px'
                    }}>
                        {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
                    </span>
                )}
                {sub}
            </div>
        )}
    </div>
);

const RankRow = ({ i, label, value, max, fmt, color = 'blue' }) => {
    const pct = max > 0 ? (value / max) * 100 : 0;
    const barVar = color === 'green' ? 'var(--success)' : color === 'red' ? 'var(--danger)' : 'var(--primary)';

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
            <div style={{ width: '20px', fontWeight: 'bold', color: 'var(--textSec)' }}>#{i + 1}</div>
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '600', color: 'var(--text)' }}>{label}</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--text)' }}>{fmt(value)}</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: barVar, borderRadius: '4px' }}></div>
                </div>
            </div>
        </div>
    );
};
