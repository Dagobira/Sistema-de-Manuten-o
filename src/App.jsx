import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { loadCSV } from './lib/csv';
import {
  buildProductMap,
  buildMatrizMap,
  buildLojasMap,
  normalizeMovRows,
  normalizeDefectRows
} from './lib/engine';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './components/Login';
import UserManagement from './components/UserManagement';

// ONLY LOGISTICS ENABLED (STABLE BUILD)
import LogisticsDashboard from './components/LogisticsDashboard';
import './App.css';

// DUMMY COMPONENTS FOR BROKEN MODULES
const MaintenanceMsg = ({ name }) => (
  <div style={{
    padding: '40px',
    textAlign: 'center',
    color: '#d97706',
    background: '#fffbeb',
    borderRadius: '8px',
    border: '1px solid #fcd34d',
    marginTop: '20px'
  }}>
    <h3 style={{ marginBottom: '10px' }}>⚠️ Módulo em Manutenção</h3>
    <p>O módulo <strong>{name}</strong> foi temporariamente desativado para correção de erros críticos de sistema.</p>
    <p style={{ fontSize: '0.9em', marginTop: '10px' }}>Por favor, utilize o painel de <strong>Logística</strong>.</p>
  </div>
);

const KPIDashboard = () => <MaintenanceMsg name="BI Dashboard" />;
const SistemaAnalise = () => <MaintenanceMsg name="Análise de Estoque" />;
const SistemaCompras = () => <MaintenanceMsg name="Sugestão de Compras" />;
const Remanejamento = () => <MaintenanceMsg name="Remanejamento" />;
const QualityDashboard = () => <MaintenanceMsg name="Qualidade" />;

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const [dataLoading, setDataLoading] = useState(true);
  const [appData, setAppData] = useState({});
  const [currentScreen, setCurrentScreen] = useState('logistica'); // Default to Working Module

  const [theme, setTheme] = useState('light');
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  useEffect(() => {
    async function init() {
      try {
        const [prod, stockMatriz, mov, stockLab, lojas, defeitos] = await Promise.all([
          loadCSV('/data/stg_produto.csv'),
          loadCSV('/data/stg_estoque_matriz.csv'),
          loadCSV('/data/stg_lab_mov_mensal.csv'),
          loadCSV('/data/stg_estoque_lab.csv'),
          loadCSV('/data/stg_lojas.csv'),
          loadCSV('/data/stg_defeitos.csv')
        ]);

        const lojasMap = buildLojasMap(lojas || []);
        const prodMap = buildProductMap(prod || []);

        setAppData({
          prodRows: prod || [],
          prodMap,
          stockMatriz: stockMatriz || [],
          stockRows: stockLab || [],
          movRows: normalizeMovRows(mov || []),
          defectRows: normalizeDefectRows(defeitos || [], lojasMap),
          lojasMap
        });
      } catch (e) {
        console.error("Load error", e);
      } finally {
        setDataLoading(false);
      }
    }
    init();
  }, []);

  if (authLoading || dataLoading) return <div>Loading...</div>;
  if (!user) return <Login />;

  const renderScreen = () => {
    switch (currentScreen) {
      case 'bi': return <KPIDashboard />;
      case 'analise': return <SistemaAnalise />;
      case 'compras': return <SistemaCompras />;
      case 'remanejamento': return <Remanejamento />;
      case 'logistica':
        return <LogisticsDashboard
          lojasMap={appData.lojasMap}
          stockRows={appData.stockRows}
          prodMap={appData.prodMap}
          movRows={appData.movRows}
          stockMatriz={appData.stockMatriz}
        />;
      case 'qualidade': return <QualityDashboard />;
      case 'users': return <UserManagement />;
      default: return <LogisticsDashboard />;
    }
  };

  return (
    <div className="page" data-theme={theme}>
      <div className="appShell">
        <Sidebar currentScreen={currentScreen} onNavigate={setCurrentScreen} user={user} theme={theme} toggleTheme={toggleTheme} />
        <main className="main"><Header title={currentScreen} />{renderScreen()}</main>
      </div>
    </div>
  );
}

export default function App() { return <AuthProvider><AppContent /></AuthProvider>; }