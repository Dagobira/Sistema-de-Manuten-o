import React from "react";

export default function FilterPanel({
  monthOptions,
  labOptions,
  categoryOptions,
  filters,
  setFilters,
}) {
  const update = (patch) => setFilters((prev) => ({ ...prev, ...patch }));

  // Função auxiliar para lidar com Select Único transformando em Array (para não quebrar a lógica do sistema)
  const handleSingleSelect = (field, value) => {
    // Se o valor for vazio, manda array vazio. Se tiver valor, manda array com 1 item.
    update({ [field]: value ? [value] : [] });
  };

  return (
    <div className="panelForm">
      <div className="formGrid">
        {/* Mês Início */}
        <label className="field">
          <span className="fieldLabel">Mês Início</span>
          <select
            value={filters.mesInicio}
            onChange={(e) => update({ mesInicio: e.target.value })}
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        {/* Mês Fim */}
        <label className="field">
          <span className="fieldLabel">Mês Fim</span>
          <select
            value={filters.mesFim}
            onChange={(e) => update({ mesFim: e.target.value })}
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        {/* Categoria (Agora Menu Suspenso) */}
        <label className="field">
          <span className="fieldLabel">Categoria</span>
          <select
            value={filters.categorias[0] || ""}
            onChange={(e) => handleSingleSelect("categorias", e.target.value)}
          >
            <option value="">Todas as categorias</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {/* Laboratório (Agora Menu Suspenso) */}
        <label className="field">
          <span className="fieldLabel">Laboratório</span>
          <select
            value={filters.labs[0] || ""}
            onChange={(e) => handleSingleSelect("labs", e.target.value)}
          >
            <option value="">Todos os laboratórios</option>
            {labOptions.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>

        {/* SKU (Sem a dica embaixo) */}
        <label className="field fieldFull">
          <span className="fieldLabel">SKU(s) separados por vírgula</span>
          <input
            type="text"
            placeholder="Ex: 12345, 56789..."
            value={filters.skuText}
            onChange={(e) => update({ skuText: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}