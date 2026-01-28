import React, { useEffect, useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { loadCSV, toNumber } from '../lib/csv';
import './SistemaCompras.css';

const LOCALSTORAGE_KEY = 'compras_em_transito';

export default function SistemaCompras() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [categories, setCategories] = useState([]);
    const [filterText, setFilterText] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [stats, setStats] = useState({ toBuy: 0, critical: 0 });
    const [emTransito, setEmTransito] = useState({});

    // Carrega dados do localStorage ao montar o componente
    useEffect(() => {
        try {
            const saved = localStorage.getItem(LOCALSTORAGE_KEY);
            if (saved) {
                setEmTransito(JSON.parse(saved));
            }
        } catch (err) {
            console.error("Erro ao carregar dados do localStorage:", err);
        }
    }, []);

    // Salva dados no localStorage sempre que mudar
    useEffect(() => {
        try {
            localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(emTransito));
        } catch (err) {
            console.error("Erro ao salvar dados no localStorage:", err);
        }
    }, [emTransito]);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                const [prodRows, movRows, stockRows, labStockRows] = await Promise.all([
                    loadCSV('/data/stg_produto.csv'),
                    loadCSV('/data/stg_lab_mov_mensal.csv'),
                    loadCSV('/data/stg_estoque_matriz.csv'),
                    loadCSV('/data/stg_estoque_lab.csv'),
                ]);

                // Mapa de estoque matriz
                const stockMap = new Map();
                stockRows.forEach(r => {
                    const sku = String(r.SKU).trim();
                    stockMap.set(sku, toNumber(r.QtdEstoque));
                });

                // Mapa de estoque total dos laboratórios
                const labStockMap = new Map();
                labStockRows.forEach(r => {
                    const sku = String(r.SKU).trim();
                    const qtd = toNumber(r.QtdEstoque);
                    const current = labStockMap.get(sku) || 0;
                    labStockMap.set(sku, current + qtd);
                });

                // Mapa de produtos
                const prodMap = new Map();
                const cats = new Set();

                prodRows.forEach(r => {
                    const sku = String(r.SKU).trim();
                    const cat = r.Categoria || 'Sem Categoria';
                    cats.add(cat);

                    prodMap.set(sku, {
                        nome: r.DescricaoProduto || 'Desconhecido',
                        preco: toNumber(r.PrecoVenda),
                        categoria: cat
                    });
                });

                setCategories(Array.from(cats).sort());

                // Obter todos os meses disponíveis e ordenar
                const allDates = movRows.map(r => r.AnoMes).filter(Boolean).sort();
                const uniqueMonths = [...new Set(allDates)].sort().reverse();

                // Últimos 3 meses para cálculo
                const last3Months = new Set(uniqueMonths.slice(0, 3));

                // ========================================
                // REGRA DO PISO - NOVA LÓGICA DE ABASTECIMENTO
                // ========================================
                // Calcula o CONSUMO INDIVIDUAL de cada laboratório para aplicar
                // a regra: "Se teve venda, precisa ter no mínimo 3 peças na vitrine"
                // ========================================

                // Mapa: SKU -> Laboratório -> Consumo Total (últimos 3 meses)
                const consumoPorLabMap = new Map();

                movRows.forEach(r => {
                    const sku = String(r.SKU).trim();
                    const lab = String(r.Laboratorio).trim();

                    // ✅ CONSUMO TOTAL = Soma de TODAS as saídas de estoque
                    const consumoTotal =
                        toNumber(r.PecasVendidas) +      // Vendas normais
                        toNumber(r.Danificado) +         // Produto danificado
                        toNumber(r.Defeito) +            // Produto com defeito
                        toNumber(r.ErroOperacional) +    // Erro operacional
                        toNumber(r.Excecao) +            // Exceção
                        toNumber(r.ExcecaoDiamante) +    // Exceção diamante
                        toNumber(r.Garantia) +           // Usado em garantia
                        toNumber(r.NaoOrcado) +          // Não orçado
                        toNumber(r.ServicoDesfeito);     // Serviço desfeito

                    // Acumula apenas dos últimos 3 meses, POR LABORATÓRIO
                    if (last3Months.has(r.AnoMes)) {
                        if (!consumoPorLabMap.has(sku)) {
                            consumoPorLabMap.set(sku, new Map());
                        }

                        const labMap = consumoPorLabMap.get(sku);
                        const currentConsumo = labMap.get(lab) || 0;
                        labMap.set(lab, currentConsumo + consumoTotal);
                    }
                });

                const result = [];
                let totalItemsToBuy = 0;
                let criticalItems = 0;

                prodMap.forEach((info, sku) => {
                    const estoqueMatriz = stockMap.get(sku) || 0;
                    const estoqueLabsTotal = labStockMap.get(sku) || 0;
                    const qtdEmTransito = emTransito[sku] || 0;

                    // ========================================
                    // REGRA DO PISO - CÁLCULO DE BACKORDER POR LOJA
                    // ========================================

                    let totalNecessidadeLojas = 0;
                    let totalConsumoRede = 0;

                    // Pegar o mapa de consumo por lab para este SKU
                    const labConsumoMap = consumoPorLabMap.get(sku) || new Map();

                    // Para cada laboratório que tem estoque deste SKU
                    labStockRows.forEach(labStock => {
                        if (String(labStock.SKU).trim() !== sku) return;

                        const lab = String(labStock.Laboratorio).trim();
                        const estoqueAtualLab = toNumber(labStock.QtdEstoque);

                        // Consumo deste lab nos últimos 3 meses
                        const consumo3Meses = labConsumoMap.get(lab) || 0;
                        const mediaMensalLab = consumo3Meses / 3;

                        // 📍 REGRA DO PISO:
                        // Se teve venda nos últimos 3 meses, meta = MAX(média mensal, 3 peças)
                        // Se não teve venda, meta = 0 (não precisa ter estoque)
                        let metaLab = 0;
                        if (consumo3Meses > 0) {
                            metaLab = Math.max(mediaMensalLab, 3);
                        }

                        // Calcular o "buraco" (backorder) deste lab
                        const backorderLab = Math.max(0, metaLab - estoqueAtualLab);
                        totalNecessidadeLojas += backorderLab;

                        // Acumular consumo total da rede
                        totalConsumoRede += consumo3Meses;
                    });

                    // Média mensal de consumo da REDE INTEIRA
                    const vendaBase = totalConsumoRede / 3;

                    // Meta de Segurança da Matriz: Consumo da Rede * 1.2 (safety stock 20%)
                    const metaMatriz = vendaBase * 1.2;

                    // ========================================
                    // FÓRMULA FINAL DE COMPRA
                    // ========================================
                    // Sugestão = (Meta Segurança Matriz + TotalBackorder) - Estoque Matriz Atual
                    //
                    // Onde:
                    // - Meta Segurança Matriz = Giro Total da Rede * 1.2
                    // - TotalBackorder = Soma dos "buracos" de todas as lojas (considerando Regra do Piso)
                    // - Estoque Matriz Atual = Estoque físico + Em Trânsito
                    //
                    const estoqueMatrizEfetivo = estoqueMatriz + qtdEmTransito;
                    let sugestao = Math.ceil((metaMatriz + totalNecessidadeLojas) - estoqueMatrizEfetivo);
                    if (sugestao < 0) sugestao = 0;

                    // 🔍 DEBUG para SKU 24113
                    if (sku === '24113') {
                        console.log('=== DEBUG SKU 24113 (REGRA DO PISO) ===');
                        console.log('Consumo Total Rede (3 meses):', totalConsumoRede.toFixed(2));
                        console.log('Consumo Base/Mês (vendaBase):', vendaBase.toFixed(2));
                        console.log('Meta Segurança Matriz (1.2x):', metaMatriz.toFixed(2));
                        console.log('Total Necessidade Lojas (Backorder c/ Regra Piso):', totalNecessidadeLojas.toFixed(2));
                        console.log('Estoque Matriz Atual:', estoqueMatriz);
                        console.log('Em Trânsito:', qtdEmTransito);
                        console.log('Estoque Efetivo (Matriz + Trânsito):', estoqueMatrizEfetivo);
                        console.log('CÁLCULO: (' + metaMatriz.toFixed(2) + ' + ' + totalNecessidadeLojas.toFixed(2) + ') - ' + estoqueMatrizEfetivo + ' = ' + sugestao);
                        console.log('========================================');
                    }

                    // Alerta de saturação global
                    const estoqueTotal = estoqueMatriz + estoqueLabsTotal;
                    const temSaturacao = estoqueTotal > (vendaBase * 4);

                    let status = 'Estoque OK';
                    if (sugestao > 0) status = 'Comprar';

                    if (sugestao > 0) {
                        totalItemsToBuy += sugestao;
                    }
                    if (estoqueMatriz === 0 && vendaBase > 0) {
                        criticalItems++;
                    }

                    result.push({
                        sku,
                        produto: info.nome,
                        categoria: info.categoria,
                        vendaBase: vendaBase,
                        mediaUsada: '3m', // Agora sempre usa 3 meses
                        metaMatriz: metaMatriz,
                        estoqueMatriz: estoqueMatriz,
                        emTransito: qtdEmTransito,
                        totalNecessidadeLojas: totalNecessidadeLojas,
                        sugestao: sugestao,
                        precoUnitario: info.preco,
                        status,
                        temSaturacao,
                        estoqueLabsTotal
                    });
                });

                result.sort((a, b) => b.sugestao - a.sugestao);

                setData(result);
                setStats({
                    toBuy: totalItemsToBuy,
                    critical: criticalItems
                });

            } catch (err) {
                console.error("Erro ao carregar dados:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [emTransito]);

    const filteredData = useMemo(() => {
        let res = data;

        if (selectedCategory) {
            res = res.filter(r => r.categoria === selectedCategory);
        }

        if (filterText) {
            const lower = filterText.toLowerCase();
            res = res.filter(r =>
                r.produto.toLowerCase().includes(lower) ||
                r.sku.toLowerCase().includes(lower)
            );
        }
        return res;
    }, [data, filterText, selectedCategory]);

    const handleEmTransitoChange = (sku, value) => {
        const numValue = parseInt(value) || 0;
        setEmTransito(prev => ({
            ...prev,
            [sku]: numValue
        }));
    };

    const handleExportPDF = () => {
        // Filtrar apenas itens que precisam ser comprados
        const itemsToComprar = filteredData.filter(r => r.status === 'Comprar');

        if (itemsToComprar.length === 0) {
            alert('Não há itens para comprar com os filtros selecionados.');
            return;
        }

        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("Pedido de Compras", 14, 22);

        doc.setFontSize(10);
        const dateStr = new Date().toLocaleDateString('pt-BR');
        doc.text(`Gerado em: ${dateStr}`, 14, 28);
        doc.text('Metodologia: Pull System - REGRA DO PISO (Mínimo 3 peças/loja com vendas) + Safety Stock 20%', 14, 33);

        if (selectedCategory) {
            doc.text(`Categoria: ${selectedCategory}`, 14, 38);
        }

        doc.setFontSize(12);
        const kpiY = selectedCategory ? 45 : 40;
        const totalItensComprar = itemsToComprar.reduce((sum, r) => sum + r.sugestao, 0);
        const itensCriticos = itemsToComprar.filter(r => r.estoqueMatriz === 0).length;
        doc.text(`Itens a Comprar: ${totalItensComprar} | Críticos (Zerados): ${itensCriticos}`, 14, kpiY);

        const tableBody = itemsToComprar.map(r => [
            r.sku,
            r.produto.substring(0, 35) + (r.produto.length > 35 ? '...' : ''),
            r.vendaBase.toFixed(1),
            r.estoqueMatriz,
            r.emTransito,
            r.totalNecessidadeLojas.toFixed(1),
            r.sugestao,
            r.temSaturacao ? '⚠️' : ''
        ]);

        doc.autoTable({
            startY: kpiY + 5,
            head: [['SKU', 'Produto', 'Base/Mês', 'Estoque', 'Trânsito', 'Nec.Lojas', 'Qtd Comprar', 'Alert']],
            body: tableBody,
            theme: 'striped',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [220, 53, 69] },
            columnStyles: {
                0: { cellWidth: 18 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 16, halign: 'right' },
                3: { cellWidth: 16, halign: 'right' },
                4: { cellWidth: 16, halign: 'right' },
                5: { cellWidth: 18, halign: 'right', textColor: [220, 53, 69] },
                6: { cellWidth: 20, halign: 'right', fontStyle: 'bold', textColor: [220, 53, 69] },
                7: { cellWidth: 12, halign: 'center' }
            },
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index === 3) {
                    // Destacar itens com estoque zerado
                    if (data.cell.raw === '0' || data.cell.raw === 0) {
                        data.cell.styles.textColor = [200, 0, 0];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        });

        doc.save(`pedido-compras-${dateStr.replace(/\//g, '-')}.pdf`);
    };

    if (loading) return <div className="compras-container"><div className="loading">Carregando dados...</div></div>;

    return (
        <div className="compras-container">
            {/* Cards KPI */}
            <div className="kpi-grid">
                <div className="kpi-card blue">
                    <div className="kpi-title">Total a Comprar</div>
                    <div className="kpi-value">{stats.toBuy} <span style={{ fontSize: '1rem', fontWeight: 400 }}>itens</span></div>
                </div>

                <div className="kpi-card red">
                    <div className="kpi-title">Itens Críticos (Zerados)</div>
                    <div className="kpi-value critical">{stats.critical}</div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="toolbar">
                <select
                    className="filter-select"
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                >
                    <option value="">Todas as Categorias</option>
                    {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>

                <input
                    type="text"
                    placeholder="🔍 Buscar produto ou SKU..."
                    className="search-input"
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                />
                <button onClick={handleExportPDF} className="btn-export">
                    📄 Exportar PDF
                </button>
            </div>

            {/* Tabela */}
            <div className="table-container">
                <div className="data-table-wrapper">
                    <table className="compras-table">
                        <thead>
                            <tr>
                                <th className="sku">SKU</th>
                                <th>Produto</th>
                                <th className="right" title="CONSUMO TOTAL da REDE (vendas + garantias + defeitos + outras saídas de TODOS os laboratórios) calculado pela média dos últimos 3 meses">
                                    Consumo Base/Mês 🏪
                                </th>
                                <th className="right">Estoque Matriz</th>
                                <th className="right" title="Quantidade já comprada mas ainda não recebida">
                                    Em Trânsito
                                </th>
                                <th className="right" title="Soma de tudo que falta para os laboratórios. REGRA DO PISO: Cada loja com vendas nos últimos 3 meses precisa ter no mínimo 3 peças OU sua média mensal (o que for maior).">
                                    Nec. Lojas 🔴
                                </th>
                                <th className="right" title="Pull System com REGRA DO PISO: Sugestão = (Meta Matriz 1.2x + Backorder Lojas) - Estoque Matriz. Lojas com vendas precisam ter mínimo 3 peças.">
                                    Sugestão 🎯
                                </th>
                                <th className="center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map(r => (
                                <tr key={r.sku}>
                                    <td className="sku">{r.sku}</td>
                                    <td className="prod-name">{r.produto}</td>
                                    <td className="right">
                                        {r.vendaBase.toFixed(1)}
                                    </td>
                                    <td className="right">{r.estoqueMatriz}</td>
                                    <td className="right">
                                        <input
                                            type="number"
                                            min="0"
                                            value={r.emTransito}
                                            onChange={(e) => handleEmTransitoChange(r.sku, e.target.value)}
                                            style={{
                                                width: '60px',
                                                padding: '4px',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                textAlign: 'right'
                                            }}
                                        />
                                    </td>
                                    <td className="right" style={{ color: r.totalNecessidadeLojas > 0 ? '#dc3545' : '#666', fontWeight: r.totalNecessidadeLojas > 0 ? 'bold' : 'normal' }}>
                                        {r.totalNecessidadeLojas.toFixed(1)}
                                    </td>
                                    <td className="right sugestao-val">{r.sugestao}</td>
                                    <td className="center">
                                        <span className={`badge ${r.status === 'Comprar' ? 'comprar' : 'ok'}`}>
                                            {r.status}
                                        </span>
                                        {r.temSaturacao && (
                                            <span
                                                style={{
                                                    marginLeft: '6px',
                                                    cursor: 'help',
                                                    fontSize: '1.1rem'
                                                }}
                                                title="Estoque alto na rede! Verifique possibilidade de remanejamento"
                                            >
                                                ⚠️
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                                        Nenhum produto encontrado na busca.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
