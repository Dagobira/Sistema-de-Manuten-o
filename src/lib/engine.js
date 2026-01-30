// engine.js - Versão Blindada (Sincronizada com Compras)

// --- FUNÇÕES AUXILIARES ---
function findValue(row, candidates) {
  if (!row) return undefined;
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    if (row[candidate] !== undefined) return row[candidate];
    // Normalização para ignorar acentos, maiúsculas e espaços extras
    const normalize = (s) => String(s).trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[\.\-\_]/g, "");
    const target = normalize(candidate);
    const foundKey = keys.find(k => normalize(k) === target);
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
// PARSERS
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

export function buildLabSnapshotMap(csvData) {
  const map = new Map();
  csvData.forEach((row) => {
    const sku = findValue(row, ["SKU", "Codigo"]);
    const lab = findValue(row, ["Laboratorio", "Lab"]);
    if (!sku || !lab) return;
    const key = `${lab}__${sku}`;
    const qtd = parseNumber(findValue(row, ["QtdEstoque", "Estoque", "Saldo"])) || 0;
    map.set(key, qtd);
  });
  return map;
}

export function buildLojasMap(csvData) {
  const map = new Map();
  csvData.forEach(row => {
    const chave = findValue(row, ["Nome_Sistema", "Nome Sistema", "Laboratorio"]);
    if (!chave) return;
    map.set(chave, {
      id: findValue(row, ["ID_Loja", "ID"]),
      nomeFantasia: findValue(row, ["Nome_Fantasia", "Nome Fantasia", "Loja"]),
      uf: findValue(row, ["UF", "Estado"]),
      cidade: findValue(row, ["Cidade"]),
      diasAtendimento: findValue(row, ["Dias_Atenidmento", "Dias_Atendimento", "Dias Atendimento", "Dia"]),
      tempoEntrega: parseNumber(findValue(row, ["Tempo_de_Entrega", "Tempo Entrega", "Prazo"]))
    });
  });
  return map;
}

export function buildTecnicosMap(csvData) {
  const map = new Map();
  csvData.forEach(row => {
    const nome = findValue(row, ["Nome", "Tecnico"]);
    if (!nome) return;
    map.set(nome.toLowerCase().trim(), {
      id: row["ID_Tecnico"],
      nome: row["Nome"],
      idLoja: row["ID_Loja_Atual"],
      status: row["Status"]
    });
  });
  return map;
}

// ---------------------------------------------------------
// NORMALIZADORES
// ---------------------------------------------------------

