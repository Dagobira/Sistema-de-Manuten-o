import React, { useMemo, useState } from "react";

// ============================================
// ESTILOS MODERNOS - REDESIGN TECNOLÓGICO
// ============================================
const modernStyles = `
  /* ANIMAÇÕES */
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.05); }
  }
  
  @keyframes shimmer {
    0% { background-position: -1000px 0; }
    100% { background-position: 1000px 0; }
  }
  
  @keyframes slideInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 20px rgba(30, 136, 229, 0.3); }
    50% { box-shadow: 0 0 40px rgba(30, 136, 229, 0.6); }
  }

  /* CONTAINER PRINCIPAL */
  .logistics-container {
    display: flex;
    flex-direction: column;
    gap: 24px;
    animation: fadeIn 0.3s ease-out;
  }

  /* KPI CARDS SECTION */
  .kpi-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 20px;
    margin-bottom: 12px;
  }

  .stat-card {
    background: var(--panel);
    border-radius: 16px;
    padding: 24px;
    display: flex;
    align-items: center;
    gap: 20px;
    box-shadow: var(--shadow);
    border: 1px solid var(--border);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    animation: slideInUp 0.4s ease-out;
  }

  .stat-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
    transition: left 0.5s;
  }

  .stat-card:hover::before {
    left: 100%;
  }

  .stat-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(30, 136, 229, 0.15);
  }

  .stat-icon {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    flex-shrink: 0;
  }

  .stat-icon.blue {
    background: linear-gradient(135deg, #1E88E5 0%, #1565C0 100%);
    box-shadow: 0 8px 16px rgba(30, 136, 229, 0.3);
  }

  .stat-icon.orange {
    background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%);
    box-shadow: 0 8px 16px rgba(255, 152, 0, 0.3);
  }

  .stat-icon.green {
    background: linear-gradient(135deg, #43A047 0%, #2E7D32 100%);
    box-shadow: 0 8px 16px rgba(67, 160, 71, 0.3);
  }

  .stat-icon.red {
    background: linear-gradient(135deg, #E53935 0%, #C62828 100%);
    box-shadow: 0 8px 16px rgba(229, 57, 53, 0.3);
  }

  .stat-content {
    flex: 1;
  }

  .stat-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--textSec);
    margin-bottom: 6px;
  }

  .stat-value {
    font-size: 32px;
    font-weight: 700;
    color: var(--text);
    line-height: 1;
  }

  /* HEADER SECTION */
  .logistics-header {
    background: var(--panel);
    border-radius: 16px;
    padding: 28px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: var(--shadow);
    border: 1px solid var(--border);
    position: relative;
    overflow: hidden;
  }

  .logistics-header::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #1E88E5 0%, #43A047 100%);
  }

  .header-left {
    display: flex;
    gap: 20px;
    align-items: center;
  }

  .header-icon {
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, rgba(30, 136, 229, 0.1) 0%, rgba(67, 160, 71, 0.1) 100%);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
  }

  .header-title h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .header-subtitle {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    font-size: 14px;
    color: var(--textSec);
  }

  .today-badge {
    background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
    color: white;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 4px 12px rgba(30, 136, 229, 0.3);
  }

  /* TIMELINE */
  .timeline-container {
    background: var(--panel);
    border-radius: 16px;
    padding: 32px;
    box-shadow: var(--shadow);
    border: 1px solid var(--border);
  }

  .timeline-header {
    display: flex;
    justify-content: center;
    margin-bottom: 32px;
    position: relative;
  }

  .timeline-line {
    position: absolute;
    top: 20px;
    left: 10%;
    right: 10%;
    height: 3px;
    background: var(--border2);
    border-radius: 2px;
  }

  .timeline-days {
    display: flex;
    justify-content: space-around;
    width: 100%;
    position: relative;
    z-index: 1;
  }

  .timeline-day {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .day-indicator {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--panel);
    border: 3px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
    color: var(--textSec);
    transition: all 0.3s;
    position: relative;
  }

  .day-indicator.today {
    background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
    border-color: var(--primary);
    color: white;
    animation: pulse 2s infinite;
    box-shadow: 0 0 20px rgba(30, 136, 229, 0.5);
  }

  .day-indicator.has-deliveries {
    border-color: var(--accent);
  }

  .day-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--textSec);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .day-name.today {
    color: var(--primary);
  }

  .day-count {
    font-size: 11px;
    background: var(--border2);
    color: var(--text);
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 600;
  }

  /* CARDS GRID */
  .stores-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 20px;
    margin-top: 24px;
  }

  .day-column {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* STORE CARD - GLASSMORPHISM */
  .store-card {
    background: var(--panel);
    border-radius: 14px;
    padding: 18px;
    cursor: pointer;
    border: 1px solid var(--border);
    position: relative;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(10px);
  }

  [data-theme='dark'] .store-card {
    background: rgba(26, 31, 58, 0.6);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .store-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    opacity: 0;
    transition: opacity 0.3s;
  }

  .store-card:hover::before {
    opacity: 1;
  }

  .store-card:hover {
    transform: translateY(-6px) scale(1.02);
    box-shadow: 0 16px 40px rgba(30, 136, 229, 0.2);
    border-color: var(--accent);
  }

  .store-card.urgent {
    border-color: rgba(255, 59, 48, 0.3);
  }

  .store-card.urgent::after {
    content: '';
    position: absolute;
    top: -2px;
    right: -2px;
    width: 12px;
    height: 12px;
    background: #FF3B30;
    border-radius: 50%;
    animation: pulse 2s infinite;
    box-shadow: 0 0 10px #FF3B30;
  }

  .urgent-badge {
    position: absolute;
    top: -8px;
    right: -8px;
    background: linear-gradient(135deg, #FF3B30 0%, #C62828 100%);
    color: white;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    box-shadow: 0 4px 12px rgba(255, 59, 48, 0.4);
    animation: pulse 2s infinite;
    z-index: 2;
  }

  .store-name {
    font-weight: 600;
    font-size: 15px;
    color: var(--text);
    margin-bottom: 12px;
    line-height: 1.3;
  }

  .store-info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .uf-badge {
    background: var(--border2);
    color: var(--text);
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .pieces-count {
    font-size: 13px;
    font-weight: 700;
  }

  .pieces-count.urgent {
    color: #FF9500;
  }

  .pieces-count.ok {
    color: #34C759;
  }

  .arrival-info {
    background: linear-gradient(135deg, rgba(30, 136, 229, 0.1) 0%, rgba(67, 160, 71, 0.1) 100%);
    border-radius: 8px;
    padding: 8px;
    text-align: center;
    font-size: 12px;
    color: var(--text);
    font-weight: 600;
  }

  .empty-day {
    border: 2px dashed var(--border2);
    border-radius: 12px;
    padding: 30px 16px;
    text-align: center;
    color: var(--textSec);
    font-size: 13px;
    background: var(--bg);
  }

  /* MODAL */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(8px);
    animation: fadeIn 0.2s ease-out;
  }

  .modal-content {
    background: var(--panel);
    color: var(--text);
    width: 900px;
    max-width: 95%;
    max-height: 90vh;
    border-radius: 20px;
    box-shadow: 0 40px 80px rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .invoice-header {
    padding: 32px 40px;
    background: linear-gradient(135deg, rgba(30, 136, 229, 0.05) 0%, rgba(67, 160, 71, 0.05) 100%);
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .brand-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .doc-type {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--accent);
  }

  .store-name-modal {
    font-size: 28px;
    font-weight: 700;
    color: var(--text);
    margin: 0;
  }

  .store-meta {
    font-size: 14px;
    color: var(--textSec);
    font-weight: 500;
  }

  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    text-align: right;
  }

  .detail-group {
    display: flex;
    flex-direction: column;
  }

  .detail-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--textSec);
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .detail-value {
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
  }

  .modal-body {
    padding: 0;
    overflow-y: auto;
    background: var(--bg);
    flex-grow: 1;
  }

  .order-table {
    width: 100%;
    border-collapse: collapse;
  }

  .order-table th {
    background: var(--table-header-bg);
    color: var(--textSec);
    text-align: left;
    padding: 16px 24px;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.5px;
    border-bottom: 2px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .order-table td {
    padding: 14px 24px;
    border-bottom: 1px solid var(--border2);
    color: var(--text);
    font-size: 13px;
  }

  .order-table tr:hover {
    background: var(--border2);
  }

  .sku-badge {
    font-family: 'Courier New', monospace;
    background: var(--border2);
    color: var(--textSec);
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
  }

  .qty-badge {
    font-weight: 700;
    color: white;
    background: linear-gradient(135deg, var(--accent) 0%, var(--secondary) 100%);
    border-radius: 8px;
    padding: 6px 14px;
    display: inline-block;
    font-size: 13px;
    box-shadow: 0 4px 12px rgba(30, 136, 229, 0.3);
  }

  .modal-footer {
    padding: 24px 40px;
    border-top: 1px solid var(--border);
    background: var(--panel);
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    font-size: 14px;
    font-weight: 600;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    outline: none;
  }

  .btn:active {
    transform: translateY(1px);
  }

  .btn-secondary {
    background: var(--bg);
    border: 2px solid var(--border);
    color: var(--text);
  }

  .btn-secondary:hover {
    background: var(--border2);
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(30, 136, 229, 0.3);
  }

  .btn-primary:hover {
    box-shadow: 0 6px 16px rgba(30, 136, 229, 0.4);
    transform: translateY(-2px);
  }

  .empty-state {
    text-align: center;
    padding: 80px 20px;
    color: var(--textSec);
  }

  .empty-state-icon {
    font-size: 64px;
    margin-bottom: 20px;
    opacity: 0.5;
  }

  .empty-state-title {
    font-size: 20px;
    color: var(--text);
    font-weight: 600;
    margin-bottom: 8px;
  }

  .empty-state-text {
    font-size: 14px;
    margin: 0;
  }

  /* PRINT STYLES */
  @media print {
    @page {
      size: A4;
      margin: 15mm;
    }

    body * {
      visibility: hidden;
    }

    .modal-overlay {
      position: static;
      display: block;
      background: none;
    }

    .modal-content,
    .modal-content * {
      visibility: visible;
    }

    .modal-content {
      position: relative;
      width: 100% !important;
      max-width: 100% !important;
      box-shadow: none;
      border: none;
      background: white !important;
      color: black !important;
    }

    .modal-footer {
      display: none;
    }

    .order-table th {
      background: #f0f0f0 !important;
      color: #000 !important;
    }

    .order-table td {
      color: #000 !important;
    }
  }

  /* RESPONSIVE */
  @media (max-width: 1200px) {
    .stores-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 768px) {
    .stores-grid {
      grid-template-columns: 1fr;
    }

    .kpi-stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
`;

