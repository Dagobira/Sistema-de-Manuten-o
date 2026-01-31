// src/components/SistemaCompras.jsx
import React, { useState, useEffect, useMemo } from 'react';

// LIB & CONSTANTS
import { loadCSV } from '../lib/csv';
import { buildProductMap, buildMatrizMap, buildLabSnapshotMap, computeFelipeTable, parseSkuInput, normalizeMovRows, buildMonthOptions, buildLabOptions } from '../lib/engine';
import { BUSINESS_RULES } from '../constants/business';

// UTILS
import { generateOrderPDF } from '../utils/pdfExport';

// COMPONENTS
import LoadingState from './common/LoadingState';
import ErrorState from './common/ErrorState';
import ResultTable from './ResultTable';
import TopLists from './TopLists';
import KPICards from './KPICards';
import FilterPanel from './FilterPanel';
import ParamsPanel from './ParamsPanel';

// STYLES
import './SistemaCompras.css';

export default function SistemaCompras() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // DADOS BRUTOS
    const [data, setData] = useState({
        prodMap: new Map(),
        stockMatriz: new Map(),
        stockLab: new Map(),
        movRows: [],
        months: []
    });

    // FILTROS
    const [filters, setFilters] = useState({
        mesInicio: '',
        mesFim: '',
        labs: [],
        categorias: [],
        skuList: [],
        skuInput: '' // Texto livre para input de SKUs
    });

    // PARÂMETROS
    const [params, setParams] = useState({
        transferenciaMinima: BUSINESS_RULES.TRANSFERENCIA_MINIMA,
        regra6m: BUSINESS_RULES.REGRA_6M,
        regra12m: BUSINESS_RULES.REGRA_12M,
        coberturaAlvoMeses: BUSINESS_RULES.COBERTURA_ALVO_MESES
    });

    // CARREGAR DADOS
    useEffect(() => {
        async function init() {
            try {
                setLoading(true);
                const [mov, prod, stock] = await Promise.all([
                    loadCSV('/Movimentacao.csv'),
                    loadCSV('/Produtos.csv'),
                    loadCSV('/Estoque.csv')
                ]);


                // O engine exports `normalizeMovRows` mas `computeFelipeTable` espera `movRows` já normalizado?
                // Verificando engine.js: `computeFelipeTable` acessa `r.Mes`, `r.Laboratorio`.
                // Então PRECISAMOS normalizar aqui.
                const normalizedMov = normalizeMovRows(mov);

                const prodMap = buildProductMap(prod);
                const stockMatriz = buildMatrizMap(stock);
                const stockLab = buildLabSnapshotMap(stock);
                const months = buildMonthOptions(normalizedMov);

                // Default Dates (Últimos 3 meses ou ultimo disponivel)
                const lastMonth = months[months.length - 1];
                const startMonth = months.length >= 3 ? months[months.length - 3] : months[0];

                setData({
                    prodMap, stockMatriz, stockLab, movRows: normalizedMov, months
                });

                setFilters(prev => ({ ...prev, mesInicio: startMonth, mesFim: lastMonth }));

            } catch (err) {
                console.error(err);
                setError("Erro ao carregar sistema de compras.");
            } finally {
                setLoading(false);
            }
        }
        init();
    }, []);

    // --- CÁLCULO CORE (MEMOIZED) ---
    const calculationResult = useMemo(() => {
        if (!data.movRows.length) return null;

        // Parse SKU List from input text
        const skuListCalc = filters.skuInput ? parseSkuInput(filters.skuInput) : filters.skuList;

        const computed = computeFelipeTable({
            prodMap: data.prodMap,
            matrizMap: data.stockMatriz,
            labSnapMap: data.stockLab,
            movRows: data.movRows,
            filters: { ...filters, skuList: skuListCalc },
            params
        });

        return computed.rows;
    }, [data, filters, params]);

    // --- ESTATÍSTICAS (MEMOIZED) ---
    const stats = useMemo(() => {
        if (!calculationResult) return null;

        const totalReposicao = calculationResult.reduce((acc, r) => acc + r.Reposicao, 0);
        const totalExcesso = calculationResult.reduce((acc, r) => acc + r.Remanejamento, 0);
        const criticos = calculationResult.filter(r => r.Status === 'Crítico').length;
        const ok = calculationResult.filter(r => r.Status === 'Ok').length;

        // Top Lists
        const topVendas = [...calculationResult].sort((a, b) => b.Vendas - a.Vendas).slice(0, 15);
        const topReposicao = [...calculationResult].sort((a, b) => b.Reposicao - a.Reposicao).slice(0, 15);

        return { totalReposicao, totalExcesso, criticos, ok, topVendas, topReposicao };
    }, [calculationResult]);


    // --- HANDLERS ---
    const handleExportPDF = (type) => {
        if (!calculationResult) return;

        let items = [];
        let title = "";
        let color = [];
        let file = "";

        if (type === 'reposicao') {
            items = calculationResult.filter(r => r.Reposicao > 0);
            title = "PEDIDO DE REPOSIÇÃO";
            color = [0, 122, 255];
            file = "pedido_reposicao.pdf";
        } else {
            items = calculationResult.filter(r => r.Remanejamento > 0);
            title = "LISTA DE REMANEJAMENTO";
            color = [220, 38, 38];
            file = "remanejamento.pdf";
        }

        const columns = [
            { label: "Lab", getValue: r => r.Laboratorio },
            { label: "SKU", getValue: r => r.SKU },
            { label: "Produto", getValue: r => r.Descricao },
            { label: "Qtd", getValue: r => type === 'reposicao' ? r.Reposicao : r.Remanejamento },
            { label: "Status", getValue: r => r.Status }
        ];

        generateOrderPDF(items, {
            title,
            columns,
            colorHead: color,
            fileName: file
        });
    };

    if (loading) return <LoadingState message="Calculando sugestões de compra..." />;
    if (error) return <ErrorState error={error} onRetry={() => window.location.reload()} />;

    return (
        <div className="sistema-compras fade-in">
            <div className="header-section">
                <h1>Sugestão de Compras & Remanejamento</h1>
                <p className="subtitle">Algoritmo inteligente de abastecimento baseado em histórico de vendas.</p>
            </div>

            {/* CONTROLES */}
            <div className="controls-container">
                <FilterPanel
                    filters={filters}
                    setFilters={setFilters}
                    months={data.months}
                    // Passar labs disponíveis no movRows para o filtro
                    labsAvailable={buildLabOptions(data.movRows)}
                />

                <ParamsPanel
                    params={params}
                    update={patch => setParams(prev => ({ ...prev, ...patch }))}
                />
            </div>

            {/* DASHBOARD */}
            {stats && (
                <>
                    <KPICards stats={stats} />

                    <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '20px', margin: '20px 0' }}>
                        <ResultTable
                            rows={calculationResult}
                            onExport={handleExportPDF}
                        />
                        <TopLists
                            topVendas={stats.topVendas}
                            topReposicao={stats.topReposicao}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
