import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function generateOrderPDF(items, config) {
    const doc = new jsPDF();
    const { title, columns, colorHead, fileName } = config;

    // Validação
    if (!items || items.length === 0) {
        alert("Nenhum item para exportar");
        return;
    }

    // Cabeçalho
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text(title, 14, 22);

    doc.setFontSize(10);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString()} às ${new Date().toLocaleTimeString()}`, 14, 30);
    doc.text(`Total de Itens: ${items.length}`, 14, 35);

    // Tabela
    const tableColumn = columns.map(c => c.label);
    const tableRows = items.map(item =>
        columns.map(c => c.getValue ? c.getValue(item) : item[c.key])
    );

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 40,
        theme: 'grid',
        headStyles: {
            fillColor: colorHead,
            textColor: 255,
            fontStyle: 'bold'
        },
        styles: { fontSize: 10, cellPadding: 3 }
    });

    doc.save(fileName);
}
