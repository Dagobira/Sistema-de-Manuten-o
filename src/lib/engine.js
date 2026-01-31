// src/lib/engine.js
import { pickCol, toNumber, normalizeString, toString } from './csv';
import { normalizeYearMonth, monthsCountInclusive, buildLabOptions as _buildLabOptions, buildMonthOptions as _buildMonthOptions } from './date';
// Note: buildLabOptions e buildMonthOptions não estavam em date.js no plano original, 
// mas o prompt pediu para usar helpers de date. 
// PERA! O prompt pediu para adicionar JSDoc E usar helpers. 
// Vou manter buildLabOptions e buildMonthOptions AQUI se não estiverem em date.js
// Verificando date.js... não estão. Então mantenho aqui.

// CORREÇÃO: O prompt não pediu para mover buildLabOptions para date.js.
// Pediu apenas para usar normalizeYearMonth e monthsCountInclusive IMPORTS.

// ---------------------------------------------------------
// EXPORTS OBRIGATÓRIOS (BUILDERS)
// ---------------------------------------------------------

/**
 * Constrói mapa de produtos a partir do CSV
 * @param {Array} csvData
 * @returns {Map} SKU -> Detalhes
 */
export function buildProductMap(csvData) {
  const map = new Map();
  csvData.forEach((row) => {
    const sku = toString(pickCol(row, ["SKU", "Codigo", "Item"]));
    if (!sku) return;
    map.set(sku, {
      sku,
      descricao: pickCol(row, ["DescricaoProduto", "Descricao", "Produto"]) || "Sem descrição",
      categoria: pickCol(row, ["Categoria", "Grupo"]) || "Geral",
      preco: toNumber(pickCol(row, ["Custo", "Preco"])),
    });
  });
  return map;
}

/**
 * Constrói mapa de estoque da matriz
 * @param {Array} csvData
 * @returns {Map} SKU -> Quantidade
 */
export function buildMatrizMap(csvData) {
  const map = new Map();
  csvData.forEach((row) => {
    const sku = toString(pickCol(row, ["SKU", "Codigo"]));
    if (!sku) return;
    const qtd = toNumber(pickCol(row, ["QtdEstoque", "Estoque", "Saldo", "Quantidade"]));
    map.set(sku, qtd);
  });
  return map;
}

/**
 * Constrói mapa de estoque dos laboratórios (snapshot)
 * @param {Array} csvData
 * @returns {Map} Chave (Lab__SKU) -> Quantidade
 */
export function buildLabSnapshotMap(csvData) {
  const map = new Map();
  csvData.forEach((row) => {
    const sku = toString(pickCol(row, ["SKU", "Codigo"]));
    const lab = pickCol(row, ["Laboratorio", "Lab"]);
    if (!sku || !lab) return;

    // CHAVE NORMALIZADA
    const key = `${normalizeString(lab)}__${sku}`;
    const qtd = toNumber(pickCol(row, ["QtdEstoque", "Estoque", "Saldo"]));
    map.set(key, qtd);
  });
  return map;
}

/**
 * Constrói mapa de lojas/laboratórios com metadados
 * @param {Array} csvData
 * @returns {Map} NomeNormalizado -> ObjetoLoja
 */
export function buildLojasMap(csvData) {
  const map = new Map();
  csvData.forEach(row => {
    const chaveRaw = pickCol(row, ["Nome_Sistema", "Nome Sistema", "Laboratorio"]);
    if (!chaveRaw) return;

    map.set(normalizeString(chaveRaw), {
      id: pickCol(row, ["ID_Loja", "ID"]),
      nomeFantasia: pickCol(row, ["Nome_Fantasia", "Nome Fantasia", "Loja"]),
      nomeOriginal: chaveRaw,
      uf: pickCol(row, ["UF", "Estado"]),
      diasAtendimento: pickCol(row, ["Dias_Atenidmento", "Dias_Atendimento", "Dias Atendimento"]),
      tempoEntrega: toNumber(pickCol(row, ["Tempo_de_Entrega", "Tempo Entrega", "Prazo"]))
    });
  });
  return map;
}

/**
 * Normaliza linhas de movimento (vendas, saídas)
 * @param {Array} csvData
 * @returns {Array} Linhas normalizadas
 */
