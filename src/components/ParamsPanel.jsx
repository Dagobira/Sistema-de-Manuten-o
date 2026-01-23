import React from "react";

export default function ParamsPanel({ params, setParams }) {
  const update = (patch) => setParams((prev) => ({ ...prev, ...patch }));

  return (
    <div className="panelForm">
      <div className="formGrid">
        <label className="field">
          <span className="fieldLabel">Cobertura alvo (meses)</span>
          <input
            type="number"
            min="1"
            value={params.coberturaAlvoMeses}
            onChange={(e) => update({ coberturaAlvoMeses: Number(e.target.value) })}
          />
        </label>

        <label className="field">
          <span className="fieldLabel">Transferência mínima (unidades)</span>
          <input
            type="number"
            min="0"
            value={params.transferenciaMinima}
            onChange={(e) => update({ transferenciaMinima: Number(e.target.value) })}
          />
        </label>

        <label className="field">
          <span className="fieldLabel">Regra sem movimento (meses) – 6m</span>
          <input
            type="number"
            min="1"
            value={params.regra6m}
            onChange={(e) => update({ regra6m: Number(e.target.value) })}
          />
        </label>

        <label className="field">
          <span className="fieldLabel">Regra sem movimento (meses) – 12m</span>
          <input
            type="number"
            min="1"
            value={params.regra12m}
            onChange={(e) => update({ regra12m: Number(e.target.value) })}
          />
        </label>
      </div>
      
      {/* Removi a nota explicativa para limpar o layout conforme solicitado */}
    </div>
  );
}