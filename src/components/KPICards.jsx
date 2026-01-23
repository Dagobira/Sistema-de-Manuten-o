import React, { useMemo } from "react";

export default function KPICards({ rows, activeFilter, onCardClick }) {
  // Calculando os totais com base nas linhas atuais
  const stats = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        // Críticos: Cobertura < 1 e tem Estoque Alvo
        if ((r.CoberturaMeses || 0) < 1 && (r.EstoqueAlvo || 0) > 0) acc.criticos++;

        // Reposição Sugerida
        if ((r.ReposicaoSugeridaBruta || 0) > 0) acc.sugerida++;

        // Possível Matriz
        if ((r.ReposicaoPossivelMatriz || 0) > 0) acc.matriz++;

        // Pendente (Sugerida - Matriz)
        if ((r.ReposicaoPendente || 0) > 0) acc.pendente++;

        // Devolução
        if ((r.DevolverSugerido || 0) > 0) acc.devolucao++;

        // Sem Giro (Verificando string do Status)
        const st = String(r.Status || "").toLowerCase();
        if (st.includes("6m")) acc.semGiro6++;
        if (st.includes("12m")) acc.semGiro12++;

        return acc;
      },
      { criticos: 0, sugerida: 0, matriz: 0, pendente: 0, devolucao: 0, semGiro6: 0, semGiro12: 0 }
    );
  }, [rows]);

  // Lista de cartões para renderizar
  const cards = [
    { id: "critico", label: "SKUs Críticos (< 1 mês)", val: stats.criticos, color: "red" },
    { id: "sugerida", label: "Reposição Sugerida", val: stats.sugerida, color: "blue" },
    { id: "matriz", label: "Reposição Matriz", val: stats.matriz, color: "green" },
    { id: "pendente", label: "Reposição Pendente", val: stats.pendente, color: "orange" },
    { id: "devolucao", label: "Devolução Sugerida", val: stats.devolucao, color: "purple" },
    { id: "semGiro6", label: "Sem Giro 6m", val: stats.semGiro6, color: "gray" },
    { id: "semGiro12", label: "Sem Giro 12m", val: stats.semGiro12, color: "dark" },
  ];

  return (
    <div className="kpiGrid">
      {cards.map((c) => {
        const isActive = activeFilter === c.id;
        return (
          <div
            key={c.id}
            className={`kpiCard ${isActive ? "active" : ""} kpi-${c.color}`}
            onClick={() => onCardClick(isActive ? null : c.id)}
            style={{ cursor: 'pointer' }}
          >
            <div className="kpiTitle">{c.label}</div>
            <div className="kpiValue">{c.val}</div>
          </div>
        );
      })}
    </div>
  );
}