export function normalizeMovRows(csvData) {
  return csvData.map((row) => {
    let mes = findValue(row, ["Mes", "Mês", "Periodo", "Data", "AnoMes"]);
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

    // Soma de todas as outras saídas
    const outrasSaidas =
      (parseNumber(findValue(row, ["Danificado"])) || 0) +
      (parseNumber(findValue(row, ["Defeito"])) || 0) +
      (parseNumber(findValue(row, ["ErroOperacional"])) || 0) +
      (parseNumber(findValue(row, ["Excecao", "Exceção"])) || 0) +
      (parseNumber(findValue(row, ["ExcecaoDiamante"])) || 0) +
      (parseNumber(findValue(row, ["Garantia"])) || 0) +
      (parseNumber(findValue(row, ["NaoOrcado"])) || 0) +
      (parseNumber(findValue(row, ["ServicoDesfeito"])) || 0) +
      (parseNumber(findValue(row, ["UsoInterno", "Consumo"])) || 0);

    const labName = findValue(row, ["Laboratorio", "Lab"]) || "Desconhecido";

    return {
      Laboratorio: labName,
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
    const labRaw = findValue(row, ["Laboratório", "Laboratorio", "Laboratorio "]);
    const lojaConfig = lojasMap.get(labRaw);
    return {
      Data: findValue(row, ["Data"]),
      Motivo: findValue(row, ["Outras Saidas", "Motivo"]),
      LaboratorioRaw: labRaw,
      Laboratorio: lojaConfig ? lojaConfig.nomeFantasia : labRaw,
      UF: lojaConfig ? lojaConfig.uf : "N/A",
      Tecnico: findValue(row, ["Tecnico", "Técnico"]),
      SKU: String(findValue(row, ["SKU"])),
      Qtd: parseNumber(findValue(row, ["Qtd", "Quantidade"])),
      Obs: findValue(row, ["Observações", "Observacoes", "Obs"])
    };
  });
}

// ---------------------------------------------------------
// FILTROS E CÁLCULOS
// ---------------------------------------------------------

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
// 🧠 O CÉREBRO PRINCIPAL (Updated)
// ---------------------------------------------------------

export function computeFelipeTable({ prodMap, matrizMap, labSnapMap, movRows, filters, params }) {
  const { mesInicio, mesFim, labs, categorias, skuList } = filters;

  // 1. Filtrar
  const filteredMovs = movRows.filter(r => {
    if (!r.Mes) return false;
    if (mesInicio && r.Mes < mesInicio) return false;
    if (mesFim && r.Mes > mesFim) return false;
    if (labs.length > 0 && !labs.includes(r.Laboratorio)) return false;
    if (skuList && skuList.length > 0 && !skuList.includes(r.SKU)) return false;
    return true;
  });

  // 2. Agrupar
  const groupMap = new Map();
  filteredMovs.forEach(r => {
    const key = `${r.Laboratorio}__${r.SKU}`;
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
    prodMap.forEach((prodData, sku) => {
      if (categorias.length > 0 && !categorias.includes(prodData.categoria)) return;
      if (skuList && skuList.length > 0 && !skuList.includes(sku)) return;

      const key = `${labName}__${sku}`;
      const stats = groupMap.get(key) || { vendas: 0, outras: 0, total: 0 };
      const estLab = labSnapMap.get(key) || 0;
      const estMatriz = matrizMap.get(sku) || 0;

      // Calcular número de meses
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
      const cobertura = mediaMensal > 0 ? (estLab / mediaMensal) : (estLab > 0 ? 999 : 0);

      // --- NOVA LÓGICA (SYNC COM COMPRAS) ---
      let alvo = 0;
      let sugestao = 0;
      let devolver = 0;
      let status = "Ok";
      let diagnosticoIA = "✅ Estável";

      if (mediaMensal > 0) {
        // PISO DINÂMICO
        if (mediaMensal < 1.0) {
          // Giro Baixo: Piso 1
          alvo = Math.max(mediaMensal * params.coberturaAlvoMeses, 1);
        } else {
          // Giro Alto: Piso 3
          alvo = Math.max(mediaMensal * params.coberturaAlvoMeses, 3);
        }
      } else {
        // SEM VENDAS NO PERÍODO
        if (mesesCount >= params.regra12m) {
          alvo = 0;
          status = "Sem Giro 12m";
        } else if (mesesCount >= params.regra6m) {
          alvo = estLab > 0 ? 1 : 0;
          status = "Sem Giro 6m";
        } else {
          alvo = estLab; // Mantém o que tem
        }
      }

      alvo = Math.ceil(alvo);

      const diferenca = alvo - estLab;

      if (diferenca > 0) {
        // Falta peça
        if (diferenca >= params.transferenciaMinima || estLab === 0) {
          sugestao = diferenca;
          status = "Reposição";
        }
      } else if (diferenca < 0) {
        // Sobra peça
        devolver = Math.abs(diferenca);
        status = "Remanejar";
      }

      // DIAGNÓSTICO IA
      if (estLab === 0 && mediaMensal > 0) {
        diagnosticoIA = "🚨 RUPTURA! Vendas perdidas.";
        status = "Crítico";
      } else if (estLab < alvo) {
        diagnosticoIA = `⚠️ Baixo. Faltam ${sugestao}.`;
      } else if (devolver > 0) {
        diagnosticoIA = `📉 Excesso. Mover ${devolver}.`;
      } else if (mediaMensal === 0 && estLab > 0) {
        diagnosticoIA = "❄️ Item Parado.";
      } else {
        diagnosticoIA = "✅ Estoque Saudável.";
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