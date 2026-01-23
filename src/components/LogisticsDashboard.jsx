import React, { useMemo, useState } from "react";

// --- ESTILOS CSS V6 (MODERNIZAÇÃO & CORREÇÃO DE IMPRESSÃO) ---
const modalStyles = `
  /* ESTILOS DE TELA (SCREEN) */
  .modal-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.4); z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(8px);
    animation: fadeIn 0.2s ease-out;
  }
  .modal-content {
    background: var(--panelSolid); color: var(--text);
    width: 850px; 
    max-width: 95%; max-height: 90vh;
    border-radius: var(--radius); 
    box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border);
    display: flex; 
    flex-direction: column;
    overflow: hidden;
    font-family: inherit;
  }
  
  .invoice-header {
    padding: 30px 40px; background: var(--panelSolid); border-bottom: 1px solid var(--border);
    display: flex; justify-content: space-between; align-items: flex-start; flex-shrink: 0;
  }
  .brand-section { display: flex; flex-direction: column; gap: 4px; }
  .doc-type { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--accent); }
  .store-name { font-size: 28px; font-weight: 700; color: var(--text); letter-spacing: -0.5px; line-height: 1.1; margin: 0; }
  .store-meta { font-size: 14px; color: var(--textSec); font-weight: 500; margin-top: 4px; }

  .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; text-align: right; }
  .detail-group { display: flex; flex-direction: column; }
  .detail-label { font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--textSec); letter-spacing: 0.5px; margin-bottom: 2px; }
  .detail-value { font-size: 14px; font-weight: 500; color: var(--text); }

  .modal-body {
    padding: 0; overflow-y: auto; background: var(--bg); flex-grow: 1;
  }

  .order-table { width: 100%; border-collapse: collapse; }
  .order-table th { 
    background: var(--table-header-bg); color: var(--textSec); text-align: left; padding: 14px 20px; 
    font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;
    border-bottom: 1px solid var(--border); position: sticky; top: 0;
  }
  .order-table th:first-child { padding-left: 40px; }
  .order-table td { padding: 12px 20px; border-bottom: 1px solid var(--border2); color: var(--text); vertical-align: middle; font-size: 13px; }
  .order-table td:first-child { padding-left: 40px; }
  .order-table tr:hover { background: var(--border2); }
  
  .sku-badge { font-family: monospace; background: var(--border2); color: var(--textSec); padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: 500; }
  .qty-badge { font-weight: 600; color: #fff; background: var(--accent); border-radius: 4px; padding: 4px 12px; display: inline-block; font-size: 12px; }

  .modal-footer {
    padding: 20px 40px; border-top: 1px solid var(--border); background: var(--panelSolid);
    display: flex; justify-content: flex-end; gap: 12px; flex-shrink: 0;
  }
  
  .btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; font-size: 13px; font-weight: 500; border-radius: 8px; cursor: pointer; transition: all 0.15s ease; border: 1px solid transparent; outline: none; }
  .btn:active { transform: translateY(1px); }
  .btn-secondary { background: var(--bg); border: 1px solid var(--border); color: var(--text); }
  .btn-secondary:hover { background: var(--border2); }
  .btn-primary { background: var(--text); color: var(--bg); border: 1px solid var(--text); }
  .btn-primary:hover { opacity: 0.9; }

  @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }

  /* --- MODO DE IMPRESSÃO --- */
  @media print {
    @page { size: A4; margin: 15mm; }
    
    body * { visibility: hidden; } 
    
    .modal-overlay { 
      position: static; display: block; background: none; 
      width: 100%; height: auto; overflow: visible;
    }
    
    .modal-content, .modal-content * { visibility: visible; }
    .modal-content {
      position: relative; left: 0; top: 0; 
      width: 100% !important; max-width: 100% !important;
      height: auto !important; max-height: none !important;
      overflow: visible !important; 
      box-shadow: none; border: none; border-radius: 0;
      margin: 0; padding: 0;
      display: block; background: #fff !important; color: #000 !important;
    }

    .modal-body { overflow: visible !important; height: auto !important; background: #fff !important; }
    .modal-footer { display: none; } 
    .no-print { display: none !important; }

    .order-table { width: 100%; }
    .order-table thead { display: table-header-group; } 
    .order-table tr { page-break-inside: avoid; }
    .order-table th { background: #f0f0f0 !important; color: #000 !important; border-bottom: 1px solid #000; }
    .order-table td { border-bottom: 1px solid #ddd; color: #000 !important; }
    
    .print-footer {
      display: flex !important; margin-top: 40px; padding: 0 40px;
      justify-content: space-between; page-break-inside: avoid;
    }
    .sign-box {
      border-top: 1px solid #000; width: 40%; padding-top: 8px;
      text-align: center; font-size: 11px; text-transform: uppercase;
    }
    .qty-badge { color: #000 !important; background: #eee !important; border: 1px solid #999; }
  }
  .print-footer { display: none; }
`;

