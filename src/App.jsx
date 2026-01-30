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
import Remanejamento from "./components/Remanejamento";
import KPIDashboard from "./components/KPIDashboard";
import Login from "./components/Login";
import UserManagement from "./components/UserManagement";
import { AuthProvider, useAuth } from "./context/AuthContext";

import { loadCSV } from "./lib/csv";
import {
  buildProductMap, buildMatrizMap, buildLabSnapshotMap, normalizeMovRows,
  buildLabOptions, buildMonthOptions, computeFelipeTable, parseSkuInput,
  buildLojasMap, buildTecnicosMap, normalizeDefectRows
} from "./lib/engine";

function MainApp() {
  const { user, logout, hasPermission, loading: authLoading } = useAuth();

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

  // Redireciona para a primeira view permitida se a atual for proibida
  useEffect(() => {
    if (!user) return;

    // Lista de views e suas permissões
    const views = [
      { id: 'analise', perm: 'view_analise' },
      { id: 'logistica', perm: 'view_logistica' },
      { id: 'remanejamento', perm: 'view_remanejamento' },
      { id: 'compras', perm: 'view_compras' },
      { id: 'bi', perm: 'view_bi' },
      { id: 'qualidade', perm: 'view_qualidade' },
      { id: 'users', perm: 'super_admin' } // Special case
    ];

    // Se a view atual não é permitida, muda pra primeira permitida
    const currentAllowed = view === 'users' ? user.role === 'super_admin' : hasPermission(`view_${view}`);

    if (!currentAllowed) {
      const first = views.find(v => v.id === 'users' ? user.role === 'super_admin' : hasPermission(v.perm));
      if (first) setView(first.id);
    }
  }, [user, view]); // eslint-disable-line

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

  if (authLoading) return <div style={{ display: 'flex', height: '100vh', fontWeight: 'bold', alignItems: 'center', justifyContent: 'center', color: '#666' }}>Carregando Sessão...</div>;

  if (!user) {
    return <Login />;
  }

  return (
    <div className="page" data-theme={theme}>
      <div className="appShell">
        <aside className="sidebar">
          <div className="sidebarHeader">
            <img src="/logo-gestaovx.png" alt="Gestão VX" className="sidebarLogoImage" />
            <div style={{ fontSize: '11px', color: 'var(--textSec)', marginTop: '4px' }}>
              Olá, <strong>{user.username}</strong>
            </div>
          </div>

          <div className="navList">
            {hasPermission('view_analise') && (
              <button className={`navItem ${view === "analise" ? "navItemActive" : ""}`} onClick={() => setView("analise")}>📊 Análise de Laboratórios</button>
            )}
            {hasPermission('view_logistica') && (
              <button className={`navItem ${view === "logistica" ? "navItemActive" : ""}`} onClick={() => setView("logistica")}>🚚 Calendário de Atendimento</button>
            )}
            {hasPermission('view_remanejamento') && (
              <button className={`navItem ${view === "remanejamento" ? "navItemActive" : ""}`} onClick={() => setView("remanejamento")}>🔄 Remanejamento Inteligente</button>
            )}
            {hasPermission('view_compras') && (
              <button className={`navItem ${view === "compras" ? "navItemActive" : ""}`} onClick={() => setView("compras")}>🛒 Compras Manutenção</button>
            )}
            {hasPermission('view_bi') && (
              <button className={`navItem ${view === "bi" ? "navItemActive" : ""}`} onClick={() => setView("bi")}>💎 BI Performance</button>
            )}
            {hasPermission('view_qualidade') && (
              <button className={`navItem ${view === "qualidade" ? "navItemActive" : ""}`} onClick={() => setView("qualidade")}>🛡️ Qualidade</button>
            )}

            {user.role === 'super_admin' && (
              <>
                <div style={{ height: '1px', background: 'var(--border2)', margin: '8px 0' }}></div>
                <button className={`navItem ${view === "users" ? "navItemActive" : ""}`} onClick={() => setView("users")}>🔐 Gestão de Usuários</button>
              </>
            )}
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button className="themeToggle" onClick={() => setTheme(t => t === "light" ? "dark" : "light")}>Modo Escuro</button>
            <button className="themeToggle" onClick={logout} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              Sair do Sistema
            </button>
          </div>
        </aside>

        <main className="main">
          <div className="topbar"><h1>{
            view === "analise" ? "Análise de Laboratórios" :
              view === "qualidade" ? "Qualidade" :
                view === "logistica" ? "Calendário de Atendimento" :
                  view === "compras" ? "Compras Manutenção" :
                    view === "remanejamento" ? "Remanejamento Inteligente" :
                      view === "users" ? "Gestão de Usuários" :
                        "BI Performance"
          }</h1></div>

          {!loading && !err && (
            <>
              {view !== "logistica" && view !== "compras" && view !== "remanejamento" && view !== "users" && (
                <div className="floatingWrap">
                  <div className="floatingPanel"><FilterPanel monthOptions={monthOptions} labOptions={labOptions} categoryOptions={categoryOptions} filters={filters} setFilters={setFilters} /></div>
                  {view === "analise" && <div className="floatingPanel"><ParamsPanel params={params} setParams={setParams} /></div>}
                </div>
              )}
              {view === "analise" && hasPermission('view_analise') && <><KPICards rows={computed.rows} activeFilter={kpiFilter} onCardClick={setKpiFilter} /><ResultTable rows={displayedRows} /><TopLists rows={displayedRows} /></>}
              {view === "qualidade" && hasPermission('view_qualidade') && <QualityDashboard defects={defectRows} prodMap={prodMap} filters={filters} />}
              {view === "logistica" && hasPermission('view_logistica') && <LogisticsDashboard lojasMap={lojasMap} stockRows={computed.rows} />}
              {view === "compras" && hasPermission('view_compras') && <SistemaCompras />}
              {view === "remanejamento" && hasPermission('view_remanejamento') && <Remanejamento />}
              {view === "bi" && hasPermission('view_bi') && <KPIDashboard />}
              {view === "users" && user.role === 'super_admin' && <UserManagement />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}