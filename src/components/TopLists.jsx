import React, { useMemo } from "react";

export default function TopLists({ rows }) {
  // Função auxiliar para pegar o Top 15 de qualquer campo
  const getTop15 = (field) => {
    return [...rows]
      .filter((r) => (r[field] || 0) > 0)
      .sort((a, b) => b[field] - a[field])
      .slice(0, 15);
  };

  // Gerando as listas
  const topReposicao = useMemo(() => getTop15("ReposicaoSugeridaBruta"), [rows]);
  const topDevolucao = useMemo(() => getTop15("DevolverSugerido"), [rows]);
  const topVendas = useMemo(() => getTop15("Vendas"), [rows]);
  const topOutras = useMemo(() => getTop15("OutrasSaidas"), [rows]);

  const fmt = (n) => new Intl.NumberFormat("pt-BR").format(n);

  // Componente Visual da Mini Tabela
  const MiniTable = ({ title, data, valueField, color }) => (
    <div className="card" style={{height: "350px", display: "flex", flexDirection: "column"}}>
      {/* Título fixo */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border2)", background: "var(--panelSolid)" }}>
        <h3 style={{margin:0, fontSize:"13px", fontWeight: "600", color: "var(--text)", textTransform: "uppercase"}}>{title}</h3>
      </div>
      
      {/* Corpo com rolagem */}
      <div style={{flex:1, overflowY:"auto", background: "var(--panelSolid)"}}>
        <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
          <thead style={{position: "sticky", top: 0, background: "var(--table-header-bg)", zIndex: 5}}>
            <tr style={{ textAlign: "left", color: "var(--textSec)" }}>
              <th style={{ padding: "8px 16px", fontWeight: "600" }}>Lab</th>
              <th style={{ padding: "8px 4px", fontWeight: "600" }}>Produto</th>
              <th style={{ padding: "8px 16px", textAlign: "right", fontWeight: "600" }}>Qtd</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border2)" }}>
                <td style={{ padding: "8px 16px", color: "var(--textSec)", width: "30%" }}>{r.Laboratorio}</td>
                <td style={{ padding: "8px 4px", color: "var(--text)", width: "50%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "150px" }} title={r.Descricao}>
                  {r.Descricao}
                </td>
                <td style={{ padding: "8px 16px", textAlign: "right", fontWeight: "bold", color: color, width: "20%" }}>
                  {fmt(r[valueField])}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan="3" style={{ padding: "20px", textAlign: "center", color: "var(--textSec)" }}>Nenhum item encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="topListsGrid">
      {/* LINHA 1: Vendas e Outras Saídas */}
      <MiniTable title="Top 15 Mais Vendidos" data={topVendas} valueField="Vendas" color="#10b981" />
      <MiniTable title="Top 15 Outras Saídas (Defeito/Perda)" data={topOutras} valueField="OutrasSaidas" color="#f59e0b" />
      
      {/* LINHA 2: Reposição e Devolução */}
      <MiniTable title="Top 15 Reposição (Enviar)" data={topReposicao} valueField="ReposicaoSugeridaBruta" color="var(--accent)" />
      <MiniTable title="Top 15 Devolução (Trazer)" data={topDevolucao} valueField="DevolverSugerido" color="#ef4444" />
    </div>
  );
}