export default function LogisticsDashboard({ lojasMap, stockRows }) {
  const [selectedLoja, setSelectedLoja] = useState(null);

  if (!lojasMap || lojasMap.size === 0) return <div className="card" style={{padding:"40px", textAlign: "center", color: "var(--textSec)"}}>Carregando logística...</div>;

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

  const getOrderId = (loja) => {
    const d = new Date();
    const dateStr = `${d.getDate()}${d.getMonth()+1}`;
    return `REQ-${dateStr}-${loja.id || '00'}`;
  }

  return (
    <>
      <style>{modalStyles}</style>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* HEADER */}
        <div className="card" style={{ padding: "24px 30px", display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: "4px solid var(--accent)" }}>
          <div style={{display: "flex", gap: "16px", alignItems: "center"}}>
            <div style={{width: "48px", height: "48px", background: "var(--border2)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px"}}>
              🚚
            </div>
            <div>
               <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Agenda Semanal de Envios</h2>
               <div style={{display: "flex", alignItems: "center", gap: "6px", marginTop: "4px"}}>
                 <span style={{fontSize: "13px", color: "var(--textSec)"}}>Hoje é</span>
                 <span style={{fontSize: "13px", fontWeight: "600", color: "var(--text)"}}>{todayName}</span>
               </div>
            </div>
          </div>
          <div className="chip" style={{background: "var(--accent)", color: "#fff", padding: "8px 16px", fontSize: "14px", height: "auto"}}>
            {agenda[todayName]?.length || 0} Envios Hoje
          </div>
        </div>

        {/* CALENDAR GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px", alignItems: "start" }}>
          {Object.keys(agenda).map((dia) => {
             const isToday = dia === todayName;
             return (
              <div key={dia} style={{ display: "flex", flexDirection: "column", gap: "12px", opacity: (isToday || agenda[dia].length > 0) ? 1 : 0.5, transition: "opacity 0.2s" }}>
                
                <div style={{ 
                  padding: "10px", 
                  textAlign: "center", 
                  borderRadius: "8px",
                  background: isToday ? "var(--text)" : "transparent",
                  color: isToday ? "var(--bg)" : "var(--textSec)",
                  fontWeight: "600", fontSize: "13px", letterSpacing: "0.02em"
                }}>
                  {dia.replace("-Feira", "")}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {agenda[dia].map(loja => (
                    <div key={loja.id} onClick={() => setSelectedLoja(loja)}
                      className="card"
                      style={{ 
                        padding: "16px", cursor: "pointer", 
                        border: "1px solid var(--border)",
                        boxShadow: "var(--shadow)",
                        position: "relative", overflow: "visible",
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 24px -8px rgba(0,0,0,0.15)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "var(--shadow)"; }}
                    >
                      {loja.urgent && (
                        <div style={{
                          position: "absolute", top: "-6px", right: "-6px", 
                          background: "#ff9500", color: "#fff", 
                          width: "20px", height: "20px", borderRadius: "50%", 
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "10px", boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                        }}>!</div>
                      )}
                      
                      <div style={{ fontWeight: "600", fontSize: "14px", color: "var(--text)", marginBottom: "4px" }}>
                        {loja.nomeFantasia}
                      </div>
                      
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
                        <span className="chip" style={{fontSize:"10px", height: "20px", padding: "0 8px"}}>{loja.uf}</span>
                        {loja.urgent ? 
                          <span style={{fontSize:"11px", color: "#ff9500", fontWeight: "700"}}>{loja.itemsCount} pçs</span> : 
                          <span style={{fontSize:"11px", color: "#34c759", fontWeight: "600"}}>OK</span>
                        }
                      </div>
                      
                      <div style={{fontSize:"11px", color:"var(--textSec)", marginTop:"10px", padding:"6px", background:"var(--bg)", borderRadius:"6px", textAlign:"center"}}>
                        Chega {loja.chegada}
                      </div>
                    </div>
                  ))}
                  {agenda[dia].length === 0 && (
                    <div style={{
                      border: "2px dashed var(--border2)", borderRadius: "12px", 
                      padding: "20px", textAlign: "center", color: "var(--textSec)", fontSize: "12px"
                    }}>
                      Sem envios
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedLoja && (
        <div className="modal-overlay" onClick={() => setSelectedLoja(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            
            <div className="invoice-header">
              <div className="brand-section">
                <span className="doc-type">Ordem de Separação</span>
                <h1 className="store-name">{selectedLoja.nomeFantasia}</h1>
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
                      <th style={{width: "15%"}}>SKU</th>
                      <th style={{width: "50%"}}>Produto</th>
                      <th style={{width: "20%"}}>Categoria</th>
                      <th style={{width: "15%", textAlign: "center"}}>Qtd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedLoja.items.map((item, idx) => (
                      <tr key={idx}>
                        <td><span className="sku-badge">{item.SKU}</span></td>
                        <td style={{fontWeight: "500"}}>{item.Descricao}</td>
                        <td style={{color: "var(--textSec)", fontSize: "12px"}}>{item.Categoria}</td>
                        <td style={{textAlign: "center"}}>
                          <span className="qty-badge">{item.ReposicaoSugeridaBruta}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--textSec)" }}>
                  <div style={{fontSize: "48px", marginBottom: "16px", opacity: 0.5}}>✅</div>
                  <strong style={{fontSize: "18px", color: "var(--text)"}}>Estoque Regularizado</strong>
                  <p style={{margin: "8px 0 0 0", fontSize: "14px"}}>Esta loja não precisa de reposição hoje.</p>
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

            <div className="print-footer">
               <div className="sign-box">Assinatura Expedição</div>
               <div className="sign-box">Assinatura Conferência (Loja)</div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}