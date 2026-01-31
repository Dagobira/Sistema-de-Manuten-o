/**
 * Adiciona zero à esquerda (pad 2)
 * @param {number} n
 * @returns {string} ex: "05"
 */
export function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Normaliza string "YYYY-MM" ou "YYYY-M" ou "YYYY/MM"
 * @param {string} value
 * @returns {string|null} "YYYY-MM" ou null
 */
export function normalizeYearMonth(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  const m = s.match(/(\d{4})\D?(\d{1,2})/);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);

  if (!year || month < 1 || month > 12) return null;
  return `${year}-${pad2(month)}`;
}

/**
 * Converte "YYYY-MM" em índice inteiro (0, 1, 2...)
 * @param {string} ym
 * @returns {number|null}
 */
export function ymToIndex(ym) {
  const n = normalizeYearMonth(ym);
  if (!n) return null;
  const [y, m] = n.split("-").map(Number);
  return y * 12 + (m - 1);
}

/**
 * Converte índice inteiro para "YYYY-MM"
 * @param {number} idx
 * @returns {string}
 */
export function indexToYM(idx) {
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${pad2(m)}`;
}

/**
 * Lista meses no formato YYYY-MM entre inicio e fim (inclusive)
 * @param {string} ymStart
 * @param {string} ymEnd
 * @returns {string[]}
 */
export function listMonthsInclusive(ymStart, ymEnd) {
  const a = ymToIndex(ymStart);
  const b = ymToIndex(ymEnd);
  if (a == null || b == null) return [];
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  const out = [];
  for (let i = start; i <= end; i++) out.push(indexToYM(i));
  return out;
}

/**
 * Retorna contagem de meses entre duas datas (inclusive)
 * @param {string} ymStart
 * @param {string} ymEnd
 * @returns {number}
 */
export function monthsCountInclusive(ymStart, ymEnd) {
  return listMonthsInclusive(ymStart, ymEnd).length;
}

/**
 * Retorna [inicio, fim] da janela "últimos N meses" terminando em ymEnd
 * @param {string} ymEnd
 * @param {number} monthsBack
 * @returns {string[]|null}
 */
export function rollingWindowFromEnd(ymEnd, monthsBack) {
  const endIdx = ymToIndex(ymEnd);
  if (endIdx == null) return null;
  const startIdx = endIdx - (monthsBack - 1);
  return [indexToYM(startIdx), indexToYM(endIdx)];
}

/**
 * Parse data flexível com validação estrita (range + overflow check)
 * @param {string|Date} v - Valor data
 * @returns {Date|null}
 */
export function parseDateLoose(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;

  const s = String(v).trim();
  if (!s) return null;

  // Formato BR: dd/mm/yyyy
  const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    const day = Number(brMatch[1]);
    const month = Number(brMatch[2]);
    const year = Number(brMatch[3]);

    // Validação de ranges
    if (year < 1900 || year > 2100) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;

    const date = new Date(year, month - 1, day);

    // Overflow check (31/02 -> 03/03)
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return isNaN(date.getTime()) ? null : date;
  }

  // Formato ISO: yyyy-mm-dd
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);

    // Validação de ranges
    if (year < 1900 || year > 2100) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;

    const date = new Date(year, month - 1, day);

    // Overflow check
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return isNaN(date.getTime()) ? null : date;
  }

  // Fallback Date.parse (menos seguro, mas útil)
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * Formata data para dd/mm/yyyy
 * @param {Date} date
 * @returns {string|null}
 */
export function formatDateBR(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return null;
  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formata data para yyyy-mm-dd
 * @param {Date} date
 * @returns {string|null}
 */
export function formatDateISO(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return null;
  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
}
