import Papa from 'papaparse';

/**
 * Converte qualquer valor para string de forma segura
 * @param {any} v - Valor para converter
 * @returns {string} String limpa (trimmed)
 */
export function toString(v) {
  if (v == null) return '';
  return String(v).trim();
}

/**
 * Converte valor para número lidando com formatos BR e US
 * @param {any} v - Valor a converter (string, number, null)
 * @returns {number} Número ou 0 se inválido
 */
export function toNumber(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;

  const s = String(v).trim();
  if (!s) return 0;

  // Remove "R$" e espaços
  let cleaned = s.replace(/[R$\s]/g, '');

  // Trata formatos brasileiros e americanos
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');

    if (lastComma > lastDot) {
      // Formato BR: 1.234,56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato US: 1,234.56
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Só vírgula: assumir decimal BR
    cleaned = cleaned.replace(',', '.');
  }

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Carrega e parseia um arquivo CSV de uma URL com timeout e tratamento de erros
 * @param {string} url - URL do arquivo CSV
 * @param {Object} options - Opções adicionais
 * @returns {Promise<Array>} Array de objetos parseados
 * @throws {Error} Se houver erro no carregamento ou parse
 */
export async function loadCSV(url) {
  const DEFAULT_TIMEOUT_MS = 30000;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const text = await res.text();
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: (header) => header.trim(),
    });

    if (parsed.errors?.length > 0) {
      const criticalErrors = parsed.errors.filter(
        e => e.type === 'FieldMismatch' || e.type === 'Quotes'
      );
      if (criticalErrors.length > 0) {
        console.error('⚠️ Erros críticos no CSV:', url, criticalErrors);
      }
    }

    return parsed.data || [];

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`⏱️ Timeout ao carregar ${url} (30s)`);
    }
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(`🌐 Erro de rede ao carregar ${url}. Verifique sua conexão.`);
    }
    throw new Error(`❌ Erro ao carregar CSV (${url}): ${error.message}`);
  }
}

/**
 * Normaliza string para comparação (minuscula, sem acentos)
 * @param {string} s
 * @returns {string}
 */
export function normalizeString(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Tenta encontrar valor em coluna, normalizando nomes se necessário
 * @param {Object} row - Linha do CSV
 * @param {string[]} candidates - Nomes de colunas possíveis
 * @returns {any} Valor encontrado ou null
 */
export function pickCol(row, candidates) {
  // 1) tentativa direta
  for (const c of candidates) {
    if (row[c] != null && String(row[c]).trim() !== '') return row[c];
  }

  // 2) tentativa por normalização
  const keys = Object.keys(row);
  const normKeyMap = new Map();
  for (const k of keys) {
    normKeyMap.set(normalizeString(k), k);
  }

  for (const c of candidates) {
    const nk = normalizeString(c);
    const realKey = normKeyMap.get(nk);
    if (realKey && row[realKey] != null && String(row[realKey]).trim() !== '') {
      return row[realKey];
    }
  }

  return null;
}
