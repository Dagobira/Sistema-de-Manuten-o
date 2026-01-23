import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

import FilterPanel from "./components/FilterPanel";
import ParamsPanel from "./components/ParamsPanel";
import KPICards from "./components/KPICards";
import ResultTable from "./components/ResultTable";
import TopLists from "./components/TopLists";
import QualityDashboard from "./components/QualityDashboard";
import LogisticsDashboard from "./components/LogisticsDashboard";
import SistemaCompras from "./components/SistemaCompras";
import Remanejamento from "./components/Remanejamento"; // [NOVO]

import { loadCSV } from "./lib/csv";
import {
  buildProductMap, buildMatrizMap, buildLabSnapshotMap, normalizeMovRows,
  buildLabOptions, buildMonthOptions, computeFelipeTable, parseSkuInput,
  buildLojasMap, buildTecnicosMap, normalizeDefectRows
} from "./lib/engine";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [view, setView] = useState("analise");
  const [theme, setTheme] = useState("light");

  const [prodMap, setProdMap] = useState(new Map());
  const [matrizMap, setMatrizMap] = useState(new Map());
  const [labSnapMap, setLabSnapMap] = useState(new Map());
  const [movRows, setMovRows] = useState([]);
  const [lojasMap, setLojasMap] = useState(new Map());
  const [tecnicosMap, setTecnicosMap] = useState(new Map());
  const [defectRows, setDefectRows] = useState([]);

  const [monthOptions, setMonthOptions] = useState([]);
  const [labOptions, setLabOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);

  const [filters, setFilters] = useState({ mesInicio: "", mesFim: "", categorias: [], labs: [], skuText: "" });
  const [kpiFilter, setKpiFilter] = useState(null);
  const [params, setParams] = useState({ coberturaAlvoMeses: 3, transferenciaMinima: 2, regra6m: 6, regra12m: 12 });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true); setErr("");
        const [prod, mov, estLab, estMatriz, defeitos, tecnicos, lojas] = await Promise.all([
          loadCSV("/data/stg_produto.csv"), loadCSV("/data/stg_lab_mov_mensal.csv"),
          loadCSV("/data/stg_estoque_lab.csv"), loadCSV("/data/stg_estoque_matriz.csv"),
          loadCSV("/data/stg_defeitos.csv"), loadCSV("/data/stg_tecnicos.csv"), loadCSV("/data/stg_lojas.csv")
        ]);

        const pMap = buildProductMap(prod);
        const movNorm = normalizeMovRows(mov);
        const lMap = buildLojasMap(lojas);

        setProdMap(pMap);
        setMatrizMap(buildMatrizMap(estMatriz));
        setLabSnapMap(buildLabSnapshotMap(estLab));
        setMovRows(movNorm);
        setLojasMap(lMap);
        setTecnicosMap(buildTecnicosMap(tecnicos));
        setDefectRows(normalizeDefectRows(defeitos, lMap));

        const months = buildMonthOptions(movNorm);
        setMonthOptions(months);
        setLabOptions(buildLabOptions(movNorm));
        setCategoryOptions(Array.from(new Set(Array.from(pMap.values()).map((x) => x.categoria))).sort());
        setFilters(prev => ({ ...prev, mesInicio: months[0] || "", mesFim: months[months.length - 1] || "" }));
        setLoading(false);
      } catch (e) { console.error(e); setErr(String(e.message)); setLoading(false); }
    })();
  }, []);

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

  return (
    <div className="page" data-theme={theme}>
      <div className="appShell">
        <aside className="sidebar">
          <div className="sidebarHeader">
            <div className="sidebarLogo">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 12C8 8 10 6 14 6C18 6 20 8 20 12V28C20 32 18 34 14 34C10 34 8 32 8 28V12Z" fill="#1E88E5" />
                <path d="M20 12C20 8 22 6 26 6C30 6 32 8 32 12V28C32 32 30 34 26 34C22 34 20 32 20 28V12Z" fill="#43A047" />
                <path d="M14 18C14 16 15 15 17 15H23C25 15 26 16 26 18V22C26 24 25 25 23 25H17C15 25 14 24 14 22V18Z" fill="url(#paint0_linear)" />
                <defs>
                  <linearGradient id="paint0_linear" x1="14" y1="15" x2="26" y2="25" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#1E88E5" />
                    <stop offset="1" stopColor="#43A047" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="sidebarBrand">
              <div className="sidebarTitle">Fluxo Sinc</div>
              <div className="sidebarSubtitle">Gestão Inteligente</div>
            </div>
          </div>
          <div className="navList">
            <button className={`navItem ${view === "analise" ? "navItemActive" : ""}`} onClick={() => setView("analise")}>📊 Análise Estoque</button>
            <button className={`navItem ${view === "qualidade" ? "navItemActive" : ""}`} onClick={() => setView("qualidade")}>🛡️ Qualidade</button>
            <button className={`navItem ${view === "logistica" ? "navItemActive" : ""}`} onClick={() => setView("logistica")}>🚚 Logística</button>
            <button className={`navItem ${view === "compras" ? "navItemActive" : ""}`} onClick={() => setView("compras")}>🛒 Compras</button>
            <button className={`navItem ${view === "remanejamento" ? "navItemActive" : ""}`} onClick={() => setView("remanejamento")}>🔄 Remanejamento</button>
          </div>
          <button className="themeToggle" onClick={() => setTheme(t => t === "light" ? "dark" : "light")}>Modo Escuro</button>
        </aside>

        <main className="main">
          <div className="topbar"><h1>{
            view === "analise" ? "Análise" :
              view === "qualidade" ? "Qualidade" :
                view === "logistica" ? "Logística" :
                  view === "compras" ? "Sugestão de Compras" :
                    "Remanejamento de Estoque"
          }</h1></div>
          {!loading && !err && (
            <>
              {view !== "logistica" && view !== "compras" && view !== "remanejamento" && (
                <div className="floatingWrap">
                  <div className="floatingPanel"><FilterPanel monthOptions={monthOptions} labOptions={labOptions} categoryOptions={categoryOptions} filters={filters} setFilters={setFilters} /></div>
                  {view === "analise" && <div className="floatingPanel"><ParamsPanel params={params} setParams={setParams} /></div>}
                </div>
              )}
              {view === "analise" && <><KPICards rows={computed.rows} activeFilter={kpiFilter} onCardClick={setKpiFilter} /><ResultTable rows={displayedRows} /><TopLists rows={displayedRows} /></>}
              {view === "qualidade" && <QualityDashboard defects={defectRows} prodMap={prodMap} filters={filters} />}
              {view === "logistica" && <LogisticsDashboard lojasMap={lojasMap} stockRows={computed.rows} />}
              {view === "compras" && <SistemaCompras />}
              {view === "remanejamento" && <Remanejamento />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}