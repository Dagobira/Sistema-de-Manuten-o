import React, { useEffect, useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { loadCSV, toNumber } from '../lib/csv';
import { buildLojasMap, normalizeMovRows, buildProductMap } from '../lib/engine'; // Reusing engine logic
import './Remanejamento.css';

export default function Remanejamento() {
    const [loading, setLoading] = useState(true);
    const [routes, setRoutes] = useState([]);
    const [kpi, setKpi] = useState({ totalPecas: 0, actions: 0, savings: 0 });

    useEffect(() => {
        async function processBalancing() {
            try {
                setLoading(true);
                const [prodRows, movRows, stockRows, lojasRows] = await Promise.all([
                    loadCSV('/data/stg_produto.csv'),
                    loadCSV('/data/stg_lab_mov_mensal.csv'),
                    loadCSV('/data/stg_estoque_lab.csv'),
                    loadCSV('/data/stg_lojas.csv')
                ]);

                // 1. Map Data
                const prodMap = buildProductMap(prodRows);
                const lojasMap = buildLojasMap(lojasRows);

                // Map Movimentação -> Avg Sales per Lab/SKU
                const normMovs = normalizeMovRows(movRows);
                const salesMap = new Map(); // key: "LabName__SKU" -> TotalLast3Months
                const allDates = normMovs.map(r => r.Mes).filter(Boolean).sort();
                const last3Months = new Set([...new Set(allDates)].sort().reverse().slice(0, 3));

                normMovs.forEach(r => {
                    if (last3Months.has(r.Mes)) {
                        const key = `${r.Laboratorio.trim()}__${r.SKU.trim()}`;
                        const current = salesMap.get(key) || 0;
                        salesMap.set(key, current + r.TotalConsumido);
                    }
                });

                const getAvg = (lab, sku) => {
                    const key = `${lab.trim()}__${sku.trim()}`;
                    return (salesMap.get(key) || 0) / 3;
                };

                // 2. Classify Donors & Receivers
                const donors = new Map(); // SKU -> Array of { lab, uf, available }
                const receivers = []; // Array of { lab, uf, sku, need, currentStock, avg }

                stockRows.forEach(row => {
                    const sku = String(row.SKU || row.Codigo || "").trim();
                    const labName = (row.Laboratorio || row.Lab || "").trim();
                    if (!sku || !labName) return;

                    const qtd = toNumber(row.QtdEstoque || row.Estoque || row.Saldo);
                    const avg = getAvg(labName, sku);
                    const lojaInfo = lojasMap.get(labName);
                    const uf = lojaInfo ? lojaInfo.uf : 'N/A';

                    const coverage = avg > 0 ? qtd / avg : (qtd > 0 ? 99 : 0);

                    // Classification Logic
                    if (coverage > 4 && qtd > 0) {
                        // DONOR
                        const safetyStock = Math.ceil(avg * 4);
                        const excess = qtd - safetyStock;
                        if (excess > 0) {
                            if (!donors.has(sku)) donors.set(sku, []);
                            donors.get(sku).push({ lab: labName, uf, available: excess });
                        }
                    } else if (coverage < 1) {
                        // RECEIVER
                        const target = Math.ceil(avg * 1); // Target 1 month
                        const need = target - qtd;
                        if (need > 0) {
                            receivers.push({
                                lab: labName,
                                uf,
                                sku,
                                need,
                                currentStock: qtd,
                                avg,
                                prodName: prodMap.get(sku)?.descricao || 'Item Desconhecido',
                                cost: prodMap.get(sku)?.preco || 0
                            });
                        }
                    }
                });

                // 3. Matching Algorithm
                const transferSuggestions = [];
                let totalStats = { qty: 0, actions: 0, money: 0 };

                // Process largest needs first? Or strictly by list? 
                // Let's process receivers.
                for (const req of receivers) {
                    const potentialDonors = donors.get(req.sku);
                    if (!potentialDonors || potentialDonors.length === 0) continue;

                    // Priority 1: Same UF
                    // Priority 2: Others
                    // Sort donors: Same UF first, then by largest availability
                    potentialDonors.sort((a, b) => {
                        const aSameState = (a.uf === req.uf) ? 1 : 0;
                        const bSameState = (b.uf === req.uf) ? 1 : 0;
                        if (aSameState !== bSameState) return bSameState - aSameState; // Same state first
                        return b.available - a.available; // Most available first
                    });

                    // Fulfill need
                    let remainingNeed = req.need;
                    for (const donor of potentialDonors) {
                        if (remainingNeed <= 0) break;
                        if (donor.available <= 0) continue;

                        const transferQty = Math.min(remainingNeed, donor.available);

                        // Register Transfer
                        const routeKey = `${donor.lab}__${req.lab}`;
                        let route = transferSuggestions.find(r => r.key === routeKey);
                        if (!route) {
                            route = {
                                key: routeKey,
                                from: donor.lab,
                                fromUF: donor.uf,
                                to: req.lab,
                                toUF: req.uf,
                                isIntraState: (donor.uf === req.uf),
                                items: []
                            };
                            transferSuggestions.push(route);
                        }

                        route.items.push({
                            sku: req.sku,
                            name: req.prodName,
                            qty: transferQty,
                            reason: `Destino com ${req.currentStock} (Cov=${(req.currentStock / req.avg).toFixed(1)}m)`
                        });

                        // Update stats
                        donor.available -= transferQty;
                        remainingNeed -= transferQty;
                        statsLoop:
                        totalStats.qty += transferQty;
                        totalStats.money += (transferQty * req.cost);
                    }
                }

                totalStats.actions = transferSuggestions.length;
                setRoutes(transferSuggestions.sort((a, b) => b.isIntraState - a.isIntraState)); // Local first
                setKpi({
                    totalPecas: totalStats.qty,
                    actions: totalStats.actions,
                    savings: totalStats.money
                });

            } catch (err) {
                console.error("Erro no balanceamento", err);
            } finally {
                setLoading(false);
            }
        }
        processBalancing();
    }, []);

    const handleExportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text("Ordem de Remanejamento de Estoque", 14, 20);
        doc.setFontSize(10);
        doc.text(`Data: ${new Date().toLocaleDateString()}`, 14, 26);

        let startY = 35;

        routes.forEach((route, i) => {
            // Check page break
            if (startY > 250) {
                doc.addPage();
                startY = 20;
            }

            doc.setFillColor(route.isIntraState ? 220 : 255, route.isIntraState ? 255 : 240, route.isIntraState ? 220 : 200);
            doc.rect(14, startY, 180, 10, 'F');
            doc.setFont(undefined, 'bold');
            doc.text(`Rota #${i + 1}: ${route.from} (${route.fromUF}) ➔ ${route.to} (${route.toUF})`, 16, startY + 7);

            const body = route.items.map(it => [it.sku, it.name, it.qty, it.reason]);

            doc.autoTable({
                startY: startY + 12,
                head: [['SKU', 'Produto', 'Qtd', 'Motivo']],
                body: body,
                theme: 'grid',
                headStyles: { fillColor: [60, 60, 60] },
                margin: { left: 14 },
                maxWidth: 180
            });

            startY = doc.lastAutoTable.finalY + 15;
        });

        doc.save('remanejamento_estoque.pdf');
    };

    if (loading) return <div className="remanejamento-container"><div className="loading">Calculando Oportunidades...</div></div>;

    return (
        <div className="remanejamento-container">
            {/* Top Metrics */}
            <div className="remanejamento-metrics">
                <div className="rm-card blue">
                    <div className="rm-label">Total a Remanejar</div>
                    <div className="rm-value">{kpi.totalPecas} <span style={{ fontSize: '1rem' }}>unidades</span></div>
                    <div className="rm-sub">Movimentação sugerida</div>
                </div>
                <div className="rm-card green">
                    <div className="rm-label">Economia (Evita Compra)</div>
                    <div className="rm-value">R$ {kpi.savings.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</div>
                    <div className="rm-sub">Custo de oportunidade</div>
                </div>
                <div className="rm-card orange">
                    <div className="rm-label">Rotas de Transferência</div>
                    <div className="rm-value">{kpi.actions}</div>
                    <div className="rm-sub">Ordens logísticas</div>
                </div>
            </div>

            {/* Actions */}
            <div className="rm-actions">
                <button className="btn-generate" onClick={handleExportPDF}>
                    📄 Gerar Ordem (PDF)
                </button>
            </div>

            {/* Routes List */}
            <div className="routes-container">
                {routes.map((route, idx) => (
                    <div key={route.key} className="route-group">
                        <div className="route-header">
                            <div className="route-info">
                                <span className={`route-tag ${route.isIntraState ? 'local' : 'inter'}`}>
                                    {route.isIntraState ? 'Estadual 🚛' : 'Interestadual ✈️'}
                                </span>
                                <div className="route-title">
                                    {route.from} <span style={{ fontSize: '0.8em', color: '#666' }}>({route.fromUF})</span>
                                    <span className="arrow">➔</span>
                                    {route.to} <span style={{ fontSize: '0.8em', color: '#666' }}>({route.toUF})</span>
                                </div>
                            </div>
                            <div className="route-metric">
                                {route.items.reduce((acc, i) => acc + i.qty, 0)} itens
                            </div>
                        </div>

                        <table className="transfer-table">
                            <thead>
                                <tr>
                                    <th>SKU</th>
                                    <th>Produto</th>
                                    <th>Qtd</th>
                                    <th>Motivo (Receptor)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {route.items.map((item, i) => (
                                    <tr key={i}>
                                        <td className="sku-code">{item.sku}</td>
                                        <td>{item.name}</td>
                                        <td>
                                            <span className="qty-pill">{item.qty}</span>
                                        </td>
                                        <td className="reason-text">{item.reason}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}

                {routes.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                        Nenhuma oportunidade de balanceamento encontrada com as regras atuais.
                    </div>
                )}
            </div>
        </div>
    );
}
