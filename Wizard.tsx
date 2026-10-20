import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Cargo, Departamento, Predio, Processo } from "../lib/types";
import { buscarTermosAplicaveis, type TermoAplicavel } from "../lib/rules";
import { baixarBlob, baixarComoZip, formatarDataBR, gerarDocx, TEMPLATE_FILE } from "../lib/generate";

const MOTIVOS_DEMISSAO = [
  "Pedido de demissão",
  "Sem justa causa",
  "Com justa causa",
  "Término de contrato",
];

interface PredioComEmpresa extends Predio {
  razao_social: string | null;
  cnpj: string | null;
}

export default function Wizard() {
  const { perfil } = useAuth();

  const [predios, setPredios] = useState<PredioComEmpresa[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [carregandoBase, setCarregandoBase] = useState(true);

  // Formulário
  const [predioId, setPredioId] = useState("");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [cpf, setCpf] = useState("");
  const [departamentoId, setDepartamentoId] = useState("");
  const [cargoId, setCargoId] = useState("");
  const [tipoEvento, setTipoEvento] = useState<Processo>("admissao");
  const [dataEvento, setDataEvento] = useState("");
  const [motivo, setMotivo] = useState(MOTIVOS_DEMISSAO[0]);
  const [avisoPrevio, setAvisoPrevio] = useState<"Trabalhado" | "Indenizado">("Trabalhado");

  const [etapa, setEtapa] = useState<"form" | "termos">("form");
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [buscandoTermos, setBuscandoTermos] = useState(false);
  const [termos, setTermos] = useState<TermoAplicavel[]>([]);
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({});
  const [anexosTrm02, setAnexosTrm02] = useState<{ i: boolean; ii: boolean }>({ i: false, ii: false });
  const [eventoId, setEventoId] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [mensagemFinal, setMensagemFinal] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      setCarregandoBase(true);
      const [{ data: p }, { data: d }, { data: c }] = await Promise.all([
        supabase.from("cm_predios").select("id, nome, razao_social, cnpj").eq("ativo", true).order("nome"),
        supabase.from("rh_departamentos").select("id, codigo, nome").eq("ativo", true).order("nome"),
        supabase.from("rh_cargos").select("id, codigo, nome, departamento_id").eq("ativo", true).order("nome"),
      ]);
      setPredios((p ?? []) as PredioComEmpresa[]);
      setDepartamentos((d ?? []) as Departamento[]);
      setCargos((c ?? []) as Cargo[]);
      if (perfil && !perfil.is_admin && perfil.predio_id) {
        setPredioId(perfil.predio_id);
      }
      setCarregandoBase(false);
    }
    carregar();
  }, [perfil]);

  const cargosDoDepartamento = useMemo(
    () => cargos.filter((c) => c.departamento_id === departamentoId),
    [cargos, departamentoId]
  );

  const predioSelecionado = predios.find((p) => p.id === predioId);
  const departamentoSelecionado = departamentos.find((d) => d.id === departamentoId);
  const cargoSelecionado = cargos.find((c) => c.id === cargoId);

  async function onBuscarTermos(e: FormEvent) {
    e.preventDefault();
    setErroForm(null);

    if (!predioId || !nomeCompleto.trim() || !cpf.trim() || !departamentoId || !cargoId || !dataEvento) {
      setErroForm("Preencha todos os campos obrigatórios.");
      return;
    }

    setBuscandoTermos(true);
    try {
      const encontrados = await buscarTermosAplicaveis({
        predioId,
        departamentoId,
        cargoId,
        processo: tipoEvento,
        motivo: tipoEvento === "demissao" ? motivo : null,
      });
      setTermos(encontrados);
      const sel: Record<string, boolean> = {};
      encontrados.forEach((t) => (sel[t.id] = true));
      setSelecionados(sel);
      setAnexosTrm02({ i: false, ii: false });
      setEtapa("termos");
    } catch (err: any) {
      setErroForm(`Erro ao buscar termos: ${err.message ?? err}`);
    } finally {
      setBuscandoTermos(false);
    }
  }

  function camposVariaveis() {
    return {
      empresa: predioSelecionado?.razao_social ?? predioSelecionado?.nome ?? "",
      cnpj: predioSelecionado?.cnpj ?? "",
      nome_completo: nomeCompleto.trim(),
      cpf: cpf.trim(),
      cargo: cargoSelecionado?.nome ?? "",
      departamento: departamentoSelecionado?.nome ?? "",
      data_admissao: tipoEvento === "admissao" ? formatarDataBR(dataEvento) : "",
      data_desligamento: tipoEvento === "demissao" ? formatarDataBR(dataEvento) : "",
      motivo_desligamento: tipoEvento === "demissao" ? motivo : "",
      tipo_aviso_previo: tipoEvento === "demissao" ? avisoPrevio : "",
    };
  }

  async function onGerar() {
    setGerando(true);
    setMensagemFinal(null);
    try {
      // 1) salva o evento (auditoria)
      const { data: evt, error: errEvt } = await supabase
        .from("rh_eventos")
        .insert({
          predio_id: predioId,
          tipo_evento: tipoEvento,
          nome_completo: nomeCompleto.trim(),
          cpf: cpf.trim(),
          cargo_id: cargoId,
          departamento_id: departamentoId,
          data_evento: dataEvento,
          motivo: tipoEvento === "demissao" ? motivo : null,
          aviso_previo: tipoEvento === "demissao" ? avisoPrevio === "Trabalhado" : null,
          criado_por: perfil?.user_id ?? null,
        })
        .select("id")
        .single();
      if (errEvt) throw errEvt;
      setEventoId(evt.id);

      const campos = camposVariaveis();
      const termosParaGerar = termos.filter((t) => selecionados[t.id]);

      const arquivos: { nome: string; blob: Blob }[] = [];
      for (const t of termosParaGerar) {
        const arquivo = TEMPLATE_FILE[t.codigo];
        if (!arquivo) continue;
        const blob = await gerarDocx(arquivo, campos);
        const nomeSaida = `${t.codigo} - ${t.nome} - ${nomeCompleto.trim()}.docx`;
        arquivos.push({ nome: nomeSaida, blob });

        const { error: errTermo } = await supabase.from("rh_eventos_termos").insert({
          evento_id: evt.id,
          termo_id: t.id,
          parametros_selecionados: t.codigo === "TRM02" ? anexosTrm02 : null,
          arquivo_gerado_nome: nomeSaida,
        });
        if (errTermo) throw errTermo;

        // TRM02: gera também os anexos escolhidos
        if (t.codigo === "TRM02") {
          if (anexosTrm02.i) {
            arquivos.push({
              nome: `TRM02 - Anexo I (EPI) - ${nomeCompleto.trim()}.docx`,
              blob: await gerarDocx(TEMPLATE_FILE.TRM02_ANEXO_I, campos),
            });
          }
          if (anexosTrm02.ii) {
            arquivos.push({
              nome: `TRM02 - Anexo II (Ferramentas) - ${nomeCompleto.trim()}.docx`,
              blob: await gerarDocx(TEMPLATE_FILE.TRM02_ANEXO_II, campos),
            });
          }
        }
      }

      const gerados = arquivos.length;
      if (gerados === 1) {
        baixarBlob(arquivos[0].blob, arquivos[0].nome);
      } else if (gerados > 1) {
        const tipo = tipoEvento === "admissao" ? "Admissão" : "Demissão";
        await baixarComoZip(`Termos ${tipo} - ${nomeCompleto.trim()}.zip`, arquivos);
      }

      setMensagemFinal(
        gerados > 1
          ? `${gerados} documentos gerados e baixados em um único arquivo .zip.`
          : `${gerados} documento gerado e baixado com sucesso.`
      );
    } catch (err: any) {
      setMensagemFinal(`Erro ao gerar documentos: ${err.message ?? err}`);
    } finally {
      setGerando(false);
    }
  }

  function novoEvento() {
    setEtapa("form");
    setNomeCompleto("");
    setCpf("");
    setDepartamentoId("");
    setCargoId("");
    setDataEvento("");
    setTermos([]);
    setSelecionados({});
    setAnexosTrm02({ i: false, ii: false });
    setEventoId(null);
    setMensagemFinal(null);
  }

  if (carregandoBase) {
    return <div className="card">Carregando...</div>;
  }

  return (
    <>
        {etapa === "form" && (
          <div className="card">
            <h2>Dados do colaborador</h2>
            <form onSubmit={onBuscarTermos}>
              <label htmlFor="predio">Prédio</label>
              {perfil?.is_admin ? (
                <select id="predio" value={predioId} onChange={(e) => setPredioId(e.target.value)} required>
                  <option value="">Selecione...</option>
                  {predios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="text" value={predioSelecionado?.nome ?? ""} disabled />
              )}

              <div className="row2">
                <div>
                  <label htmlFor="nome">Nome completo</label>
                  <input
                    id="nome"
                    type="text"
                    value={nomeCompleto}
                    onChange={(e) => setNomeCompleto(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="cpf">CPF</label>
                  <input
                    id="cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="row2">
                <div>
                  <label htmlFor="departamento">Departamento</label>
                  <select
                    id="departamento"
                    value={departamentoId}
                    onChange={(e) => {
                      setDepartamentoId(e.target.value);
                      setCargoId("");
                    }}
                    required
                  >
                    <option value="">Selecione...</option>
                    {departamentos.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="cargo">Cargo</label>
                  <select
                    id="cargo"
                    value={cargoId}
                    onChange={(e) => setCargoId(e.target.value)}
                    required
                    disabled={!departamentoId}
                  >
                    <option value="">Selecione...</option>
                    {cargosDoDepartamento.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label>Processo</label>
              <div className="checkbox-row">
                <label className="checkbox-row">
                  <input
                    type="radio"
                    name="tipoEvento"
                    checked={tipoEvento === "admissao"}
                    onChange={() => setTipoEvento("admissao")}
                  />
                  Admissão
                </label>
                <label className="checkbox-row">
                  <input
                    type="radio"
                    name="tipoEvento"
                    checked={tipoEvento === "demissao"}
                    onChange={() => setTipoEvento("demissao")}
                  />
                  Demissão
                </label>
              </div>

              <div className="row2">
                <div>
                  <label htmlFor="data">
                    {tipoEvento === "admissao" ? "Data de admissão" : "Data de desligamento"}
                  </label>
                  <input
                    id="data"
                    type="date"
                    value={dataEvento}
                    onChange={(e) => setDataEvento(e.target.value)}
                    required
                  />
                </div>
                {tipoEvento === "demissao" && (
                  <div>
                    <label htmlFor="avisoPrevio">Aviso prévio</label>
                    <select
                      id="avisoPrevio"
                      value={avisoPrevio}
                      onChange={(e) => setAvisoPrevio(e.target.value as "Trabalhado" | "Indenizado")}
                    >
                      <option value="Trabalhado">Trabalhado</option>
                      <option value="Indenizado">Indenizado</option>
                    </select>
                  </div>
                )}
              </div>

              {tipoEvento === "demissao" && (
                <>
                  <label htmlFor="motivo">Motivo do desligamento</label>
                  <select id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                    {MOTIVOS_DEMISSAO.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {erroForm && <div className="erro">{erroForm}</div>}
              <button className="btn-primary" type="submit" disabled={buscandoTermos}>
                {buscandoTermos ? "Buscando termos..." : "Buscar termos aplicáveis"}
              </button>
            </form>
          </div>
        )}

        {etapa === "termos" && (
          <div className="card">
            <h2>
              Termos aplicáveis <span className="tag-empresa">{predioSelecionado?.nome}</span>
            </h2>
            <p className="muted">
              {nomeCompleto} | {cargoSelecionado?.nome} | {departamentoSelecionado?.nome}
            </p>

            {termos.length === 0 && (
              <div className="aviso">Nenhum termo cadastrado se aplica a esses critérios.</div>
            )}

            {termos.map((t) => (
              <div className="termo-item" key={t.id}>
                <div className="codigo">{t.codigo}</div>
                <h3>
                  <label className="checkbox-row" style={{ fontSize: 15, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={!!selecionados[t.id]}
                      onChange={(e) => setSelecionados((s) => ({ ...s, [t.id]: e.target.checked }))}
                    />
                    {t.nome}
                  </label>
                </h3>

                {t.codigo === "TRM02" && selecionados[t.id] && (
                  <div style={{ marginLeft: 24 }}>
                    <p style={{ fontSize: 13, margin: "4px 0" }}>Anexo(s) entregue(s) a este colaborador:</p>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={anexosTrm02.i}
                        onChange={(e) => setAnexosTrm02((a) => ({ ...a, i: e.target.checked }))}
                      />
                      Anexo I | EPI
                    </label>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={anexosTrm02.ii}
                        onChange={(e) => setAnexosTrm02((a) => ({ ...a, ii: e.target.checked }))}
                      />
                      Anexo II | Ferramentas
                    </label>
                  </div>
                )}

                {t.parametros
                  .filter((p) => t.codigo !== "TRM02")
                  .map((p) => (
                    <div key={p.id} style={{ marginLeft: 24, fontSize: 13, color: "#555" }}>
                      <em>{p.campo}</em>: preencher manualmente no documento gerado
                      {p.opcoes ? ` (opções: ${p.opcoes})` : ""}.
                    </div>
                  ))}
              </div>
            ))}

            <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
              <button className="btn-secondary" onClick={novoEvento}>
                Voltar
              </button>
              <button className="btn-primary" style={{ marginTop: 0 }} onClick={onGerar} disabled={gerando}>
                {gerando ? "Gerando..." : "Gerar e baixar documentos (.docx)"}
              </button>
            </div>

            {mensagemFinal && <div className="aviso" style={{ marginTop: 16 }}>{mensagemFinal}</div>}
            {eventoId && (
              <p style={{ fontSize: 12, color: "#888", marginTop: 12 }}>
                Registrado no histórico como evento {eventoId.slice(0, 8)}…
              </p>
            )}
          </div>
        )}
    </>
  );
}