export function normalizeMovRows(csvData) {
  return csvData.map((row) => {
    let mes = pickCol(row, ["Mes", "Mês", "Periodo", "Data", "AnoMes"]);

    // Fallback para data
    if (!mes) {
      const values = Object.values(row);
      for (const v of values) {
        const s = toString(v);
        if (s.startsWith('202') && s.includes('-')) {
          mes = s;
          break;
        }
      }
    }

    // Normalizar o mês usando helper de date.js
    mes = normalizeYearMonth(mes) || "";

    const vendas = toNumber(pickCol(row, ["PecasVendidas", "Vendas", "Venda"]));
    const outrasSaidas =
      toNumber(pickCol(row, ["Danificado"])) +
      toNumber(pickCol(row, ["Defeito"])) +
      toNumber(pickCol(row, ["Garantia"])) +
      toNumber(pickCol(row, ["UsoInterno"]));

    const labName = pickCol(row, ["Laboratorio", "Lab"]) || "Desconhecido";

    return {
      Laboratorio: labName,
      LaboratorioClean: normalizeString(labName),
      SKU: toString(pickCol(row, ["SKU", "Codigo"])),
      Mes: mes,
      Vendas: vendas,
      OutrasSaidas: outrasSaidas,
      TotalConsumido: vendas + outrasSaidas,
      // Detalhes extras se necessário nos KPIs
      Danificado: toNumber(pickCol(row, ["Danificado"])),
      Defeito: toNumber(pickCol(row, ["Defeito"])),
      Garantia: toNumber(pickCol(row, ["Garantia"])),
      ErroOperacional: toNumber(pickCol(row, ["ErroOperacional"])),
      Excecao: toNumber(pickCol(row, ["Excecao"])),
      NaoOrcado: toNumber(pickCol(row, ["NaoOrcado"])),
    };
  });
}

/**
 * Normaliza linhas de defeitos
 * @param {Array} csvData
 * @param {Map} lojasMap
 * @returns {Array} Linhas normalizadas
 */
export function normalizeDefectRows(csvData, lojasMap) {
  return csvData.map(row => {
    const labRaw = pickCol(row, ["Laboratório", "Laboratorio"]);
    const lojaConfig = lojasMap.get(normalizeString(labRaw));

    return {
      Data: pickCol(row, ["Data"]),
      Motivo: pickCol(row, ["Outras Saidas", "Motivo"]),
      Laboratorio: lojaConfig ? lojaConfig.nomeFantasia : labRaw,
      Tecnico: pickCol(row, ["Tecnico"]),
      SKU: toString(pickCol(row, ["SKU"])),
      Qtd: toNumber(pickCol(row, ["Qtd", "Quantidade"])),
      Obs: pickCol(row, ["Observações"])
    };
  });
}

/**
 * Extrai lista de laboratórios únicos das movimentações
 * @param {Array} movRows
 * @returns {string[]} Lista ordenada de laboratórios
 */
export function buildLabOptions(movRows) {
  const s = new Set(movRows.map((r) => r.Laboratorio).filter(Boolean));
  return Array.from(s).sort();
}

/**
 * Extrai lista de meses únicos das movimentações
 * @param {Array} movRows
 * @returns {string[]} Lista ordenada de meses (YYYY-MM)
 */
export function buildMonthOptions(movRows) {
  const s = new Set(
    movRows.map((r) => r.Mes).filter(m => m && m.length >= 7)
  );
  return Array.from(s).sort();
}

/**
 * Parse input de texto para lista de SKUs
 * @param {string} text
 * @returns {string[]} Lista de SKUs
 */
export function parseSkuInput(text) {
  if (!text) return [];
  return text.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
}

// ---------------------------------------------------------
// 🧠 O CÉREBRO (Cálculos)
// ---------------------------------------------------------

/**
 * Computa tabela principal de análise (Felipe Table)
 * @param {Object} args
 * @returns {Object} { rows: Array }
 */
