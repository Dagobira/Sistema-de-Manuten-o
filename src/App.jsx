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
import AdminPanel from "./components/AdminPanel";
import Login from "./pages/Login";

import { AuthProvider, useAuth } from "./context/AuthContext";

import { loadCSV } from "./lib/csv";
import {
  buildProductMap, buildMatrizMap, buildLabSnapshotMap, normalizeMovRows,
  buildLabOptions, buildMonthOptions, computeFelipeTable, parseSkuInput,
  buildLojasMap, buildTecnicosMap, normalizeDefectRows
} from "./lib/engine";

function ProtectedApp() {
  const { user, loading: authLoading, logout, canAccess } = useAuth();

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
    if (!user) return; // Só carrega se tiver user

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
  }, [user]);

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

  if (authLoading) return <div className="loading">Carregando Sessão...</div>;
  if (!user) return <Login />;

  return (
    <div className="page" data-theme={theme}>
      <div className="appShell">
        <aside className="sidebar">
          <div className="sidebarHeader">
            <div className="sidebarTitle">Produto x Tempo</div>
            <small style={{ display: 'block', color: '#6b7280', fontSize: '0.7rem', marginTop: '4px' }}>
              Olá, {user.name}
            </small>
          </div>

          <div className="navList">
            {canAccess('analise') &&
              <button className={`navItem ${view === "analise" ? "navItemActive" : ""}`} onClick={() => setView("analise")}>📊 Análise Estoque</button>
            }
            {canAccess('qualidade') &&
              <button className={`navItem ${view === "qualidade" ? "navItemActive" : ""}`} onClick={() => setView("qualidade")}>🛡️ Qualidade</button>
            }
            {canAccess('logistica') &&
              <button className={`navItem ${view === "logistica" ? "navItemActive" : ""}`} onClick={() => setView("logistica")}>🚚 Logística</button>
            }
            {canAccess('compras') &&
              <button className={`navItem ${view === "compras" ? "navItemActive" : ""}`} onClick={() => setView("compras")}>🛒 Compras</button>
            }
            {canAccess('admin') &&
              <button className={`navItem ${view === "admin" ? "navItemActive" : ""}`} onClick={() => setView("admin")}>⚙️ Adm Usuários</button>
            }
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button className="themeToggle" onClick={() => setTheme(t => t === "light" ? "dark" : "light")}>Modo Escuro</button>
            <button className="themeToggle" style={{ background: '#ef4444', color: 'white', border: 'none' }} onClick={logout}>Sair</button>
          </div>
        </aside>

        <main className="main">
          {canAccess(view) ? (
            <>
              <div className="topbar">
                <h1>{
                  view === "analise" ? "Análise" :
                    view === "qualidade" ? "Qualidade" :
                      view === "logistica" ? "Logística" :
                        view === "admin" ? "Administração" :
                          "Sugestão de Compras"
                }</h1>
              </div>

              {!loading && !err && (
                <>
                  {/* Floating Panel só aparece em views que não são full-dashboard (exceto analise que usa floating panel) */}
                  {view === "analise" && (
                    <div className="floatingWrap">
                      <div className="floatingPanel"><FilterPanel monthOptions={monthOptions} labOptions={labOptions} categoryOptions={categoryOptions} filters={filters} setFilters={setFilters} /></div>
                      <div className="floatingPanel"><ParamsPanel params={params} setParams={setParams} /></div>
                    </div>
                  )}
                  {view === "qualidade" && (
                    <div className="floatingWrap">
                      <div className="floatingPanel"><FilterPanel monthOptions={monthOptions} labOptions={labOptions} categoryOptions={categoryOptions} filters={filters} setFilters={setFilters} /></div>
                    </div>
                  )}

                  {view === "analise" && <><KPICards rows={computed.rows} activeFilter={kpiFilter} onCardClick={setKpiFilter} /><ResultTable rows={displayedRows} /><TopLists rows={displayedRows} /></>}
                  {view === "qualidade" && <QualityDashboard defects={defectRows} prodMap={prodMap} filters={filters} />}
                  {view === "logistica" && <LogisticsDashboard lojasMap={lojasMap} stockRows={computed.rows} />}
                  {view === "compras" && <SistemaCompras />}
                  {view === "admin" && <AdminPanel />}
                </>
              )}
              {loading && <div className="loading">Carregando Dados...</div>}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <h2 className="text-2xl font-bold text-gray-400">Acesso Negado</h2>
              <p className="text-gray-500">Você não tem permissão para acessar esta tela.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ProtectedApp />
    </AuthProvider>
  );
}