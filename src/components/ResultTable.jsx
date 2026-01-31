// src/components/ResultTable.jsx
import React from 'react';
import { FixedSizeList as List } from 'react-window';


// Custom AutoSizer replacement using ResizeObserver
const CustomAutoSizer = ({ children }) => {
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        setSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };

    // Initial size
    updateSize();

    // Watch for resize
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      {size.width > 0 && size.height > 0 && children(size)}
    </div>
  );
};


const Row = ({ index, style, data }) => {
  const item = data[index];
  return (
    <div style={{ ...style, display: 'flex', borderBottom: '1px solid #f0f0f0', alignItems: 'center', fontSize: '0.9rem' }}>
      <div style={{ flex: 1, padding: '0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.Laboratorio}</div>
      <div style={{ flex: 1, padding: '0 10px' }}>{item.SKU}</div>
      <div style={{ flex: 2, padding: '0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.Descricao}>{item.Descricao}</div>
      <div style={{ flex: 0.8, padding: '0 10px', textAlign: 'center' }}>{item.MediaMensalConsumo.toFixed(1)}</div>
      <div style={{ flex: 0.8, padding: '0 10px', textAlign: 'center' }}>{item.CoberturaMeses.toFixed(1)}</div>
      <div style={{ flex: 0.8, padding: '0 10px', textAlign: 'center' }}>{item.EstoqueAlvo}</div>
      <div style={{ flex: 0.8, padding: '0 10px', textAlign: 'center' }}>{item.EstoqueLabAtual}</div>
      <div style={{ flex: 0.8, padding: '0 10px', textAlign: 'center', fontWeight: 'bold', color: item.Reposicao > 0 ? '#2563eb' : '#ddd' }}>{item.Reposicao}</div>
      <div style={{ flex: 0.8, padding: '0 10px', textAlign: 'center', fontWeight: 'bold', color: item.Remanejamento > 0 ? '#dc2626' : '#ddd' }}>{item.Remanejamento}</div>
      <div style={{ flex: 1.5, padding: '0 10px', fontSize: '0.8rem' }}>{item.SugestaoIA}</div>
    </div>
  );
};

export default function ResultTable({ rows, onExport }) {
  // Filtro visual rápido (opcional, pode ser adicionado)
  // Por enquanto mostra tudo que o SistemaCompras calculou

  // Headers para config do PDF (reaproveita os originais na exportação)
  // Wrapper para exportação que adapta ao formato do pdfExport
  const handleExportClick = (tipo) => {
    if (onExport) onExport(tipo);
  };

  return (
    <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', height: '600px', overflow: 'hidden' }}>
      {/* TOOLBAR */}
      <div style={{ padding: '15px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>Resultados da Análise ({rows.length})</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => handleExportClick('reposicao')}
            style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            📄 PDF Reposição
          </button>
          <button
            onClick={() => handleExportClick('remanejamento')}
            style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            🚚 PDF Remanejo
          </button>
        </div>
      </div>

      {/* HEADER DA TABELA */}
      <div style={{ display: 'flex', padding: '10px 0', background: '#f8fafc', fontWeight: '600', color: '#475569', fontSize: '0.85rem', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ flex: 1, padding: '0 10px' }}>Laboratório</div>
        <div style={{ flex: 1, padding: '0 10px' }}>SKU</div>
        <div style={{ flex: 2, padding: '0 10px' }}>Produto</div>
        <div style={{ flex: 0.8, padding: '0 10px', textAlign: 'center' }}>Média/Mês</div>
        <div style={{ flex: 0.8, padding: '0 10px', textAlign: 'center' }}>Cob. (Meses)</div>
        <div style={{ flex: 0.8, padding: '0 10px', textAlign: 'center' }}>Alvo</div>
        <div style={{ flex: 0.8, padding: '0 10px', textAlign: 'center' }}>Atual</div>
        <div style={{ flex: 0.8, padding: '0 10px', textAlign: 'center', color: '#2563eb' }}>Comprar</div>
        <div style={{ flex: 0.8, padding: '0 10px', textAlign: 'center', color: '#dc2626' }}>Mover</div>
        <div style={{ flex: 1.5, padding: '0 10px' }}>Diagnóstico</div>
      </div>

      {/* TABELA VIRTUALIZADA */}
      <div style={{ flex: 1 }}>
        <CustomAutoSizer>
          {({ height, width }) => (
            <List
              height={height}
              width={width}
              itemCount={rows.length}
              itemSize={50}
              itemData={rows}
            >
              {Row}
            </List>
          )}
        </CustomAutoSizer>
      </div>
    </div>
  );
}