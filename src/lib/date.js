// src/lib/date.js

export function pad2(n) {
  return String(n).padStart(2, "0");
}

// Aceita "2025-1" "2025-01" "2025/01" e normaliza para "YYYY-MM"
export function normalizeYearMonth(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  // tenta pegar ano e mês de qualquer formato com separador
  const m = s.match(/(\d{4})\D?(\d{1,2})/);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);

  if (!year || month < 1 || month > 12) return null;
  return `${year}-${pad2(month)}`;
}

// Converte "YYYY-MM" em índice inteiro (para comparar/ordenar)
export function ymToIndex(ym) {
  const n = normalizeYearMonth(ym);
  if (!n) return null;
  const [y, m] = n.split("-").map(Number);
  return y * 12 + (m - 1);
}

// Converte índice inteiro em "YYYY-MM"
export function indexToYM(idx) {
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${pad2(m)}`;
}

// Lista de meses entre inicio e fim (inclusive)
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

export function monthsCountInclusive(ymStart, ymEnd) {
  return listMonthsInclusive(ymStart, ymEnd).length;
}

// Retorna [inicio, fim] da janela "últimos N meses" a partir do mesFim (inclusive)
export function rollingWindowFromEnd(ymEnd, monthsBack) {
  const endIdx = ymToIndex(ymEnd);
  if (endIdx == null) return null;
  const startIdx = endIdx - (monthsBack - 1);
  return [indexToYM(startIdx), indexToYM(endIdx)];
}

// Datas: aceita dd/mm/yyyy ou yyyy-mm-dd ou Date
export function parseDateLoose(v) {
  if (!v) return null;
  if (v instanceof Date) return v;

  const s = String(v).trim();
  if (!s) return null;

  // dd/mm/yyyy
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const d = Number(br[1]);
    const m = Number(br[2]);
    const y = Number(br[3]);
    const dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // yyyy-mm-dd
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    const dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // fallback Date.parse
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}
