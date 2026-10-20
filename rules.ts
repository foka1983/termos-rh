import { supabase } from "./supabase";
import type { ParametroTermo, Processo, Termo } from "./types";

export interface TermoAplicavel extends Termo {
  parametros: ParametroTermo[];
}

export interface CriteriosSelecao {
  predioId: string;
  departamentoId: string;
  cargoId: string;
  processo: Processo;
  motivo?: string | null;
}

/**
 * Determina quais termos se aplicam a um colaborador, seguindo a regra fixa
 * cadastrada em rh_termos (+ rh_termos_departamentos / _cargos / _predios).
 *
 * Regra: um termo se aplica quando processo bate E (aplica_todos_X OU existe
 * um vínculo específico para o departamento/cargo/prédio do colaborador).
 * Para demissão, o motivo também precisa bater com motivo_condicao
 * ("Todos os motivos" cobre qualquer motivo).
 */
export async function buscarTermosAplicaveis(
  criterios: CriteriosSelecao
): Promise<TermoAplicavel[]> {
  const { predioId, departamentoId, cargoId, processo, motivo } = criterios;

  const { data: termos, error: errTermos } = await supabase
    .from("rh_termos")
    .select("*")
    .eq("processo", processo)
    .eq("ativo", true);
  if (errTermos) throw errTermos;
  const todosTermos = (termos ?? []) as Termo[];
  if (todosTermos.length === 0) return [];

  const termoIds = todosTermos.map((t) => t.id);

  const [
    { data: vinculosDept, error: e1 },
    { data: vinculosCargo, error: e2 },
    { data: vinculosPredio, error: e3 },
    { data: parametros, error: e4 },
  ] = await Promise.all([
    supabase.from("rh_termos_departamentos").select("termo_id, departamento_id").in("termo_id", termoIds),
    supabase.from("rh_termos_cargos").select("termo_id, cargo_id").in("termo_id", termoIds),
    supabase.from("rh_termos_predios").select("termo_id, predio_id").in("termo_id", termoIds),
    supabase.from("rh_parametros_termo").select("*").in("termo_id", termoIds),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;
  if (e4) throw e4;

  const deptSet = new Set((vinculosDept ?? []).map((v) => `${v.termo_id}:${v.departamento_id}`));
  const cargoSet = new Set((vinculosCargo ?? []).map((v) => `${v.termo_id}:${v.cargo_id}`));
  const predioSet = new Set((vinculosPredio ?? []).map((v) => `${v.termo_id}:${v.predio_id}`));

  const aplicaveis = todosTermos.filter((t) => {
    const okDept = t.aplica_todos_departamentos || deptSet.has(`${t.id}:${departamentoId}`);
    const okCargo = t.aplica_todos_cargos || cargoSet.has(`${t.id}:${cargoId}`);
    const okPredio = t.aplica_todos_predios || predioSet.has(`${t.id}:${predioId}`);

    let okMotivo = true;
    if (processo === "demissao") {
      const cond = t.motivo_condicao;
      if (cond && cond !== "Todos os motivos" && cond !== "Não se aplica") {
        okMotivo = !!motivo && motivo === cond;
      }
    }

    return okDept && okCargo && okPredio && okMotivo;
  });

  const paramsPorTermo = new Map<string, ParametroTermo[]>();
  for (const p of (parametros ?? []) as ParametroTermo[]) {
    const lista = paramsPorTermo.get(p.termo_id) ?? [];
    lista.push(p);
    paramsPorTermo.set(p.termo_id, lista);
  }

  return aplicaveis.map((t) => ({ ...t, parametros: paramsPorTermo.get(t.id) ?? [] }));
}
