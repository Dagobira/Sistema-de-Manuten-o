import React, { useEffect, useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { loadCSV, toNumber } from '../lib/csv';
import './SistemaCompras.css'; // Importando o CSS novo

export default function SistemaCompras() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [categories, setCategories] = useState([]); // [NOVO] Estado para categorias
    const [filterText, setFilterText] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(''); // [NOVO] Estado para filtro selecionado
    const [stats, setStats] = useState({ toBuy: 0, critical: 0 }); // [REMOVIDO] cost

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                const [prodRows, movRows, stockRows] = await Promise.all([
                    loadCSV('/data/stg_produto.csv'),
                    loadCSV('/data/stg_lab_mov_mensal.csv'),
                    loadCSV('/data/stg_estoque_matriz.csv'),
                ]);

                const stockMap = new Map();
                stockRows.forEach(r => {
                    const sku = String(r.SKU).trim();
                    stockMap.set(sku, toNumber(r.QtdEstoque));
                });

                const prodMap = new Map();
                const cats = new Set(); // [NOVO] Set para coletar categorias únicas

                prodRows.forEach(r => {
                    const sku = String(r.SKU).trim();
                    const cat = r.Categoria || 'Sem Categoria'; // [NOVO] Captura categoria
                    cats.add(cat);

                    prodMap.set(sku, {
                        nome: r.DescricaoProduto || 'Desconhecido',
                        preco: toNumber(r.PrecoVenda),
                        categoria: cat // [NOVO] Guarda a categoria
                    });
                });

                // [NOVO] Ordena e salva categorias
                setCategories(Array.from(cats).sort());

                const allDates = movRows.map(r => r.AnoMes).filter(Boolean).sort();
                const uniqueMonths = [...new Set(allDates)].sort().reverse().slice(0, 3);
                const monthsInScope = new Set(uniqueMonths);

                const salesMap = new Map();
                movRows.forEach(r => {
                    if (monthsInScope.has(r.AnoMes)) {
                        const sku = String(r.SKU).trim();
                        const qtd = toNumber(r.PecasVendidas);
                        const current = salesMap.get(sku) || 0;
                        salesMap.set(sku, current + qtd);
                    }
                });

                const result = [];
                let totalItemsToBuy = 0;
                let criticalItems = 0; // [REMOVIDO] estimatedCost

                prodMap.forEach((info, sku) => {
                    const estoqueAtual = stockMap.get(sku) || 0;
                    const totalVendas3Meses = salesMap.get(sku) || 0;
                    const mediaMensal = totalVendas3Meses / 3;

                    let sugestao = Math.ceil(mediaMensal - estoqueAtual);
                    if (sugestao < 0) sugestao = 0;

                    let status = 'Estoque OK';
                    if (sugestao > 0) status = 'Comprar';

                    if (sugestao > 0) {
                        totalItemsToBuy += sugestao;
                        // [REMOVIDO] Cost calculation
                    }
                    if (estoqueAtual === 0 && mediaMensal > 0) {
                        criticalItems++;
                    }

                    result.push({
                        sku,
                        produto: info.nome,
                        categoria: info.categoria, // [NOVO]
                        mediaMensal: mediaMensal,
                        estoqueAtual: estoqueAtual,
                        sugestao: sugestao,
                        precoUnitario: info.preco,
                        status
                    });
                });

                result.sort((a, b) => b.sugestao - a.sugestao);

                setData(result);
                setStats({
                    toBuy: totalItemsToBuy,
                    critical: criticalItems // [REMOVIDO] cost
                });

            } catch (err) {
                console.error("Erro ao carregar dados:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    const filteredData = useMemo(() => {
        let res = data;

        // [NOVO] Filtro de Categoria
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

    const handleExportPDF = () => {
        const doc = new jsPDF();

        // Título e Data
        doc.setFontSize(18);
        doc.text("Sugestão de Compras - Relatório", 14, 22);

        doc.setFontSize(10);
        const dateStr = new Date().toLocaleDateString('pt-BR');
        doc.text(`Gerado em: ${dateStr}`, 14, 28);

        // [NOVO] Mostrar categoria selecionada no PDF se houver
        if (selectedCategory) {
            doc.text(`Filtro Categoria: ${selectedCategory}`, 14, 33);
        }

        // Resumo KPI
        doc.setFontSize(12);
        // Ajustei posição Y levemente se tiver filtro
        const kpiY = selectedCategory ? 40 : 35;
        doc.text(`Total Itens: ${stats.toBuy} | Críticos: ${stats.critical}`, 14, kpiY); // [REMOVIDO] Custo

        // Filtrar apenas o que precisa comprar para o PDF (opcional, mas geralmente útil)
        // Vou imprimir o que está na tela (filteredData)
        const tableBody = filteredData.map(r => [
            r.sku,
            r.produto.substring(0, 40) + (r.produto.length > 40 ? '...' : ''), // Cortar nome longo
            r.mediaMensal.toFixed(1),
            r.estoqueAtual,
            r.sugestao,
            r.status
        ]);

        doc.autoTable({
            startY: kpiY + 5,
            head: [['SKU', 'Produto', 'Média/Mês', 'Estoque', 'Sugestão', 'Status']],
            body: tableBody,
            theme: 'striped',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] }, // Azul
            columnStyles: {
                0: { cellWidth: 25 }, // SKU
                1: { cellWidth: 'auto' }, // Produto
                2: { cellWidth: 20, halign: 'right' },
                3: { cellWidth: 20, halign: 'right' },
                4: { cellWidth: 20, halign: 'right', fontStyle: 'bold', textColor: [0, 0, 255] },
                5: { cellWidth: 25, halign: 'center' }
            },
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index === 5) {
                    if (data.cell.raw === 'Comprar') {
                        data.cell.styles.textColor = [200, 0, 0]; // Vermelho
                    } else {
                        data.cell.styles.textColor = [0, 100, 0]; // Verde
                    }
                }
            }
        });

        // Abre o PDF em nova janela com diálogo de impressão
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
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

                {/* [REMOVIDO] Card de Custo Estimado */}

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
                                <th className="right">Média Mensal</th>
                                <th className="right">Estoque Atual</th>
                                <th className="right">Sugestão</th>
                                <th className="center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map(r => (
                                <tr key={r.sku}>
                                    <td className="sku">{r.sku}</td>
                                    <td className="prod-name">{r.produto}</td>
                                    <td className="right">{r.mediaMensal.toFixed(1)}</td>
                                    <td className="right">{r.estoqueAtual}</td>
                                    <td className="right sugestao-val">{r.sugestao}</td>
                                    <td className="center">
                                        <span className={`badge ${r.status === 'Comprar' ? 'comprar' : 'ok'}`}>
                                            {r.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
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
