import React from 'react';

export default function OrderPage({
  title,
  subtitle,
  rows,
  cols,
  onBack,
  onExport,
}) {
  const safeRows = rows || [];

  return (
    <div className="card">
      <div className="rowBetween">
        <div>
          <h2 style={{ marginBottom: 6 }}>{title}</h2>
          {subtitle ? <div className="subtitleSmall">{subtitle}</div> : null}
        </div>

        <div className="rowActions">
          <button onClick={onBack}>← Voltar</button>
          <button onClick={() => onExport(safeRows, cols)}>Exportar XML</button>
        </div>
      </div>

      <div className="tableWrap" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {safeRows.map((r, idx) => (
              <tr key={idx}>
                {cols.map((c) => (
                  <td key={c}>{formatCell(r[c])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {safeRows.length === 0 && (
        <div style={{ marginTop: 10, opacity: 0.75 }}>
          Nenhum item encontrado para este pedido com os filtros atuais.
        </div>
      )}
    </div>
  );
}

function formatCell(v) {
  if (typeof v === 'number') {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(
      v
    );
  }
  return v ?? '';
}
