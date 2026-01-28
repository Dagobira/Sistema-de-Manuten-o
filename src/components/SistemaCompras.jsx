import React, { useEffect, useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
                    // ECONOMIA INTELIGENTE - SMART PURCHASE LOGIC
                    // ========================================
                    // Sistema otimizado que:
                    // 1. Ajusta meta por lab baseado no giro (Piso Dinâmico)
                    // 2. Considera remanejamentos (Saldo de Rede)
                    // ========================================

                    let totalNecessidadeLojas = 0; // Soma dos buracos
                    let totalExcessoLojas = 0;     // Soma das sobras
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

                        // 📍 PISO DINÂMICO (Smart Floor):
                        // Ajusta piso baseado no giro do laboratório
                        let metaLab = 0;
                        if (consumo3Meses > 0) {
                            if (mediaMensalLab < 1.0) {
                                // Giro Baixo: Piso de 1 peça (evita excesso)
                                metaLab = Math.max(mediaMensalLab, 1);
                            } else {
                                // Giro Alto: Piso de 3 peças (garante vitrine)
                                metaLab = Math.max(mediaMensalLab, 3);
                            }
                        }

                        // 💰 SALDO DE REDE (Abater Excessos):
                        // Calcula necessidade E excesso separadamente
                        let necessidadeLab = 0;
                        let excessoLab = 0;

                        if (metaLab > estoqueAtualLab) {
                            // Lab está abaixo da meta → precisa
                            necessidadeLab = metaLab - estoqueAtualLab;
                        } else if (estoqueAtualLab > metaLab) {
                            // Lab está acima da meta → sobra
                            excessoLab = estoqueAtualLab - metaLab;
                        }

                        totalNecessidadeLojas += necessidadeLab;
                        totalExcessoLojas += excessoLab;

                        // Acumular consumo total da rede
                        totalConsumoRede += consumo3Meses;
                    });

                    // Média mensal de consumo da REDE INTEIRA
                    const vendaBase = totalConsumoRede / 3;

                    // Meta de Segurança da Matriz: Consumo da Rede * 1.2 (safety stock 20%)
                    const metaMatriz = vendaBase * 1.2;

                    // ========================================
                    // SALDO LÍQUIDO DE REDE
                    // ========================================
                    // Abate o excesso da rede da necessidade total
                    // Isso considera remanejamentos internos possíveis
                    let saldoLiquido = totalNecessidadeLojas - totalExcessoLojas;
                    if (saldoLiquido < 0) saldoLiquido = 0;

                    // ========================================
                    // FÓRMULA FINAL DE COMPRA (ECONOMIA INTELIGENTE)
                    // ========================================
                    // Sugestão = (Meta Segurança Matriz + Saldo Líquido) - Estoque Matriz Atual
                    //
                    // Onde:
                    // - Meta Segurança Matriz = Giro Total da Rede * 1.2
                    // - Saldo Líquido = Necessidade Lojas - Excesso Lojas (já considera remanejamento)
                    // - Estoque Matriz Atual = Estoque físico + Em Trânsito
                    //
                    const estoqueMatrizEfetivo = estoqueMatriz + qtdEmTransito;
                    let sugestao = Math.ceil((metaMatriz + saldoLiquido) - estoqueMatrizEfetivo);
                    if (sugestao < 0) sugestao = 0;

                    // 🔍 DEBUG para SKU 24113
                    if (sku === '24113') {
                        console.log('=== DEBUG SKU 24113 (ECONOMIA INTELIGENTE) ===');
                        console.log('Consumo Total Rede (3 meses):', totalConsumoRede.toFixed(2));
                        console.log('Consumo Base/Mês (vendaBase):', vendaBase.toFixed(2));
                        console.log('Meta Segurança Matriz (1.2x):', metaMatriz.toFixed(2));
                        console.log('--- Saldo de Rede ---');
                        console.log('Total Necessidade Lojas (Buracos):', totalNecessidadeLojas.toFixed(2));
                        console.log('Total Excesso Lojas (Sobras):', totalExcessoLojas.toFixed(2));
                        console.log('Saldo Líquido (Necessidade - Excesso):', saldoLiquido.toFixed(2));
                        console.log('--- Estoque Matriz ---');
                        console.log('Estoque Matriz Físico:', estoqueMatriz);
                        console.log('Em Trânsito:', qtdEmTransito);
                        console.log('Estoque Efetivo (Matriz + Trânsito):', estoqueMatrizEfetivo);
                        console.log('--- Fórmula Final ---');
                        console.log('CÁLCULO: (' + metaMatriz.toFixed(2) + ' + ' + saldoLiquido.toFixed(2) + ') - ' + estoqueMatrizEfetivo + ' = ' + sugestao);
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
                        totalNecessidadeLojas: saldoLiquido, // Saldo Líquido (já descontou excessos)
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

    // 📄 EXPORTAÇÃO PDF GERENCIAL (Relatório Completo)
    const handleExportPDFGerencial = () => {
        const itemsToComprar = filteredData.filter(r => r.status === 'Comprar');

        if (itemsToComprar.length === 0) {
            alert('Não há itens para comprar com os filtros selecionados.');
            return;
        }

        const doc = new jsPDF('landscape', 'mm', 'a4');

        // Cabeçalho
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        const dateStr = new Date().toLocaleDateString('pt-BR');
        const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        doc.text('Relatorio de Gestao de Estoque e Compras', 14, 15);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Data de Geracao: ${dateStr} as ${timeStr}`, 14, 22);

        doc.setFontSize(8);
        doc.text('Metodologia: Pull System - REGRA DO PISO (Minimo 3 pecas/loja com vendas) + Safety Stock 20%', 14, 27);

        if (selectedCategory) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(`Filtro de Categoria: ${selectedCategory}`, 14, 32);
        }

        // KPIs em linhas separadas
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const kpiY = selectedCategory ? 38 : 33;
        const totalItensComprar = itemsToComprar.reduce((sum, r) => sum + r.sugestao, 0);
        const itensCriticos = itemsToComprar.filter(r => r.estoqueMatriz === 0).length;
        const totalBackorder = itemsToComprar.reduce((sum, r) => sum + r.totalNecessidadeLojas, 0);

        doc.setTextColor(0, 0, 0);
        doc.text(`Total a Comprar: ${totalItensComprar} pecas`, 14, kpiY);
        doc.text(`Itens Criticos (Zerados): ${itensCriticos}`, 120, kpiY);
        doc.text(`Backorder Total: ${totalBackorder.toFixed(0)} pecas`, 220, kpiY);

        // Preparar dados da tabela
        const tableBody = itemsToComprar.map(r => [
            r.sku,
            r.produto.substring(0, 45) + (r.produto.length > 45 ? '...' : ''),
            r.categoria.substring(0, 18),
            r.estoqueMatriz.toString(),
            r.totalNecessidadeLojas.toFixed(1),
            r.sugestao.toString()
        ]);

        // Gerar tabela
        autoTable(doc, {
            startY: kpiY + 8,
            head: [['SKU', 'Produto', 'Categoria', 'Est. Matriz', 'Nec. Lojas', 'Sugestao']],
            body: tableBody,
            theme: 'striped',
            styles: {
                fontSize: 9,
                cellPadding: 4,
                lineColor: [200, 200, 200],
                lineWidth: 0.1
            },
            headStyles: {
                fillColor: [41, 128, 185],
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
                1: { cellWidth: 'auto', halign: 'left' },
                2: { cellWidth: 38, halign: 'left' },
                3: { cellWidth: 24, halign: 'center' },
                4: { cellWidth: 24, halign: 'center' },
                5: { cellWidth: 28, halign: 'center', fontStyle: 'bold' }
            },
            didParseCell: function (data) {
                // Destacar Estoque Zerado em VERMELHO
                if (data.section === 'body' && data.column.index === 3) {
                    if (data.cell.raw === '0' || data.cell.raw === 0) {
                        data.cell.styles.textColor = [220, 53, 69];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }

                // Destacar Nec. Lojas > 0 em VERMELHO
                if (data.section === 'body' && data.column.index === 4) {
                    const value = parseFloat(data.cell.raw);
                    if (value > 0) {
                        data.cell.styles.textColor = [220, 53, 69];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }

                // Destacar Sugestão com FUNDO AMARELO
                if (data.section === 'body' && data.column.index === 5) {
                    const value = parseInt(data.cell.raw);
                    if (value > 0) {
                        data.cell.styles.fillColor = [255, 243, 205];
                        data.cell.styles.textColor = [0, 0, 0];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        });

        // Rodapé
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text(
                `Pagina ${i} de ${pageCount} - Sistema de Gestao VX - USO INTERNO`,
                doc.internal.pageSize.getWidth() / 2,
                doc.internal.pageSize.getHeight() - 10,
                { align: 'center' }
            );
        }

        doc.save(`relatorio-gerencial-${dateStr.replace(/\//g, '-')}.pdf`);
    };

    // 🚚 EXPORTAÇÃO PDF PEDIDO FORNECEDOR (Simplificado)
    const handleExportPDFPedido = () => {
        const itemsToComprar = filteredData.filter(r => r.status === 'Comprar');

        if (itemsToComprar.length === 0) {
            alert('Não há itens para comprar com os filtros selecionados.');
            return;
        }

        const doc = new jsPDF('landscape', 'mm', 'a4');

        // Cabeçalho
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        const dateStr = new Date().toLocaleDateString('pt-BR');
        doc.text(`Ordem de Compra - ${dateStr}`, 14, 15);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Empresa: Sistema de Gestao VX', 14, 23);
        doc.text(`Data de Emissao: ${dateStr}`, 14, 29);

        if (selectedCategory) {
            doc.setFont('helvetica', 'bold');
            doc.text(`Categoria: ${selectedCategory}`, 14, 35);
        }

        // Total de itens
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        const headerY = selectedCategory ? 42 : 36;
        const totalItensComprar = itemsToComprar.reduce((sum, r) => sum + r.sugestao, 0);
        const totalItensDistintos = itemsToComprar.length;

        doc.setTextColor(0, 0, 0);
        doc.text(`Total de Pecas: ${totalItensComprar}`, 14, headerY);
        doc.text(`Total de SKUs: ${totalItensDistintos}`, 120, headerY);

        // Preparar dados da tabela SIMPLIFICADA (sem Est. Matriz, Nec. Lojas)
        const tableBody = itemsToComprar.map(r => [
            r.sku,
            r.produto.substring(0, 70) + (r.produto.length > 70 ? '...' : ''),
            r.categoria.substring(0, 25),
            r.sugestao.toString()
        ]);

        // Gerar tabela simplificada
        autoTable(doc, {
            startY: headerY + 8,
            head: [['SKU', 'Produto', 'Categoria', 'Qtd. Solicitada']],
            body: tableBody,
            theme: 'grid',
            styles: {
                fontSize: 10,
                cellPadding: 5,
                lineColor: [100, 100, 100],
                lineWidth: 0.2
            },
            headStyles: {
                fillColor: [52, 73, 94],
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 11
            },
            columnStyles: {
                0: { cellWidth: 30, halign: 'center', fontStyle: 'bold', fontSize: 10 },
                1: { cellWidth: 'auto', halign: 'left', fontSize: 9 },
                2: { cellWidth: 50, halign: 'left' },
                3: { cellWidth: 35, halign: 'center', fontStyle: 'bold', fillColor: [255, 243, 205], fontSize: 11 }
            }
        });

        // Rodapé
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text(
                `Ordem de Compra - Pagina ${i} de ${pageCount}`,
                doc.internal.pageSize.getWidth() / 2,
                doc.internal.pageSize.getHeight() - 10,
                { align: 'center' }
            );
        }

        doc.save(`ordem-compra-${dateStr.replace(/\//g, '-')}.pdf`);
    };

    // 📊 EXPORTAÇÃO CSV PROFISSIONAL (Para Excel)
    const handleExportCSV = () => {
        // Filtrar apenas itens que precisam ser comprados
        const itemsToComprar = filteredData.filter(r => r.status === 'Comprar');

        if (itemsToComprar.length === 0) {
            alert('Não há itens para comprar com os filtros selecionados.');
            return;
        }

        // Cabeçalho CSV
        const headers = [
            'SKU',
            'Produto',
            'Categoria',
            'Consumo_Base_Mes',
            'Estoque_Matriz',
            'Em_Transito',
            'Necessidade_Lojas',
            'Sugestao_Final',
            'Status'
        ];

        // Dados
        const rows = itemsToComprar.map(r => [
            r.sku,
            r.produto.replace(/,/g, ';'), // Substituir vírgulas por ponto-e-vírgula
            r.categoria,
            r.vendaBase.toFixed(2),
            r.estoqueMatriz,
            r.emTransito,
            r.totalNecessidadeLojas.toFixed(2),
            r.sugestao,
            r.status
        ]);

        // Montar CSV
        let csvContent = '\uFEFF'; // BOM para UTF-8
        csvContent += headers.join(',') + '\n';
        csvContent += rows.map(row => row.join(',')).join('\n');

        // Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');

        link.setAttribute('href', url);
        link.setAttribute('download', `compras-${dateStr}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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


                {/* Botões de Exportação */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                        onClick={handleExportPDFGerencial}
                        className="btn-export"
                        style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none',
                            color: 'white',
                            fontWeight: '600',
                            boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)',
                            fontSize: '13px',
                            padding: '8px 14px'
                        }}
                        title="Relatório completo com todas as colunas (uso interno)"
                    >
                        📄 Relatório Gerencial
                    </button>
                    <button
                        onClick={handleExportPDFPedido}
                        className="btn-export"
                        style={{
                            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                            border: 'none',
                            color: 'white',
                            fontWeight: '600',
                            boxShadow: '0 4px 6px rgba(245, 87, 108, 0.3)',
                            fontSize: '13px',
                            padding: '8px 14px'
                        }}
                        title="Ordem de compra simplificada para enviar ao fornecedor"
                    >
                        🚚 Pedido Fornecedor
                    </button>
                    <button
                        onClick={handleExportCSV}
                        className="btn-export"
                        style={{
                            background: 'linear-gradient(135deg, #06d6a0 0%, #00b894 100%)',
                            border: 'none',
                            color: 'white',
                            fontWeight: '600',
                            boxShadow: '0 4px 6px rgba(6, 214, 160, 0.3)',
                            fontSize: '13px',
                            padding: '8px 14px'
                        }}
                        title="Exportar para Excel (formato CSV)"
                    >
                        📊 Baixar CSV
                    </button>
                </div>
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
                                <th className="right" title="SALDO LÍQUIDO DE REDE: Necessidade total dos labs (buracos) MENOS excessos de estoque. Considera remanejamentos internos. PISO DINÂMICO: Labs com giro baixo (<1/mês) = piso 1. Labs com giro alto (>=1/mês) = piso 3.">
                                    Nec. Lojas 🔴
                                </th>
                                <th className="right" title="ECONOMIA INTELIGENTE: Sugestão = (Meta Matriz 1.2x + Saldo Líquido) - Estoque Matriz. Saldo Líquido já desconta excessos da rede, otimizando a compra.">
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
