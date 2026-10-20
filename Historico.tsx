import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { formatarDataBR } from "../lib/generate";

interface Evento {
  id: string;
  predio_id: string;
  tipo_evento: "admissao" | "demissao";
  nome_completo: string;
  cargo_id: string | null;
  data_evento: string;
  motivo: string | null;
  criado_por: string | null;
  created_at: string;
}

function dataHora(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function Historico() {
  const { perfil } = useAuth();
  const isAdmin = !!perfil?.is_admin;

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [predios, setPredios] = useState<Record<string, string>>({});
  const [cargos, setCargos] = useState<Record<string, string>>({});
  const [autores, setAutores] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      // Sem filtro de prédio: as regras de acesso (RLS) já limitam cada login ao seu prédio.
      const { data, error } = await supabase
        .from("rh_eventos")
        .select("id, predio_id, tipo_evento, nome_completo, cargo_id, data_evento, motivo, criado_por, created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      setEventos((data ?? []) as Evento[]);

      const [{ data: p }, { data: c }, { data: u }] = await Promise.all([
        supabase.from("cm_predios").select("id, nome"),
        supabase.from("rh_cargos").select("id, nome"),
        supabase.from("rh_usuarios_predios").select("user_id, nome"),
      ]);
      setPredios(Object.fromEntries((p ?? []).map((x: any) => [x.id, x.nome])));
      setCargos(Object.fromEntries((c ?? []).map((x: any) => [x.id, x.nome])));
      setAutores(Object.fromEntries((u ?? []).map((x: any) => [x.user_id, x.nome])));
    } catch (e: any) {
      setErro(`Erro ao carregar o histórico: ${e.message ?? e}`);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function excluir(id: string) {
    setExcluindoId(id);
    setErro(null);
    try {
      const { data, error } = await supabase.from("rh_eventos").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Sem permissão para excluir este registro.");
      setEventos((l) => l.filter((e) => e.id !== id));
    } catch (e: any) {
      setErro(`Erro ao excluir: ${e.message ?? e}`);
    } finally {
      setExcluindoId(null);
      setConfirmandoId(null);
    }
  }

  const termo = busca.trim().toLowerCase();
  const lista = termo
    ? eventos.filter(
        (e) =>
          e.nome_completo.toLowerCase().includes(termo) ||
          (cargos[e.cargo_id ?? ""] ?? "").toLowerCase().includes(termo) ||
          (predios[e.predio_id] ?? "").toLowerCase().includes(termo)
      )
    : eventos;

  return (
    <div className="card">
      <div className="card-head">
        <h2>Histórico de termos gerados</h2>
        <input
          type="text"
          className="busca"
          placeholder="Buscar por nome, cargo ou prédio"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>
      {erro && <div className="erro">{erro}</div>}
      {carregando ? (
        <p className="muted">Carregando...</p>
      ) : lista.length === 0 ? (
        <p className="muted">Nenhum registro encontrado.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>Gerado em</th>
                <th>Colaborador</th>
                <th>Processo</th>
                <th>Cargo</th>
                <th>Data</th>
                {isAdmin && <th>Prédio</th>}
                {isAdmin && <th>Gerado por</th>}
                {isAdmin && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.id}>
                  <td>{dataHora(e.created_at)}</td>
                  <td>{e.nome_completo}</td>
                  <td>{e.tipo_evento === "admissao" ? "Admissão" : "Demissão"}</td>
                  <td>{cargos[e.cargo_id ?? ""] ?? ""}</td>
                  <td>{formatarDataBR(e.data_evento)}</td>
                  {isAdmin && <td>{predios[e.predio_id] ?? ""}</td>}
                  {isAdmin && <td>{autores[e.criado_por ?? ""] ?? ""}</td>}
                  {isAdmin && (
                    <td className="acoes">
                      {confirmandoId === e.id ? (
                        <>
                          <span className="confirma">Excluir?</span>
                          <button className="link-perigo" disabled={excluindoId === e.id} onClick={() => excluir(e.id)}>
                            {excluindoId === e.id ? "Excluindo..." : "Sim"}
                          </button>
                          <button className="link" onClick={() => setConfirmandoId(null)}>
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button className="link-perigo" onClick={() => setConfirmandoId(e.id)}>
                          Excluir
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ marginTop: 12 }}>
        {isAdmin
          ? "Como administrador, você vê o histórico de todos os prédios e pode excluir registros."
          : "Você vê apenas os registros do seu prédio."}
      </p>
    </div>
  );
}