export default function LogisticsDashboard({ lojasMap, stockRows }) {
  const [selectedLoja, setSelectedLoja] = useState(null);

  if (!lojasMap || lojasMap.size === 0) {
    return (
      <div className="card" style={{ padding: "40px", textAlign: "center", color: "var(--textSec)" }}>
        Carregando logística...
      </div>
    );
  }

  const todayDate = new Date();
  const daysOfWeek = ["Domingo", "Segunda-Feira", "Terça-Feira", "Quarta-Feira", "Quinta-Feira", "Sexta-Feira", "Sábado"];
  const todayName = daysOfWeek[todayDate.getDay()];

  const superClean = (str) => {
    return String(str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  };

  const getPrevisao = (leadTime) => {
    let daysToAdd = parseInt(leadTime) || 1;
    let date = new Date();
    let daysAdded = 0;
    while (daysAdded < daysToAdd) {
      date.setDate(date.getDate() + 1);
      if (date.getDay() !== 0 && date.getDay() !== 6) daysAdded++;
    }
    return date.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' });
  };

  const agenda = useMemo(() => {
    const grid = { "Segunda-Feira": [], "Terça-Feira": [], "Quarta-Feira": [], "Quinta-Feira": [], "Sexta-Feira": [] };

    lojasMap.forEach((loja, key) => {
      let dia = loja.diasAtendimento?.trim();
      if (!dia) return;

      if (dia.match(/Segunda/i)) dia = "Segunda-Feira";
      else if (dia.match(/Terça|Terca/i)) dia = "Terça-Feira";
      else if (dia.match(/Quarta/i)) dia = "Quarta-Feira";
      else if (dia.match(/Quinta/i)) dia = "Quinta-Feira";
      else if (dia.match(/Sexta/i)) dia = "Sexta-Feira";
      else return;

      const targetLabClean = superClean(key);
      const storeItems = stockRows.filter(r => {
        const rowLabClean = superClean(r.Laboratorio);
        return rowLabClean === targetLabClean || rowLabClean.includes(targetLabClean) || targetLabClean.includes(rowLabClean);
      });

      const itemsToSend = storeItems
        .filter(r => r.ReposicaoSugeridaBruta > 0)
        .sort((a, b) => b.ReposicaoSugeridaBruta - a.ReposicaoSugeridaBruta);

      const totalPecas = itemsToSend.reduce((acc, curr) => acc + curr.ReposicaoSugeridaBruta, 0);

      if (grid[dia]) {
        grid[dia].push({
          ...loja, labKey: key, chegada: getPrevisao(loja.tempoEntrega),
          urgent: totalPecas > 0, itemsCount: totalPecas, items: itemsToSend
        });
      }
    });
    return grid;
  }, [lojasMap, stockRows]);

  // Calcular KPIs
  const stats = useMemo(() => {
    let totalEnvios = 0;
    let totalPecas = 0;
    let lojasPendentes = 0;
    let urgentes = 0;

    Object.values(agenda).forEach(day => {
      day.forEach(loja => {
        totalEnvios++;
        totalPecas += loja.itemsCount;
        if (loja.urgent) {
          lojasPendentes++;
          if (loja.itemsCount > 100) urgentes++;
        }
      });
    });

    const taxaUrgencia = totalEnvios > 0 ? Math.round((urgentes / totalEnvios) * 100) : 0;

    return { totalEnvios, totalPecas, lojasPendentes, taxaUrgencia };
  }, [agenda]);

  const getOrderId = (loja) => {
    const d = new Date();
    const dateStr = `${d.getDate()}${d.getMonth() + 1}`;
    return `REQ-${dateStr}-${loja.id || '00'}`;
  };

  const weekDays = ["Segunda-Feira", "Terça-Feira", "Quarta-Feira", "Quinta-Feira", "Sexta-Feira"];

  return (
    <>
      <style>{modernStyles}</style>

      <div className="logistics-container">
        {/* KPI CARDS */}
        <div className="kpi-stats-grid">
          <div className="stat-card" style={{ animationDelay: '0s' }}>
            <div className="stat-icon blue">🚚</div>
            <div className="stat-content">
              <div className="stat-label">Total Envios</div>
              <div className="stat-value">{stats.totalEnvios}</div>
            </div>
          </div>

          <div className="stat-card" style={{ animationDelay: '0.1s' }}>
            <div className="stat-icon orange">📦</div>
            <div className="stat-content">
              <div className="stat-label">Peças Total</div>
              <div className="stat-value">{stats.totalPecas}</div>
            </div>
          </div>

          <div className="stat-card" style={{ animationDelay: '0.2s' }}>
            <div className="stat-icon green">⚡</div>
            <div className="stat-content">
              <div className="stat-label">Pendentes</div>
              <div className="stat-value">{stats.lojasPendentes}</div>
            </div>
          </div>

          <div className="stat-card" style={{ animationDelay: '0.3s' }}>
            <div className="stat-icon red">📈</div>
            <div className="stat-content">
              <div className="stat-label">Taxa Urgência</div>
              <div className="stat-value">{stats.taxaUrgencia}%</div>
            </div>
          </div>
        </div>

        {/* HEADER */}
        <div className="logistics-header">
          <div className="header-left">
            <div className="header-icon">🗓️</div>
            <div className="header-title">
              <h2>Agenda Semanal de Envios</h2>
              <div className="header-subtitle">
                <span>Hoje é</span>
                <strong>{todayName}</strong>
              </div>
            </div>
          </div>
          <div className="today-badge">
            <span>🎯</span>
            {agenda[todayName]?.length || 0} Envios Hoje
          </div>
        </div>

        {/* TIMELINE */}
        <div className="timeline-container">
          <div className="timeline-header">
            <div className="timeline-line"></div>
            <div className="timeline-days">
              {weekDays.map((dia, index) => {
                const isToday = dia === todayName;
                const count = agenda[dia].length;
                return (
                  <div key={dia} className="timeline-day">
                    <div className={`day-indicator ${isToday ? 'today' : ''} ${count > 0 ? 'has-deliveries' : ''}`}>
                      {index + 1}
                    </div>
                    <div className={`day-name ${isToday ? 'today' : ''}`}>
                      {dia.replace("-Feira", "")}
                    </div>
                    {count > 0 && <div className="day-count">{count}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* STORES GRID */}
          <div className="stores-grid">
            {weekDays.map(dia => (
              <div key={dia} className="day-column">
                {agenda[dia].map(loja => (
                  <div
                    key={loja.id}
                    className={`store-card ${loja.urgent ? 'urgent' : ''}`}
                    onClick={() => setSelectedLoja(loja)}
                  >
                    {loja.urgent && <div className="urgent-badge">!</div>}

                    <div className="store-name">{loja.nomeFantasia}</div>

                    <div className="store-info-row">
                      <span className="uf-badge">{loja.uf}</span>
                      <span className={`pieces-count ${loja.urgent ? 'urgent' : 'ok'}`}>
                        {loja.urgent ? `${loja.itemsCount} pçs` : 'OK'}
                      </span>
                    </div>

                    <div className="arrival-info">
                      ⏱️ Chega {loja.chegada}
                    </div>
                  </div>
                ))}

                {agenda[dia].length === 0 && (
                  <div className="empty-day">
                    📭<br />Sem envios
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL */}
      {selectedLoja && (
        <div className="modal-overlay" onClick={() => setSelectedLoja(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>

            <div className="invoice-header">
              <div className="brand-section">
                <span className="doc-type">Ordem de Separação</span>
                <h1 className="store-name-modal">{selectedLoja.nomeFantasia}</h1>
                <span className="store-meta">Destino: {selectedLoja.uf} • Logística</span>
              </div>
              <div className="details-grid">
                <div className="detail-group">
                  <span className="detail-label">ID Pedido</span>
                  <span className="detail-value">{getOrderId(selectedLoja)}</span>
                </div>
                <div className="detail-group">
                  <span className="detail-label">Data Emissão</span>
                  <span className="detail-value">{new Date().toLocaleDateString()}</span>
                </div>
                <div className="detail-group">
                  <span className="detail-label">Previsão</span>
                  <span className="detail-value">{selectedLoja.chegada}</span>
                </div>
              </div>
            </div>

            <div className="modal-body">
              {selectedLoja.items && selectedLoja.items.length > 0 ? (
                <table className="order-table">
                  <thead>
                    <tr>
                      <th style={{ width: "15%" }}>SKU</th>
                      <th style={{ width: "50%" }}>Produto</th>
                      <th style={{ width: "20%" }}>Categoria</th>
                      <th style={{ width: "15%", textAlign: "center" }}>Qtd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedLoja.items.map((item, idx) => (
                      <tr key={idx}>
                        <td><span className="sku-badge">{item.SKU}</span></td>
                        <td style={{ fontWeight: "500" }}>{item.Descricao}</td>
                        <td style={{ color: "var(--textSec)", fontSize: "12px" }}>{item.Categoria}</td>
                        <td style={{ textAlign: "center" }}>
                          <span className="qty-badge">{item.ReposicaoSugeridaBruta}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">✅</div>
                  <div className="empty-state-title">Estoque Regularizado</div>
                  <p className="empty-state-text">Esta loja não precisa de reposição hoje.</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedLoja(null)}>
                Fechar
              </button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                🖨️ Imprimir Ordem
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}