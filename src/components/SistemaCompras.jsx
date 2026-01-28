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

                // Últimos 3 e 6 meses
                const last3Months = new Set(uniqueMonths.slice(0, 3));
                const last6Months = new Set(uniqueMonths.slice(0, 6));

                // ========================================
                // CÁLCULO DE DEMANDA REAL (CONSUMO TOTAL DA REDE)
                // ========================================
                // Esta lógica calcula o CONSUMO TOTAL baseado em TODAS as saídas de estoque:
                // - Vendas ao consumidor (PecasVendidas)
                // - Peças usadas em Garantia
                // - Peças com Defeito/Danificado
                // - Outras saídas legítimas (erro operacional, exceções, etc.)
                // O objetivo é repor TUDO que saiu da prateleira da rede, independente do motivo.
                // NÃO incluímos transferências entre lojas (não são saídas da rede).

                const sales3Map = new Map();
                const sales6Map = new Map();

                movRows.forEach(r => {
                    const sku = String(r.SKU).trim();

                    // ✅ CONSUMO TOTAL = Soma de TODAS as saídas de estoque
                    // Cada coluna representa um tipo de saída que precisa ser reposta
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

                    // Acumula o CONSUMO TOTAL de TODOS os laboratórios para calcular demanda da rede
                    if (last3Months.has(r.AnoMes)) {
                        const current = sales3Map.get(sku) || 0;
                        sales3Map.set(sku, current + consumoTotal); // Soma consumo total da REDE
                    }

                    if (last6Months.has(r.AnoMes)) {
                        const current = sales6Map.get(sku) || 0;
                        sales6Map.set(sku, current + consumoTotal); // Soma consumo total da REDE
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
                    // FÓRMULA DE COMPRAS (CONSUMO TOTAL + BACKORDER)
                    // ========================================

                    // 1. Calcular médias mensais de CONSUMO TOTAL da REDE INTEIRA
                    //    (Consumo = Vendas + Garantias + Defeitos + Outras Saídas)
                    const totalConsumo3Meses = sales3Map.get(sku) || 0; // Soma de todos os labs
                    const totalConsumo6Meses = sales6Map.get(sku) || 0; // Soma de todos os labs

                    const media3Meses = totalConsumo3Meses / 3;
                    const media6Meses = totalConsumo6Meses / 6;

                    // 2. Lógica Híbrida: usar o MAIOR valor entre médias 3m e 6m
                    const vendaBase = Math.max(media3Meses, media6Meses);
                    const mediaUsada = media3Meses >= media6Meses ? '3m' : '6m';

                    // 3. Meta de estoque da Matriz: Consumo Base * 1.2 (safety stock de 20%)
                    const metaMatriz = vendaBase * 1.2;

                    // 4. CÁLCULO DE BACKORDER (Necessidade Represada das Lojas)
                    // ========================================
                    // CORRIGIDO: Agora calculamos a necessidade REAL de cada laboratório
                    // baseado no estoque atual versus a meta de 1 mês de consumo
                    // ========================================
                    let totalNecessidadeLojas = 0;

                    // Primeiro, contar quantos labs existem para este SKU
                    const labsComEstoque = labStockRows.filter(r => String(r.SKU).trim() === sku);
                    const numLabs = labsComEstoque.length || 17; // Se não houver labs, assume 17

                    // Meta para cada lab: 1 mês de consumo da rede / número de labs
                    // Isso distribui o consumo mensal igualmente entre os laboratórios
                    const metaPorLab = vendaBase / numLabs;

                    labStockRows.forEach(labStock => {
                        if (String(labStock.SKU).trim() !== sku) return;

                        const estoqueAtualLab = toNumber(labStock.QtdEstoque);

                        // Se o estoque atual do lab está abaixo da meta, há um "buraco"
                        const buraco = Math.max(0, metaPorLab - estoqueAtualLab);
                        totalNecessidadeLojas += buraco;
                    });

                    // 5. FÓRMULA FINAL DE COMPRA (Pull System com Estoque Dedicado):
                    // ========================================
                    // IMPORTANTE: Matriz e Lojas são ESTOQUES SEPARADOS (Baldes Dedicados)
                    // - Estoque da Matriz = Pulmão dedicado para reposição e segurança
                    // - Estoque das Lojas = Para operação diária dos labs
                    // - NUNCA subtraímos o estoque das lojas da sugestão de compra!
                    // - Motivo: Se lojas forem roubadas ou tiverem pico, Matriz precisa ter peça
                    // ========================================
                    //
                    // Fórmula: Sugestão = (Meta Matriz + Necessidade Lojas) - (Estoque Matriz + Em Trânsito)
                    //
                    // Onde:
                    // - Meta Matriz = Consumo Rede * 1.2 (pulmão da matriz para 1 mês + 20%)
                    // - Necessidade Lojas = Soma do "buraco" de labs abaixo da meta
                    // - Estoque Matriz = Estoque físico atual na matriz
                    // - Em Trânsito = Já comprado mas não recebido
                    //
                    const estoqueMatrizEfetivo = estoqueMatriz + qtdEmTransito;
                    let sugestao = Math.ceil((metaMatriz + totalNecessidadeLojas) - estoqueMatrizEfetivo);
                    if (sugestao < 0) sugestao = 0;

                    // DEBUG para SKU 24113
                    if (sku === '24113') {
                        console.log('=== DEBUG SKU 24113 ===');
                        console.log('Consumo Base (vendaBase):', vendaBase.toFixed(2));
                        console.log('Meta Segurança Matriz (1.2x):', metaMatriz.toFixed(2));
                        console.log('Total Necessidade Lojas (Buraco):', totalNecessidadeLojas.toFixed(2));
                        console.log('Estoque Matriz Atual:', estoqueMatriz);
                        console.log('Em Trânsito:', qtdEmTransito);
                        console.log('Estoque Efetivo (Matriz + Trânsito):', estoqueMatrizEfetivo);
                        console.log('CÁLCULO: (' + metaMatriz.toFixed(2) + ' + ' + totalNecessidadeLojas.toFixed(2) + ') - ' + estoqueMatrizEfetivo + ' = ' + sugestao);
                        console.log('=======================');
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
                        mediaUsada: mediaUsada,
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
        doc.text('Metodologia: Pull System - Consumo Total + Backorder (Necessidade Represada dos Labs) + Safety Stock 20%', 14, 33);

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
                                <th className="right" title="CONSUMO TOTAL da REDE (vendas + garantias + defeitos + outras saídas de TODOS os laboratórios) calculado pela média híbrida (3 ou 6 meses)">
                                    Consumo Base/Mês 🏪
                                </th>
                                <th className="right">Estoque Matriz</th>
                                <th className="right" title="Quantidade já comprada mas ainda não recebida">
                                    Em Trânsito
                                </th>
                                <th className="right" title="Soma de tudo que falta para os laboratórios atingirem o nível ideal (1 mês de consumo dividido entre labs)">
                                    Nec. Lojas 🔴
                                </th>
                                <th className="right" title="Pull System: Sugestão = (Meta Matriz + Necessidade Lojas) - (Estoque Matriz + Em Trânsito). Considera a necessidade represada dos laboratórios.">
                                    Sugestão
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
                                        <span
                                            style={{
                                                fontSize: '0.7rem',
                                                marginLeft: '4px',
                                                color: '#666',
                                                fontWeight: 'normal'
                                            }}
                                            title={`Calculado usando média de ${r.mediaUsada === '3m' ? '3 meses' : '6 meses'}`}
                                        >
                                            📊 {r.mediaUsada}
                                        </span>
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
