import React, { useState, useEffect, useMemo } from 'react';
import FilterPanel from './FilterPanel';
import ParamsPanel from './ParamsPanel';
import KPICards from './KPICards';
import ResultTable from './ResultTable';
import TopLists from './TopLists';
import {
    buildProductMap,
    buildMatrizMap,
    buildLabSnapshotMap,
    normalizeMovRows,
    buildLabOptions,
    buildMonthOptions,
    computeFelipeTable,
    parseSkuInput
} from '../lib/engine';

export default function SistemaAnalise({ rawData }) {
    // rawData: { prod, mov, stockLab, stockMatriz }

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    // State derivado
    const [prodMap, setProdMap] = useState(new Map());
    const [matrizMap, setMatrizMap] = useState(new Map());
    const [labSnapMap, setLabSnapMap] = useState(new Map());
    const [movRows, setMovRows] = useState([]);

    const [monthOptions, setMonthOptions] = useState([]);
    const [labOptions, setLabOptions] = useState([]);
    const [categoryOptions, setCategoryOptions] = useState([]);

    const [filters, setFilters] = useState({ mesInicio: "", mesFim: "", categorias: [], labs: [], skuText: "" });
    const [kpiFilter, setKpiFilter] = useState(null);
    const [params, setParams] = useState({ coberturaAlvoMeses: 3, transferenciaMinima: 2, regra6m: 6, regra12m: 12 });

    // Processa dados ao montar (ou receber novos props)
    useEffect(() => {
        if (!rawData || !rawData.mov || !rawData.prod) return;

        try {
            setLoading(true);
            const { prod, mov, stockLab, stockMatriz } = rawData;

            // Executa parsers do engine
            const pMap = buildProductMap(prod);
            const movNorm = normalizeMovRows(mov);

            setProdMap(pMap);
            setMatrizMap(buildMatrizMap(stockMatriz));
            setLabSnapMap(buildLabSnapshotMap(stockLab));
            setMovRows(movNorm);

            // Options
            const months = buildMonthOptions(movNorm);
            setMonthOptions(months);
            setLabOptions(buildLabOptions(movNorm));
            setCategoryOptions(Array.from(new Set(Array.from(pMap.values()).map((x) => x.categoria))).sort());

            // Default filters
            setFilters(prev => {
                if (prev.mesInicio) return prev; // Mantém filtro se já existe
                return {
                    ...prev,
                    mesInicio: months[0] || "",
                    mesFim: months[months.length - 1] || ""
                };
            });

            setLoading(false);
        } catch (e) {
            console.error(e);
            setErr("Erro ao processar dados de análise.");
            setLoading(false);
        }
    }, [rawData]);

    const computed = useMemo(() => {
        if (!movRows.length) return { rows: [] };
        return computeFelipeTable({ prodMap, matrizMap, labSnapMap, movRows, filters: { ...filters, skuList: parseSkuInput(filters.skuText) }, params });
    }, [prodMap, matrizMap, labSnapMap, movRows, filters, params]);

    const displayedRows = useMemo(() => {
        if (!kpiFilter) return computed.rows;
        return computed.rows.filter(r => {
            const st = String(r.Status || "").toLowerCase();
            if (kpiFilter === "critico") return r.CoberturaMeses < 1 && r.EstoqueAlvo > 0;
            if (kpiFilter === "sugerida") return r.ReposicaoSugeridaBruta > 0;
            if (kpiFilter === "devolucao") return r.DevolverSugerido > 0;
            if (kpiFilter === "semGiro6") return st.includes("6m");
            if (kpiFilter === "semGiro12") return st.includes("12m");
            return true;
        });
    }, [computed.rows, kpiFilter]);

    if (loading) return <div>Carregando Análise...</div>;
    if (err) return <div style={{ color: 'red' }}>{err}</div>;

    return (
        <>
            <div className="floatingWrap">
                <div className="floatingPanel">
                    <FilterPanel monthOptions={monthOptions} labOptions={labOptions} categoryOptions={categoryOptions} filters={filters} setFilters={setFilters} />
                </div>
                <div className="floatingPanel">
                    <ParamsPanel params={params} setParams={setParams} />
                </div>
            </div>

            <KPICards rows={computed.rows} activeFilter={kpiFilter} onCardClick={setKpiFilter} />
            <ResultTable rows={displayedRows} />
            <TopLists rows={displayedRows} />
        </>
    );
}
