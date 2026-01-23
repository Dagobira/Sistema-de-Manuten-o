// src/lib/csv.js
import Papa from 'papaparse';

export async function loadCSV(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao carregar ${url}: ${res.status}`);
  const text = await res.text();

  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (parsed.errors?.length) {
    // Não vamos quebrar por warning, mas é útil ver no console
    console.warn('CSV parse warnings:', url, parsed.errors);
  }

  return parsed.data || [];
}

// tenta achar uma coluna equivalente (porque às vezes muda o nome)
export function pickCol(row, candidates) {
  // 1) tentativa direta
  for (const c of candidates) {
    if (row[c] != null && String(row[c]).trim() !== '') return row[c];
  }

  // 2) tentativa por normalização (case-insensitive, remove espaços/acentos/símbolos)
  const keys = Object.keys(row);
  const normKeyMap = new Map();
  for (const k of keys) {
    normKeyMap.set(normalizeColName(k), k);
  }

  for (const c of candidates) {
    const nk = normalizeColName(c);
    const realKey = normKeyMap.get(nk);
    if (realKey && row[realKey] != null && String(row[realKey]).trim() !== '') {
      return row[realKey];
    }
  }

  return null;
}

function normalizeColName(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD') // separa acentos
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]/g, ''); // remove espaços, _ , -, etc
}

export function toNumber(v) {
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s) return 0;

  // troca vírgula por ponto (caso venha "1,0")
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
