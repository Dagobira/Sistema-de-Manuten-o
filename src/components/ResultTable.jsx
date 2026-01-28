import React, { useMemo, useState } from "react";
import { Virtuoso } from "react-virtuoso";
// Importamos as bibliotecas de PDF
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ResultTable({ rows }) {
  const [sortConfig, setSortConfig] = useState({ key: 'Reposicao', direction: 'desc' });

  // --- FUNÇÃO GERADORA DE PDF ---
  const handleGeneratePDF = (tipo) => {
    const doc = new jsPDF();
    const isRepo = tipo === "reposicao";
    const title = isRepo ? "PEDIDO DE REPOSIÇÃO (Enviar para Lab)" : "PEDIDO DE REMANEJAMENTO (Devolver para Matriz)";
    const colorHead = isRepo ? [0, 122, 255] : [220, 38, 38]; // Azul ou Vermelho

    // 1. Filtrar os itens que tem quantidade
    const items = rows.filter(r => {
      const qtd = isRepo ? (r.Reposicao || 0) : (r.Remanejamento || 0);
      return qtd > 0;
    });

    if (items.length === 0) {
      alert("Não há itens para gerar neste pedido.");
      return;
    }

    // 2. Cabeçalho do PDF
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text(title, 14, 22);

    doc.setFontSize(10);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString()} às ${new Date().toLocaleTimeString()}`, 14, 30);
    doc.text(`Total de Itens: ${items.length}`, 14, 35);

    // 3. Montar a Tabela
    const tableColumn = ["Laboratório", "SKU", "Descrição", "Estoque Atual", "Qtd"];
    const tableRows = items.map(item => [
      item.Laboratorio,
      item.SKU,
      item.Descricao,
      item.EstoqueLabAtual || 0, // Nova coluna
      isRepo ? item.Reposicao : item.Remanejamento
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: colorHead, textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 40 }, // Lab
        1: { cellWidth: 25 }, // SKU
        2: { cellWidth: 'auto' }, // Descricao
        3: { cellWidth: 25, halign: 'center' }, // Estoque Atual
        4: { cellWidth: 20, halign: 'center', fontStyle: 'bold' } // Qtd
      }
    });

    // 4. Salvar arquivo
    const fileName = isRepo ? "pedido_reposicao.pdf" : "pedido_remanejamento.pdf";
    doc.save(fileName);
  };

  // --- CONFIGURAÇÃO DA TABELA VISUAL ---
  const cols = useMemo(() => [
    { id: "Laboratorio", label: "Laboratório", width: 140, align: "left" },
    { id: "Categoria", label: "Categoria", width: 130, align: "left" },
    { id: "SKU", label: "SKU", width: 80, align: "left" },
    { id: "Descricao", label: "Descrição", width: 350, align: "left" },

    { id: "EstoqueGeralAtual", label: "Est. Matriz", width: 90, align: "center", bg: "var(--bg)" },
    { id: "EstoqueLabAtual", label: "Est. Lab", width: 80, align: "center", bg: "var(--bg)" },

    { id: "Vendas", label: "Vendas", width: 70, align: "center" },
    { id: "OutrasSaidas", label: "Outras Saídas", width: 90, align: "center" },
    { id: "TotalConsumido", label: "Total Cons.", width: 80, align: "center", bold: true },

    { id: "CoberturaMeses", label: "Cobertura", width: 80, align: "center" },

    { id: "Reposicao", label: "Reposição", width: 80, align: "center", color: "var(--accent)", bold: true },
    { id: "Remanejamento", label: "Remanejar", width: 80, align: "center", color: "#ef4444" },
    { id: "SugestaoIA", label: "Sugestão IA", width: 90, align: "center", color: "#a855f7" },

    { id: "Status", label: "Status", width: 110, align: "center" },
  ], []);

  const totalWidth = cols.reduce((acc, col) => acc + col.width, 0) + 40;

  const sortedRows = useMemo(() => {
    if (!rows) return [];
    let sortableItems = [...rows];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [rows, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const TableHeader = () => (
    <div
      style={{
        display: "flex",
        width: `${totalWidth}px`,
        background: "var(--table-header-bg)",
        borderBottom: "1px solid var(--border)",
        fontWeight: "600",
        fontSize: "11px",
        color: "var(--textSec)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        position: "sticky",
        top: 0,
        zIndex: 10
      }}
    >
      {cols.map((col) => (
        <div
          key={col.id}
          onClick={() => requestSort(col.id)}
          style={{
            width: col.width,
            padding: "14px 10px",
            textAlign: col.align || "left",
            cursor: "pointer",
            userSelect: "none",
            display: "flex", alignItems: "center", gap: "4px",
            justifyContent: col.align === "center" ? "center" : col.align === "right" ? "flex-end" : "flex-start"
          }}
        >
          {col.label} {sortConfig.key === col.id ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
        </div>
      ))}
    </div>
  );

  const renderRow = (index) => {
    const r = sortedRows[index];
    const isEven = index % 2 === 0;

    return (
      <div
        style={{
          display: "flex",
          width: `${totalWidth}px`,
          alignItems: "center",
          background: isEven ? "var(--panelSolid)" : "var(--bg)",
          borderBottom: "1px solid var(--border2)",
          minHeight: "48px",
          fontSize: "12px",
          color: "var(--text)",
        }}
      >
        {cols.map((col) => (
          <div
            key={col.id}
            style={{
              width: col.width,
              padding: "0 10px",
              textAlign: col.align || "left",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              fontWeight: col.bold ? "600" : "400",
              color: col.color || "inherit",
              height: "100%", display: "flex", alignItems: "center",
              justifyContent: col.align === "center" ? "center" : col.align === "right" ? "flex-end" : "flex-start"
            }}
            title={r[col.id]}
          >
            {col.id === "Status" ? (
              <span className={`status-badge status-${slug(r.Status)}`}>{r.Status}</span>
            ) : (
              formatCell(r[col.id])
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="card" style={{ height: "650px", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
      <div className="rowBetween" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border2)", background: "var(--panelSolid)", zIndex: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "var(--text)" }}>Resultado Geral</h2>
          <span className="subtitleSmall" style={{ marginTop: "4px", display: "block", color: "var(--textSec)" }}>Mostrando {sortedRows.length} linhas</span>
        </div>
        {/* NOVOS BOTÕES DE PDF */}
        <div className="rowActions">
          <button
            onClick={() => handleGeneratePDF("reposicao")}
            style={{ background: "var(--accent)", color: "#fff", border: "none" }}
          >
            📄 Pedido Reposição
          </button>
          <button
            onClick={() => handleGeneratePDF("remanejamento")}
            style={{ background: "#ef4444", color: "#fff", border: "none" }}
          >
            📄 Pedido Remanejamento
          </button>
        </div>
      </div>

      <div style={{ flex: 1, background: "var(--panelSolid)", overflow: "hidden" }}>
        <Virtuoso
          style={{ height: '100%', width: '100%' }}
          totalCount={sortedRows.length}
          components={{ Header: TableHeader }}
          itemContent={renderRow}
        />
      </div>
    </div>
  );
}

function formatCell(v) {
  if (typeof v === "number") return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: Number.isInteger(v) ? 0 : 2 }).format(v);
  return v ?? "-";
}
function slug(s) { return String(s || "").toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, ""); }