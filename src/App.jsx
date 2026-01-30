import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { loadCSV } from './lib/csv';
import { buildLojasMap, normalizeDefectRows, buildProductMap } from './lib/engine';

// Importação dos Componentes
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './components/Login';
import UserManagement from './components/UserManagement';

// Telas do Sistema
import KPIDashboard from './components/KPIDashboard';
import SistemaCompras from './components/SistemaCompras';
import SistemaAnalise from './components/SistemaAnalise'; // Agora existe!
import Remanejamento from './components/Remanejamento';
import LogisticsDashboard from './components/LogisticsDashboard';
import QualityDashboard from './components/QualityDashboard'; // Faltava na lista do user

import './App.css'; // Importante para os estilos globais

// --- COMPONENTE INTERNO (Lógica do App) ---
function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState('analise'); // Default para primeira tela útil

  // Estado dos Dados
  const [dataLoading, setDataLoading] = useState(true);
  const [appData, setAppData] = useState({
    prod: [],
    mov: [],
    stockLab: [],
    stockMatriz: [],
    defectRows: [],
    lojasMap: new Map(),
    prodMap: new Map(), // Opcional, mas útil
  });

  // 1. CARREGAMENTO DE DADOS (Executa uma vez ao iniciar)
  useEffect(() => {
    async function loadAllData() {
      try {
        console.log("Iniciando carregamento de dados...");
        const [prod, mov, stockLab, stockMatriz, defeitos, lojas] = await Promise.all([
          loadCSV('/data/stg_produto.csv'),
          loadCSV('/data/stg_lab_mov_mensal.csv'),
          loadCSV('/data/stg_estoque_lab.csv'),
          loadCSV('/data/stg_estoque_matriz.csv'), // ADICIONADO: Necessário para analise
          loadCSV('/data/stg_defeitos.csv'),       // ADICIONADO: Necessário para qualidade
          loadCSV('/data/stg_lojas.csv')
        ]);

        console.log("Dados CSV carregados. Processando mapas...");

        // Processamento básico para passar às telas
        const lojasMap = buildLojasMap(lojas);
        const prodMap = buildProductMap(prod); // Útil para qualidade
        const defectRows = normalizeDefectRows(defeitos, lojasMap);

        setAppData({
          prod,
          mov,
          stockLab,
          stockMatriz,
          lojasMap,
          defectRows,
          prodMap
        });

      } catch (error) {
        console.error("Erro fatal ao carregar dados:", error);
      } finally {
        setDataLoading(false);
      }
    }

    // Carrega dados independente do login para deixar pronto
    loadAllData();
  }, []);

  // 2. TELA DE CARREGAMENTO (Enquanto verifica user ou baixa CSV)
  if (authLoading || dataLoading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#f8fafc', color: '#64748b', fontFamily: 'sans-serif'
      }}>
        <div style={{ fontSize: '40px', marginBottom: '20px' }} className="spin">🔄</div>
        <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>Carregando Sistema...</div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
      </div>
    );
  }

  // 3. SE NÃO TIVER USUÁRIO -> TELA DE LOGIN
  if (!user) {
    return <Login />;
  }

  // Helper de permissão
  const checkPerm = (permKey) => {
    if (user.role === 'super_admin') return true;

    // Mapping camelCase to snake_case
    const map = {
      'viewDashboard': 'view_bi', // Mapeando Dashboard para BI se necessário
      'viewAnalise': 'view_analise',
      'viewLogistica': 'view_logistica',
      'viewRemanejamento': 'view_remanejamento',
      'viewCompras': 'view_compras',
      'viewBi': 'view_bi',
      'viewQualidade': 'view_qualidade'
    };
    const legacyKey = map[permKey] || permKey;

    if (Array.isArray(user.permissions)) {
      return user.permissions.includes(legacyKey) || user.permissions.includes(permKey);
    }
    return user.permissions?.[permKey];
  };

  // 4. ROTEAMENTO DE TELAS
  const renderScreen = () => {
    switch (currentScreen) {
      case 'bi':
      case 'dashboard':
        return checkPerm('viewBi') ? <KPIDashboard /> : <AccessDenied />;

      case 'analise':
        return checkPerm('viewAnalise') ?
          <SistemaAnalise rawData={{
            prod: appData.prod,
            mov: appData.mov,
            stockLab: appData.stockLab,
            stockMatriz: appData.stockMatriz
          }} />
          : <AccessDenied />;

      case 'compras':
        return checkPerm('viewCompras') ? <SistemaCompras /> : <AccessDenied />;

      case 'remanejamento':
        return checkPerm('viewRemanejamento') ? <Remanejamento /> : <AccessDenied />;

      case 'logistica':
        return checkPerm('viewLogistica') ?
          <LogisticsDashboard lojasMap={appData.lojasMap} stockRows={appData.stockLab} /> // Enviando stockLab como stockRows
          : <AccessDenied />;

      case 'qualidade':
        return checkPerm('viewQualidade') ?
          <QualityDashboard defects={appData.defectRows} prodMap={appData.prodMap} filters={{}} />
          : <AccessDenied />;

      case 'admin_users':
      case 'users':
        return user.role === 'super_admin' ? <UserManagement /> : <AccessDenied />;

      default:
        return <KPIDashboard />;
    }
  };

  return (
    <div className="app-container" data-theme="light">
      <Sidebar
        currentScreen={currentScreen}
        onNavigate={setCurrentScreen}
        user={user}
      />
      <div className="main-content">
        <Header title={currentScreen.toUpperCase()} />
        <div className="screen-wrapper">
          {renderScreen()}
        </div>
      </div>
    </div>
  );
}

// Sub-componente simples para Acesso Negado
function AccessDenied() {
  return (
    <div className="access-denied-box">
      <div style={{ fontSize: '4rem', marginBottom: '10px' }}>⛔</div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Acesso Negado</h2>
      <p>Você não tem permissão para visualizar este módulo.</p>
    </div>
  );
}

// --- COMPONENTE PRINCIPAL (WRAPPER) ---
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}