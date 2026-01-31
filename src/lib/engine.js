// src/lib/engine.js - VERSÃO FINAL CORRIGIDA (COM buildLabOptions)

// --- FUNÇÕES AUXILIARES ---

// Normaliza strings para comparação (remove acentos, espaços, lowercase)
// Essencial para cruzar "Shopping Barra" com "shopping barra "
function normalizeKey(str) {
  if (!str) return "";
  return String(str)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9]/g, "");      // Remove tudo que não é letra ou número
}

function findValue(row, candidates) {
  if (!row) return undefined;
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    if (row[candidate] !== undefined) return row[candidate];

    // Tentativa inteligente de achar a coluna mesmo com nome diferente
    const target = normalizeKey(candidate);
    const foundKey = keys.find(k => normalizeKey(k) === target);
    if (foundKey) return row[foundKey];
  }
  return undefined;
}

function parseNumber(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let s = String(val).trim().replace("R$", "").trim();
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// ---------------------------------------------------------
// EXPORTS OBRIGATÓRIOS (BUILDERS)
// ---------------------------------------------------------

export function buildProductMap(csvData) {
  const map = new Map();
  csvData.forEach((row) => {
    const skuRaw = findValue(row, ["SKU", "Codigo", "Item"]);
    if (!skuRaw) return;
    map.set(String(skuRaw), {
      sku: String(skuRaw),
      descricao: findValue(row, ["DescricaoProduto", "Descricao", "Produto"]) || "Sem descrição",
      categoria: findValue(row, ["Categoria", "Grupo"]) || "Geral",
      preco: parseNumber(findValue(row, ["Custo", "Preco"])) || 0,
    });
  });
  return map;
}

export function buildMatrizMap(csvData) {
  const map = new Map();
  csvData.forEach((row) => {
    const sku = String(findValue(row, ["SKU", "Codigo"]) || "");
    if (!sku) return;
    const qtd = parseNumber(findValue(row, ["QtdEstoque", "Estoque", "Saldo", "Quantidade"])) || 0;
    map.set(sku, qtd);
  });
  return map;
}

// Usa normalizeKey para garantir que o estoque do laboratório seja achado
export function buildLabSnapshotMap(csvData) {
  const map = new Map();
  csvData.forEach((row) => {
    const sku = findValue(row, ["SKU", "Codigo"]);
    const lab = findValue(row, ["Laboratorio", "Lab"]);
    if (!sku || !lab) return;

    // CHAVE NORMALIZADA
    const key = `${normalizeKey(lab)}__${sku}`;
    const qtd = parseNumber(findValue(row, ["QtdEstoque", "Estoque", "Saldo"])) || 0;
    map.set(key, qtd);
  });
  return map;
}

export function buildLojasMap(csvData) {
  const map = new Map();
  csvData.forEach(row => {
    // Normalizamos a chave para garantir o match no LogisticsDashboard
    const chaveRaw = findValue(row, ["Nome_Sistema", "Nome Sistema", "Laboratorio"]);
    if (!chaveRaw) return;

    // Guardamos com a chave normalizada
    map.set(normalizeKey(chaveRaw), {
      id: findValue(row, ["ID_Loja", "ID"]),
      nomeFantasia: findValue(row, ["Nome_Fantasia", "Nome Fantasia", "Loja"]), // Nome bonito para exibir
      nomeOriginal: chaveRaw,
      uf: findValue(row, ["UF", "Estado"]),
      diasAtendimento: findValue(row, ["Dias_Atenidmento", "Dias_Atendimento", "Dias Atendimento", "Dia"]),
      tempoEntrega: parseNumber(findValue(row, ["Tempo_de_Entrega", "Tempo Entrega", "Prazo"]))
    });
  });
  return map;
}

export function normalizeMovRows(csvData) {
  return csvData.map((row) => {
    let mes = findValue(row, ["Mes", "Mês", "Periodo", "Data", "AnoMes"]);
    // Lógica de fallback para data...
    if (!mes) {
      const values = Object.values(row);
      for (const v of values) {
        if (typeof v === 'string' && v.trim().startsWith('202') && v.includes('-')) {
          mes = v;
          break;
        }
      }
    }
    const vendas = parseNumber(findValue(row, ["PecasVendidas", "Vendas", "Venda"])) || 0;
    const outrasSaidas =
      (parseNumber(findValue(row, ["Danificado"])) || 0) +
      (parseNumber(findValue(row, ["Defeito"])) || 0) +
      (parseNumber(findValue(row, ["Garantia"])) || 0) +
      (parseNumber(findValue(row, ["UsoInterno"])) || 0);

    const labName = findValue(row, ["Laboratorio", "Lab"]) || "Desconhecido";

    return {
      Laboratorio: labName, // Mantém original para exibição
      LaboratorioClean: normalizeKey(labName), // Cria versão limpa para match
      SKU: String(findValue(row, ["SKU", "Codigo"]) || ""),
      Mes: mes || "",
      Vendas: vendas,
      OutrasSaidas: outrasSaidas,
      TotalConsumido: vendas + outrasSaidas
    };
  });
}

export function normalizeDefectRows(csvData, lojasMap) {
  return csvData.map(row => {
    const labRaw = findValue(row, ["Laboratório", "Laboratorio"]);
    // Tenta achar a loja usando a chave normalizada
    const lojaConfig = lojasMap.get(normalizeKey(labRaw));
    return {
      Data: findValue(row, ["Data"]),
      Motivo: findValue(row, ["Outras Saidas", "Motivo"]),
      Laboratorio: lojaConfig ? lojaConfig.nomeFantasia : labRaw,
      Tecnico: findValue(row, ["Tecnico"]),
      SKU: String(findValue(row, ["SKU"])),
      Qtd: parseNumber(findValue(row, ["Qtd", "Quantidade"])),
      Obs: findValue(row, ["Observações"])
    };
  });
}

// --- ESTA É A FUNÇÃO QUE FALTAVA ---
export function buildLabOptions(movRows) {
  const s = new Set(movRows.map((r) => r.Laboratorio).filter(Boolean));
  return Array.from(s).sort();
}

export function buildMonthOptions(movRows) {
  const s = new Set(
    movRows.map((r) => r.Mes).filter(m => m && m.length >= 7)
  );
  return Array.from(s).sort();
}

export function parseSkuInput(text) {
  if (!text) return [];
  return text.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
}

// ---------------------------------------------------------
// 🧠 O CÉREBRO (Com Normalização de Chaves)
// ---------------------------------------------------------

export function computeFelipeTable({ prodMap, matrizMap, labSnapMap, movRows, filters, params }) {
  const { mesInicio, mesFim, labs, categorias, skuList } = filters;

  // 1. Filtrar Vendas
  const filteredMovs = movRows.filter(r => {
    if (!r.Mes) return false;
    if (mesInicio && r.Mes < mesInicio) return false;
    if (mesFim && r.Mes > mesFim) return false;

    // Filtro de Lab usando a chave normalizada se necessário, ou nome exato
    if (labs.length > 0 && !labs.includes(r.Laboratorio)) return false;

    if (skuList && skuList.length > 0 && !skuList.includes(r.SKU)) return false;
    return true;
  });

  // 2. Agrupar Vendas (Usando Chave Normalizada)
  const groupMap = new Map();
  filteredMovs.forEach(r => {
    // AQUI ESTÁ O SEGREDO: Usamos LaboratorioClean (normalizado)
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
  // Se não tem filtro de laboratório, pega todos os disponíveis no movimento
  let targetLabs = labs.length > 0 ? labs : buildLabOptions(movRows);

  targetLabs.forEach(labName => {
    // Normalizamos o nome do laboratório alvo para bater com o mapa
    const labKeyClean = normalizeKey(labName);

    prodMap.forEach((prodData, sku) => {
      if (categorias.length > 0 && !categorias.includes(prodData.categoria)) return;
      if (skuList && skuList.length > 0 && !skuList.includes(sku)) return;

      // Montamos a chave de busca normalizada
      const key = `${labKeyClean}__${sku}`;

      const stats = groupMap.get(key) || { vendas: 0, outras: 0, total: 0 };
      const estLab = labSnapMap.get(key) || 0;
      const estMatriz = matrizMap.get(sku) || 0;

      // Calcular número de meses (Lógica de data mantida)
      let mesesCount = 1;
      if (mesInicio && mesFim) {
        const d1 = new Date(mesInicio + "-01");
        const d2 = new Date(mesFim + "-01");
        if (!isNaN(d1) && !isNaN(d2)) {
          mesesCount = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + 1;
          if (mesesCount < 1) mesesCount = 1;
        }
      }

      const mediaMensal = stats.total / mesesCount;
      // Cobertura: Se vende 0, mas tem estoque, cobertura é infinita (999)
      const cobertura = mediaMensal > 0 ? (estLab / mediaMensal) : (estLab > 0 ? 999 : 0);

      // --- CÁLCULO DE REPOSIÇÃO (Igual ao Compras) ---
      let alvo = 0;
      let sugestao = 0;
      let devolver = 0;
      let status = "Ok";
      let diagnosticoIA = "✅ Estável";

      if (mediaMensal > 0) {
        // Giro Baixo (<1/mês): Piso 1. Giro Alto: Piso 3.
        const piso = mediaMensal < 1.0 ? 1 : 3;
        alvo = Math.max(mediaMensal * params.coberturaAlvoMeses, piso);
      } else {
        // Sem vendas
        if (mesesCount >= params.regra12m) {
          alvo = 0; // Se não vendeu em 12m, alvo é zero
        } else if (mesesCount >= params.regra6m) {
          alvo = estLab > 0 ? 1 : 0; // Se tem estoque e não vendeu em 6m, mantém 1
        } else {
          alvo = estLab; // Mantém o que tem
        }
      }

      alvo = Math.ceil(alvo);
      const diferenca = alvo - estLab;

      if (diferenca > 0) {
        // Precisa repor
        // Só sugere se a falta for maior que o mínimo OU se estiver zerado (Ruptura)
        if (diferenca >= params.transferenciaMinima || estLab === 0) {
          sugestao = diferenca;
          status = "Reposição";
        }
      } else if (diferenca < 0) {
        // Excesso
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

      // Trava de segurança: não devolver mais do que tem
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