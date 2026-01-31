import React from 'react';

/**
 * Tabela compacta para exibir top lists ou resumos
 * @param {string} title - Título da tabela
 * @param {Array} data - Dados a exibir
 * @param {string} valueField - Campo de valor a exibir (ex: "Vendas")
 * @param {string} color - Cor do cabeçalho/destaque
 */
export default function MiniTable({ title, data, valueField, color = "#333" }) {
    if (!data || data.length === 0) return null;

    return (
        <div className="miniTable" style={{ border: `1px solid #eee`, borderRadius: '8px', overflow: 'hidden' }}>
            <h4 style={{
                background: color,
                color: '#fff',
                margin: 0,
                padding: '10px 15px',
                fontSize: '14px'
            }}>
                {title}
            </h4>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <tbody>
                        {data.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                <td style={{ padding: '8px 12px' }}>
                                    <div style={{ fontWeight: 'bold' }}>{item.SKU}</div>
                                    <div style={{ color: '#666', fontSize: '11px' }}>
                                        {item.Descricao?.substring(0, 30)}...
                                    </div>
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold' }}>
                                    {item[valueField]}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