export function computeFelipeTable({ prodMap, matrizMap, labSnapMap, movRows, filters, params }) {
  const { mesInicio, mesFim, labs, categorias, skuList } = filters;

  // 1. Filtrar Vendas
  const filteredMovs = movRows.filter(r => {
    if (!r.Mes) return false;
    if (mesInicio && r.Mes < mesInicio) return false;
    if (mesFim && r.Mes > mesFim) return false;

    // Filtro de Lab
    if (labs.length > 0 && !labs.includes(r.Laboratorio)) return false;

    // Filtro de SKU
    if (skuList && skuList.length > 0 && !skuList.includes(r.SKU)) return false;
    return true;
  });

  // 2. Agrupar Vendas (Usando Chave Normalizada)
  const groupMap = new Map();
  filteredMovs.forEach(r => {
    const key = `${r.LaboratorioClean}__${r.SKU}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, { vendas: 0, outras: 0, total: 0 });
    }
    const entry = groupMap.get(key);
    entry.vendas += r.Vendas;
    entry.outras += r.OutrasSaidas;
    entry.total += r.TotalConsumido;
  });

  const results = [];
  let targetLabs = labs.length > 0 ? labs : buildLabOptions(movRows);

  targetLabs.forEach(labName => {
    const labKeyClean = normalizeString(labName);

    prodMap.forEach((prodData, sku) => {
      // Filtros Globais
      if (categorias.length > 0 && !categorias.includes(prodData.categoria)) return;
      if (skuList && skuList.length > 0 && !skuList.includes(sku)) return;

      const key = `${labKeyClean}__${sku}`;
      const stats = groupMap.get(key) || { vendas: 0, outras: 0, total: 0 };
      const estLab = labSnapMap.get(key) || 0;
      const estMatriz = matrizMap.get(sku) || 0;

      // Calcular número de meses usando helper de date.js
      let mesesCount = 1;
      if (mesInicio && mesFim) {
        mesesCount = monthsCountInclusive(mesInicio, mesFim);
        if (mesesCount < 1) mesesCount = 1;
      }

      const mediaMensal = stats.total / mesesCount;
      const cobertura = mediaMensal > 0 ? (estLab / mediaMensal) : (estLab > 0 ? 999 : 0);

      // --- CÁLCULO DE REPOSIÇÃO ---
      let alvo = 0;
      let sugestao = 0;
      let devolver = 0;
      let status = "Ok";
      let diagnosticoIA = "✅ Estável";

      if (mediaMensal > 0) {
        const piso = mediaMensal < 1.0 ? 1 : 3;
        alvo = Math.max(mediaMensal * params.coberturaAlvoMeses, piso);
      } else {
        if (mesesCount >= params.regra12m) {
          alvo = 0;
        } else if (mesesCount >= params.regra6m) {
          alvo = estLab > 0 ? 1 : 0;
        } else {
          alvo = estLab;
        }
      }

      alvo = Math.ceil(alvo);
      const diferenca = alvo - estLab;

      if (diferenca > 0) {
        if (diferenca >= params.transferenciaMinima || estLab === 0) {
          sugestao = diferenca;
          status = "Reposição";
        }
      } else if (diferenca < 0) {
        devolver = Math.abs(diferenca);
        status = "Remanejar";
      }

      if (estLab === 0 && mediaMensal > 0) {
        diagnosticoIA = "🚨 RUPTURA! Vendas perdidas.";
        status = "Crítico";
      } else if (sugestao > 0) {
        diagnosticoIA = `⚠️ Baixo. Faltam ${sugestao}.`;
      } else if (devolver > 0) {
        diagnosticoIA = `📉 Excesso. Mover ${devolver}.`;
      }

      if (devolver > estLab) devolver = estLab;

      results.push({
        id: key,
        Laboratorio: labName,
        SKU: sku,
        Descricao: prodData.descricao,
        Categoria: prodData.categoria,
        EstoqueGeralAtual: estMatriz,
        EstoqueLabAtual: estLab,
        Vendas: stats.vendas,
        OutrasSaidas: stats.outras,
        TotalConsumido: stats.total,
        MediaMensalConsumo: mediaMensal,
        CoberturaMeses: cobertura,
        EstoqueAlvo: alvo,
        Reposicao: sugestao,
        Remanejamento: devolver,
        SugestaoIA: diagnosticoIA,
        Status: status
      });
    });
  });

  return { rows: results };
}