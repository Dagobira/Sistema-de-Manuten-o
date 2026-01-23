import React, { useMemo } from "react";

export default function QualityDashboard({ defects, prodMap, filters }) {
  // 1. FILTRAGEM DOS DADOS
  const filteredData = useMemo(() => {
    return defects.filter(row => {
      if (filters.mesInicio && row.Data < filters.mesInicio) return false;
      if (filters.mesFim && row.Data > filters.mesFim) return false;
      if (filters.labs && filters.labs.length > 0 && !filters.labs.includes(row.Laboratorio)) return false;
      if (filters.categorias && filters.categorias.length > 0) {
        const prod = prodMap.get(String(row.SKU));
        if (!prod || !filters.categorias.includes(prod.categoria)) return false;
      }
      return true;
    });
  }, [defects, filters, prodMap]);

  // 2. CÁLCULOS ESTATÍSTICOS
  const stats = useMemo(() => {
    let totalQtd = 0;
    let totalCusto = 0;
    const byTecnico = {};
    const byMotivo = {};
    const byLab = {};

    filteredData.forEach(item => {
      const qtd = item.Qtd || 0;
      const prod = prodMap.get(String(item.SKU));
      const custo = (prod?.preco || 0) * qtd;

      totalQtd += qtd;
      totalCusto += custo;

      const tec = item.Tecnico || "Não Identificado";
      if (!byTecnico[tec]) byTecnico[tec] = { nome: tec, qtd: 0, custo: 0 };
      byTecnico[tec].qtd += qtd;
      byTecnico[tec].custo += custo;

      const mot = item.Motivo || "Outros";
      if (!byMotivo[mot]) byMotivo[mot] = 0;
      byMotivo[mot] += qtd;

      const lab = item.Laboratorio || "N/A";
      if (!byLab[lab]) byLab[lab] = 0;
      byLab[lab] += qtd;
    });

    const topTecnicos = Object.values(byTecnico).sort((a, b) => b.qtd - a.qtd).slice(0, 10);
    const topMotivos = Object.entries(byMotivo).map(([k, v]) => ({ nome: k, valor: v })).sort((a, b) => b.valor - a.valor);
    const topLabs = Object.entries(byLab).map(([k, v]) => ({ nome: k, valor: v })).sort((a, b) => b.valor - a.valor).slice(0, 10);

    return { totalQtd, totalCusto, topTecnicos, topMotivos, topLabs };
  }, [filteredData, prodMap]);

  const fmtMoney = (n) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="kpiGrid">
        <div className="kpiCard kpi-blue active">
          <div className="kpiTitle">Total Peças com Defeito</div>
          <div className="kpiValue">{stats.totalQtd}</div>
        </div>
        <div className="kpiCard kpi-red">
          <div className="kpiTitle">Custo Total (Perda)</div>
          <div className="kpiValue" style={{color: "#ef4444"}}>{fmtMoney(stats.totalCusto)}</div>
        </div>
        <div className="kpiCard kpi-purple">
          <div className="kpiTitle">Principal Motivo</div>
          <div className="kpiValue" style={{fontSize: "16px"}}>{stats.topMotivos[0]?.nome || "-"}<span style={{fontSize: "12px", marginLeft: "6px"}}>({stats.topMotivos[0]?.valor || 0})</span></div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "16px" }}>
        <div className="card" style={{ padding: "20px" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", color: "var(--text)" }}>Top 10 Técnicos</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {stats.topTecnicos.map((tec, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px" }}>
                <div style={{ width: "20px", fontWeight: "bold" }}>#{i+1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontWeight: "600" }}>{tec.nome}</span>
                    <span><strong>{tec.qtd}</strong> <span style={{fontSize:"10px"}}>({fmtMoney(tec.custo)})</span></span>
                  </div>
                  <div style={{ width: "100%", height: "6px", background: "var(--border2)", borderRadius: "3px" }}>
                    <div style={{ width: `${(tec.qtd / stats.topTecnicos[0].qtd) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: "3px" }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: "20px" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", color: "var(--text)" }}>Motivos</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {stats.topMotivos.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", borderBottom: "1px solid var(--border2)", paddingBottom: "6px" }}>
                <span>{m.nome}</span><strong>{m.valor}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}