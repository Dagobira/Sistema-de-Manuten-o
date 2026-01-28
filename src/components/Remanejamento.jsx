import React, { useEffect, useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadCSV } from '../lib/csv';
import { buildLojasMap, normalizeMovRows, buildProductMap } from '../lib/engine';
import './Remanejamento.css';

// Helper local para garantir parsing numérico
function safeNum(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    // Remove R$ e espaços
    let s = String(val).replace('R$', '').trim();
    // Trata 1.000,00 vs 1000.00
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

export default function Remanejamento() {
    const [loading, setLoading] = useState(true);
    const [routes, setRoutes] = useState([]);
    const [kpi, setKpi] = useState({ totalPecas: 0, actions: 0, savings: 0 });

    // 🔍 FILTROS AVANÇADOS
    const [selectedOrigin, setSelectedOrigin] = useState('');
    const [selectedDest, setSelectedDest] = useState('');
    const [searchSku, setSearchSku] = useState('');

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

                const prodMap = buildProductMap(prodRows);
                const lojasMap = buildLojasMap(lojasRows);
                const normMovs = normalizeMovRows(movRows);
                const salesMap = new Map();

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

                const donors = new Map();
                const receivers = [];

                stockRows.forEach(row => {
                    const sku = String(row.SKU || row.Codigo || "").trim();
                    const labName = (row.Laboratorio || row.Lab || "").trim();
                    if (!sku || !labName) return;

                    const qtd = safeNum(row.QtdEstoque || row.Estoque || row.Saldo);
                    const mediaVendaMes = getAvg(labName, sku);
                    const lojaInfo = lojasMap.get(labName);
                    const uf = lojaInfo ? lojaInfo.uf : 'N/A';

                    // ========================================
                    // ECONOMIA INTELIGENTE - SMART FLOOR
                    // ========================================
                    // Mesmo algoritmo do Sistema de Compras:
                    // - Giro Baixo (<1/mês) = Piso 1
                    // - Giro Alto (>=1/mês) = Piso 3
                    // ========================================

                    let estoqueAlvo = 0;
                    if (mediaVendaMes > 0) {
                        if (mediaVendaMes < 1.0) {
                            // Giro Baixo: Piso de 1 peça (evita excesso)
                            estoqueAlvo = Math.max(Math.ceil(mediaVendaMes), 1);
                        } else {
                            // Giro Alto: Piso de 3 peças (garante vitrine)
                            estoqueAlvo = Math.max(Math.ceil(mediaVendaMes), 3);
                        }
                    }

                    // ROBIN HOOD: Identificar Doadores e Receptores
                    if (qtd > estoqueAlvo && estoqueAlvo > 0) {
                        // DOADOR: Lab tem excesso (estoque > alvo)
                        const excess = qtd - estoqueAlvo;
                        if (excess > 0) {
                            if (!donors.has(sku)) donors.set(sku, []);
                            donors.get(sku).push({
                                lab: labName,
                                uf,
                                available: excess,
                                stockOrigin: qtd
                            });
                        }
                    } else if (qtd < estoqueAlvo) {
                        // RECEPTOR: Lab tem falta (estoque < alvo)
                        const need = estoqueAlvo - qtd;
                        if (need > 0) {
                            receivers.push({
                                lab: labName,
                                uf,
                                sku,
                                need,
                                stockDest: qtd,
                                avg: mediaVendaMes,
                                estoqueAlvo: estoqueAlvo, // Guardar para debug
                                prodName: prodMap.get(sku)?.descricao || 'Item Desconhecido',
                                cost: prodMap.get(sku)?.preco || 0
                            });
                        }
                    }
                });

                const transferSuggestions = [];
                let totalStats = { qty: 0, actions: 0, money: 0 };

                receivers.forEach(req => { // Using forEach for cleaner scope
                    const potentialDonors = donors.get(req.sku);
                    if (!potentialDonors || potentialDonors.length === 0) return;

                    potentialDonors.sort((a, b) => {
                        const aSameState = (a.uf === req.uf) ? 1 : 0;
                        const bSameState = (b.uf === req.uf) ? 1 : 0;
                        if (aSameState !== bSameState) return bSameState - aSameState;
                        return b.available - a.available;
                    });

                    let remainingNeed = req.need;
                    for (const donor of potentialDonors) {
                        if (remainingNeed <= 0) break;
                        if (donor.available <= 0) continue;

                        const transferQty = Math.min(remainingNeed, donor.available);

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

                        const covVal = req.avg > 0 ? (req.stockDest / req.avg).toFixed(1) : "0.0";

                        route.items.push({
                            sku: req.sku,
                            name: req.prodName,
                            qty: transferQty,
                            origin: donor.stockOrigin,
                            dest: req.stockDest,
                            cov: covVal,
                            cost: req.cost // Salvei custo para KPI
                        });

                        donor.available -= transferQty;
                        remainingNeed -= transferQty;

                        totalStats.qty += transferQty;
                        totalStats.money += (transferQty * req.cost);
                    }
                });

                totalStats.actions = transferSuggestions.length;
                setRoutes(transferSuggestions.sort((a, b) => b.isIntraState - a.isIntraState));
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

    // 🔍 LÓGICA DE FILTRAGEM
    const origins = [...new Set(routes.map(r => r.from))].sort();
    const destinations = [...new Set(routes.map(r => r.to))].sort();

    const filteredRoutes = useMemo(() => {
        return routes.map(r => {
            // 1. Filtro de Rota (Origem/Destino)
            const matchOrigin = selectedOrigin ? r.from === selectedOrigin : true;
            const matchDest = selectedDest ? r.to === selectedDest : true;

            if (!matchOrigin || !matchDest) return null;

            // 2. Filtro de Item (SKU/Nome)
            const filteredItems = r.items.filter(i => {
                if (!searchSku) return true;
                // Suporte a múltiplos SKUs separados por vírgula
                const terms = searchSku.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
                if (terms.length === 0) return true;

                // Match se QUALQUER termo bater com SKU ou Nome
                return terms.some(term =>
                    i.sku.toLowerCase().includes(term) ||
                    i.name.toLowerCase().includes(term)
                );
            });

            if (filteredItems.length === 0) return null;

            // Retorna rota apenas com itens filtrados
            return {
                ...r,
                items: filteredItems
            };
        }).filter(Boolean);
    }, [routes, selectedOrigin, selectedDest, searchSku]);

    // 📊 KPIS DINÂMICOS
    const filteredKpi = useMemo(() => {
        let totalPecas = 0;
        let actions = 0;
        let savings = 0;

        filteredRoutes.forEach(r => {
            actions++;
            r.items.forEach(i => {
                totalPecas += i.qty;
                if (i.cost) {
                    savings += (i.qty * i.cost);
                }
            });
        });

        return { totalPecas, actions, savings };
    }, [filteredRoutes]);

    // 📄 EXPORTAR PDF (GLOBAL) - DESIGN MINIMALISTA & LIMPO
    const handleExportPDF = () => {
        const doc = new jsPDF();

        // Cores Neutras & Elegantes
        const textDark = [31, 41, 55];      // Gray 800
        const textLight = [75, 85, 99];     // Gray 600
        const accentBlue = [37, 99, 235];   // Blue 600
        const bgLight = [249, 250, 251];    // Gray 50
        const borderGray = [229, 231, 235]; // Gray 200

        // --- CABEÇALHO (Minimalista) ---
        // Sem bloco de fundo, apenas texto limpo
        doc.setTextColor(...textDark);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('INTELIGENCIA LOGISTICA', 14, 20); // Removido acento por segurança de fonte

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...textLight);
        doc.text('ORDEM DE TRANSFERENCIA & BALANCEAMENTO', 14, 26);

        // Data e Hora (Direita)
        const dateStr = new Date().toLocaleDateString('pt-BR');
        const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        doc.setFontSize(9);
        doc.text(`${dateStr} - ${timeStr}`, 200, 20, { align: 'right' });
        doc.text('Sistema Gestao VX', 200, 26, { align: 'right' });

        // Linha divisória elegante
        doc.setDrawColor(...accentBlue);
        doc.setLineWidth(0.5);
        doc.line(14, 32, 196, 32);

        // --- BOX DE RESUMO (KPIs) ---
        // Estilo "Card" sutil
        doc.setDrawColor(...borderGray);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(14, 38, 182, 22, 2, 2, 'S'); // Apenas contorno (stroke)

        // Títulos dos KPIs
        doc.setTextColor(156, 163, 175); // Gray 400
        doc.setFontSize(7);
        doc.text('TOTAL A MOVER', 20, 45);
        doc.text('ECONOMIA PROJETADA', 85, 45);
        doc.text('ROTAS ATIVAS', 150, 45);

        // Valores dos KPIs
        doc.setTextColor(...textDark);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');

        doc.text(`${filteredKpi.totalPecas} un`, 20, 53);
        doc.setTextColor(...accentBlue); // Destaque na economia
        doc.text(`R$ ${filteredKpi.savings.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 85, 53);
        doc.setTextColor(...textDark);
        doc.text(`${filteredKpi.actions} rotas`, 150, 53);

        // Filtros (se houver)
        let startY = 70;
        if (selectedOrigin || selectedDest || searchSku) {
            doc.setFontSize(8);
            doc.setTextColor(...textLight);
            doc.setFont('helvetica', 'normal');
            let filterText = 'Filtros Ativos: ';
            if (selectedOrigin) filterText += `[Origem: ${selectedOrigin}] `;
            if (selectedDest) filterText += `[Destino: ${selectedDest}] `;
            if (searchSku) filterText += `[Busca: ${searchSku}]`;
            doc.text(filterText, 14, 66);
            startY = 74;
        } else {
            startY = 68;
        }

        // --- LISTAGEM DE ROTAS ---
        filteredRoutes.forEach((route, i) => {
            if (startY > 250) {
                doc.addPage();
                startY = 20;
            }

            // Cabeçalho da Rota (Limpo, fundo cinza muito claro)
            const isLocal = route.isIntraState;
            doc.setFillColor(...bgLight);
            doc.setDrawColor(...borderGray);
            doc.rect(14, startY, 182, 9, 'FD');

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...textDark);

            // Usando caracteres seguros (ASCII) em vez de emojis para evitar bugs de PDF
            const typeLabel = isLocal ? '[ESTADUAL]' : '[INTER]';
            doc.text(`Rota #${i + 1}`, 18, startY + 6);

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...textLight);

            // Layout alinhado e limpo
            doc.text(`${typeLabel}   ${route.from} (${route.fromUF})  >>  ${route.to} (${route.toUF})`, 45, startY + 6);

            const body = route.items.map(it => [
                it.sku,
                it.name.substring(0, 50) + (it.name.length > 50 ? '...' : ''),
                `${it.origin} > ${it.origin - it.qty}`,
                `${it.dest} > ${Number(it.dest) + Number(it.qty)}`,
                it.qty
            ]);

            autoTable(doc, {
                startY: startY + 10,
                head: [['SKU', 'Produto', 'Origem (-)', 'Destino (+)', 'Qtd']],
                body: body,
                theme: 'grid', // Grid limpo em vez de striped
                headStyles: {
                    fillColor: [255, 255, 255],
                    textColor: [100, 100, 100],
                    fontSize: 7,
                    fontStyle: 'bold',
                    halign: 'center',
                    lineWidth: 0, // Sem borda no header para look clean
                    borderBottomWidth: 1 // Apenas linha inferior
                },
                columnStyles: {
                    0: { cellWidth: 20, halign: 'center', fontStyle: 'bold', textColor: [50, 50, 50] },
                    1: { cellWidth: 'auto', textColor: [50, 50, 50] },
                    2: { cellWidth: 25, halign: 'center', textColor: [220, 38, 38], fontSize: 7 }, // Red
                    3: { cellWidth: 25, halign: 'center', textColor: [22, 163, 74], fontSize: 7 },   // Green
                    4: { cellWidth: 15, halign: 'center', fontStyle: 'bold', fillColor: [243, 244, 246] } // Highlight Box
                },
                styles: {
                    fontSize: 8,
                    cellPadding: 3,
                    lineColor: [240, 240, 240], // Linhas bem sutis
                    lineWidth: 0.1
                },
                margin: { left: 14 }
            });

            startY = doc.lastAutoTable.finalY + 10;
        });

        // Rodapé Clean
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(200, 200, 200); // Muito sutil
            doc.text(`Pag. ${i} de ${pageCount}`, 196, 285, { align: 'right' });
        }

        doc.save(`remanejamento_${dateStr.replace(/\//g, '-')}.pdf`);
    };

    // 📄 EXPORTAR PDF DA ROTA (INDIVIDUAL) - DESIGN CLEAN
    const handleExportRoutePDF = (route) => {
        const doc = new jsPDF();

        // Cores
        const textDark = [31, 41, 55];

        // Cabeçalho
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textDark);
        doc.text('GUIA DE REMESSA (Individual)', 14, 20);

        const dateStr = new Date().toLocaleDateString('pt-BR');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Data: ${dateStr}`, 14, 26);

        // Divisória
        doc.setDrawColor(200, 200, 200);
        doc.line(14, 30, 196, 30);

        // Caixa de Origem/Destino
        doc.setFontSize(11);
        doc.text(`DE: ${route.from} (${route.fromUF})`, 14, 40);
        doc.text(`PARA: ${route.to} (${route.toUF})`, 14, 47);

        const totalItems = route.items.reduce((s, i) => s + i.qty, 0);
        doc.text(`Total de Volumes: ${totalItems} pecas`, 120, 40);

        const body = route.items.map(it => [
            it.sku,
            it.name.substring(0, 50),
            it.qty
        ]);

        autoTable(doc, {
            startY: 55,
            head: [['SKU', 'Produto', 'Qtd. Enviar']],
            body: body,
            theme: 'grid',
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: [50, 50, 50],
                fontSize: 9,
                halign: 'center',
                borderBottomWidth: 1
            },
            styles: { fontSize: 10, cellPadding: 3, textColor: [50, 50, 50] },
            columnStyles: {
                0: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 30, halign: 'center', fontStyle: 'bold', fillColor: [243, 244, 246] }
            }
        });

        // Assinaturas
        const finalY = doc.lastAutoTable.finalY + 40;
        doc.setDrawColor(150, 150, 150);
        doc.line(20, finalY, 80, finalY);
        doc.setFontSize(8);
        doc.text('Confere Origem', 30, finalY + 5);

        doc.line(120, finalY, 180, finalY);
        doc.text('Confere Destino', 130, finalY + 5);

        doc.save(`guia-remessa-${route.from}-${route.to}.pdf`);
    };

    if (loading) return <div className="remanejamento-container"><div className="loading">Calculando Oportunidades...</div></div>;

    return (
        <div className="remanejamento-container">
            {/* Metrics */}
            <div className="remanejamento-metrics">
                <div className="rm-card blue">
                    <div className="rm-label">Total a Remanejar</div>
                    <div className="rm-value">
                        {filteredKpi.totalPecas.toLocaleString('pt-BR')} <span>unidades</span>
                    </div>
                    <div className="rm-sub">Movimentação física</div>
                </div>
                <div className="rm-card green">
                    <div className="rm-label">Economia Gerada</div>
                    <div className="rm-value">
                        R$ {filteredKpi.savings.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <div className="rm-sub">Evita compra nova</div>
                </div>
                <div className="rm-card orange">
                    <div className="rm-label">Rotas Ativas</div>
                    <div className="rm-value">{filteredKpi.actions}</div>
                    <div className="rm-sub">Ordens logísticas</div>
                </div>
            </div>

            {/* Header com Filtros */}
            <div className="filters-bar">
                <div style={{ flex: 1 }}>
                    <label>Filtrar Origem (Quem Envia)</label>
                    <select
                        value={selectedOrigin}
                        onChange={e => setSelectedOrigin(e.target.value)}
                    >
                        <option value="">Todas as Origens</option>
                        {origins.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
                <div style={{ flex: 1 }}>
                    <label>Filtrar Destino (Quem Recebe)</label>
                    <select
                        value={selectedDest}
                        onChange={e => setSelectedDest(e.target.value)}
                    >
                        <option value="">Todos os Destinos</option>
                        {destinations.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
                <div style={{ flex: 1 }}>
                    <label>Buscar Produto (SKU ou Nome)</label>
                    <input
                        type="text"
                        placeholder="Ex: 1234, 5678, iPhone..."
                        value={searchSku}
                        onChange={e => setSearchSku(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db',
                            fontSize: '0.875rem',
                            outline: 'none',
                            transition: 'border-color 0.2s'
                        }}
                        onFocus={e => e.target.style.borderColor = '#3b82f6'}
                        onBlur={e => e.target.style.borderColor = '#d1d5db'}
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="rm-actions">
                <button className="btn-generate" onClick={handleExportPDF}>
                    📄 Relatório Geral (PDF)
                </button>
            </div>

            {/* List */}
            <div className="routes-container">
                {filteredRoutes.map((route, idx) => (
                    <div key={route.key} className="route-group">
                        <div className="route-header">
                            <div className="route-info">
                                <span className={`route-tag ${route.isIntraState ? 'local' : 'inter'}`}>
                                    {route.isIntraState ? 'Estadual 🚛' : 'Inter ✈️'}
                                </span>
                                <div className="route-title">
                                    {route.from} <span className="arrow">➔</span> {route.to}
                                </div>
                            </div>
                            <div className="route-actions" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div className="route-metric">
                                    {route.items.reduce((acc, i) => acc + i.qty, 0)} itens
                                </div>
                                <button
                                    className="btn-route-pdf"
                                    onClick={() => handleExportRoutePDF(route)}
                                >
                                    📥 Guia da Rota
                                </button>
                            </div>
                        </div>

                        <div className="route-content" style={{ overflowX: 'auto' }}>
                            <table className="transfer-table">
                                <thead>
                                    <tr>
                                        <th>SKU</th>
                                        <th>Produto</th>
                                        <th className="center">Origem</th>
                                        <th className="center">Destino</th>
                                        <th className="center">Enviar</th>
                                        <th>Situação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {route.items.map((item, i) => (
                                        <tr key={i}>
                                            <td><span className="sku-code">{item.sku}</span></td>
                                            <td>{item.name}</td>
                                            <td className="center">
                                                <span className="stock-info donor">{item.origin}</span>
                                            </td>
                                            <td className="center">
                                                <span className="stock-info">{item.dest}</span>
                                            </td>
                                            <td className="center">
                                                <span className="qty-pill">{item.qty}</span>
                                            </td>
                                            <td>
                                                {Number(item.dest) === 0 ?
                                                    <span className="status-badge critical">ZERADO</span> :
                                                    <span className="status-badge low">BX ({item.cov}m)</span>
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}

                {filteredRoutes.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', background: '#fff', borderRadius: '12px', border: '1px dashed #e5e7eb' }}>
                        Nenhuma oportunidade com os filtros selecionados.
                    </div>
                )}
            </div>
        </div>
    );
}
