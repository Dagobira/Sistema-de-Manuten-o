import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { loadCSV } from './lib/csv';
import { buildLojasMap, normalizeDefectRows, buildProductMap } from './lib/engine'; // Added imports

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import KPIDashboard from './components/KPIDashboard';
import SistemaCompras from './components/SistemaCompras';
import SistemaAnalise from './components/SistemaAnalise';
import Remanejamento from './components/Remanejamento';
import LogisticsDashboard from './components/LogisticsDashboard';
import QualityDashboard from './components/QualityDashboard'; // Added import

import './App.css'; // Restore CSS

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const [dataLoading, setDataLoading] = useState(true);
  const [appData, setAppData] = useState({});
  const [currentScreen, setCurrentScreen] = useState('analise'); // Default meaningful screen

  useEffect(() => {
    async function init() {
      console.log("🚀 [App] Iniciando carregamento de dados...");
      try {
        // Updated to load ALL required CSVs
        const [prod, mov, stock, stockMatriz, defeitos, lojas] = await Promise.all([
          loadCSV('/data/stg_produto.csv'),
          loadCSV('/data/stg_lab_mov_mensal.csv'),
          loadCSV('/data/stg_estoque_lab.csv'),
          loadCSV('/data/stg_estoque_matriz.csv'),
          loadCSV('/data/stg_defeitos.csv'),
          loadCSV('/data/stg_lojas.csv')
        ]);

        const lojasMap = buildLojasMap(lojas || []);
        const prodMap = buildProductMap(prod || []);
        const defectRows = normalizeDefectRows(defeitos || [], lojasMap);

        setAppData({
          stockRows: stock || [],
          loadingStockMatriz: stockMatriz || [],
          stockMatriz: stockMatriz || [],
          defectRows: defectRows || [],
          lojasMap: lojasMap,
          movRows: mov || [],
          prodRows: prod || [],
          prodMap: prodMap
        });
        console.log("✅ [App] Dados carregados!");
      } catch (e) {
        console.error("❌ [App] Erro fatal:", e);
      } finally {
        setDataLoading(false);
      }
    }
    init();
  }, []);

  // Reset screen on login/user change to avoid stuck state from previous user
  useEffect(() => {
    if (user) setCurrentScreen('analise');
  }, [user?.uid]);

  // 1. TELA DE CARREGAMENTO GLOBAL
  if (authLoading || dataLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: '40px', marginBottom: '20px' }} className="spin">🔄</div>
        <h2 style={{ color: '#64748b' }}>Conectando ao Servidor...</h2>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
      </div>
    );
  }

  // 2. TELA DE LOGIN
  if (!user) {
    return <Login />;
  }

  // 3. ROTEAMENTO SEGURO
  const canView = (perm) => {
    if (user.role === 'super_admin') return true;
    // Map Perm Keys if needed
    const map = { 'viewDashboard': 'view_bi' };
    const strictKey = map[perm] || perm;

    // Handle both array and object permissions
    if (Array.isArray(user.permissions)) {
      return user.permissions.includes(strictKey);
    }
    return user.permissions?.[perm];
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'bi':
      case 'dashboard': return canView('view_bi') ? <KPIDashboard /> : <Denied />;

      case 'analise': return canView('view_analise') ?
        <SistemaAnalise rawData={{ prod: appData.prodRows, mov: appData.movRows, stockLab: appData.stockRows, stockMatriz: appData.stockMatriz }} />
        : <Denied />;

      case 'compras': return canView('view_compras') ? <SistemaCompras /> : <Denied />;
      case 'remanejamento': return canView('view_remanejamento') ? <Remanejamento /> : <Denied />;

      case 'logistica': return canView('view_logistica') ?
        <LogisticsDashboard
          lojasMap={appData.lojasMap}
          stockRows={appData.stockRows}
          prodMap={appData.prodMap}
          movRows={appData.movRows}
          stockMatriz={appData.stockMatriz}
        />
        : <Denied />;

      case 'qualidade': return canView('view_qualidade') ?
        <QualityDashboard defects={appData.defectRows} prodMap={appData.prodMap} filters={{}} />
        : <Denied />;

      case 'users':
      case 'admin_users': return user.role === 'super_admin' ? <UserManagement /> : <Denied />;

      default: return <KPIDashboard />;
    }
  };

  return (
    <div className="page" data-theme="light">
      <div className="appShell">
        <Sidebar currentScreen={currentScreen} onNavigate={setCurrentScreen} user={user} />
        <main className="main">
          <Header title={currentScreen.toUpperCase()} />
          {renderScreen()}
        </main>
      </div>
    </div>
  );
}

const Denied = () => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    height: '100%', color: '#EF4444', background: '#FEF2F2',
    borderRadius: '16px', border: '2px dashed #EF4444'
  }}>
    <div style={{ fontSize: '4rem', marginBottom: '10px' }}>⛔</div>
    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Acesso Negado</h2>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}