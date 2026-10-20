import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

interface UsuarioLinha {
  user_id: string;
  nome: string;
  email: string | null;
  predio_id: string | null;
  predio_nome: string | null;
  is_admin: boolean;
  ativo: boolean;
  must_change_password: boolean;
  ultimo_acesso: string | null;
}
interface PredioOpt {
  id: string;
  nome: string;
}
interface Formulario {
  user_id: string | null; // null = novo
  nome: string;
  email: string;
  predio_id: string;
  is_admin: boolean;
}

const FORM_VAZIO: Formulario = { user_id: null, nome: "", email: "", predio_id: "", is_admin: false };

// Chama a função segura do servidor (só administradores são aceitos lá).
async function chamar(action: string, dados: Record<string, unknown> = {}): Promise<any> {
  const { data, error } = await supabase.functions.invoke("rh-admin-usuarios", { body: { action, ...dados } });
  if (error) {
    let msg = error.message;
    try {
      const corpo = await (error as any).context?.json?.();
      if (corpo?.error) msg = corpo.error;
    } catch {
      /* mantém a mensagem padrão */
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

function dataCurta(iso: string | null) {
  if (!iso) return "Nunca acessou";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function Usuarios() {
  const { perfil } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioLinha[]>([]);
  const [predios, setPredios] = useState<PredioOpt[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<Formulario | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<{ id: string; acao: "reset" | "ativo" } | null>(null);
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const [res, { data: p }] = await Promise.all([
        chamar("list"),
        supabase.from("cm_predios").select("id, nome").eq("ativo", true).order("nome"),
      ]);
      setUsuarios(res.usuarios as UsuarioLinha[]);
      setPredios((p ?? []) as PredioOpt[]);
    } catch (e: any) {
      setErro(`Erro ao carregar usuários: ${e.message ?? e}`);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return usuarios;
    return usuarios.filter(
      (u) =>
        u.nome.toLowerCase().includes(t) ||
        (u.email ?? "").toLowerCase().includes(t) ||
        (u.predio_nome ?? "").toLowerCase().includes(t)
    );
  }, [usuarios, busca]);

  function novo() {
    setAviso(null);
    setErroForm(null);
    setForm({ ...FORM_VAZIO });
  }
  function editar(u: UsuarioLinha) {
    setAviso(null);
    setErroForm(null);
    setForm({
      user_id: u.user_id,
      nome: u.nome,
      email: u.email ?? "",
      predio_id: u.predio_id ?? "",
      is_admin: u.is_admin,
    });
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setErroForm(null);
    if (form.nome.trim().length < 3) return setErroForm("Informe o nome completo.");
    if (!form.user_id && !form.email.trim()) return setErroForm("Informe o e-mail.");
    if (!form.is_admin && !form.predio_id) return setErroForm("Selecione o prédio do usuário.");

    setSalvando(true);
    try {
      if (form.user_id) {
        await chamar("update", {
          user_id: form.user_id,
          nome: form.nome.trim(),
          predio_id: form.predio_id || null,
          is_admin: form.is_admin,
        });
        setAviso(`Dados de ${form.nome.trim()} atualizados.`);
      } else {
        const r = await chamar("create", {
          nome: form.nome.trim(),
          email: form.email.trim(),
          predio_id: form.predio_id || null,
          is_admin: form.is_admin,
        });
        setAviso(
          r.vinculado
            ? `${form.nome.trim()} já tinha conta no sistema e foi vinculado(a) aos Termos de RH. A senha atual dela(e) foi mantida.`
            : `Usuário criado. Senha provisória: ${r.senha_provisoria} (será trocada no primeiro acesso).`
        );
      }
      setForm(null);
      await carregar();
    } catch (e: any) {
      setErroForm(e.message ?? String(e));
    } finally {
      setSalvando(false);
    }
  }

  async function redefinir(u: UsuarioLinha) {
    setProcessandoId(u.user_id);
    setErro(null);
    setAviso(null);
    try {
      const r = await chamar("reset_password", { user_id: u.user_id });
      setAviso(`Senha de ${u.nome} redefinida para a provisória: ${r.senha_provisoria}. Ela será trocada no próximo acesso.`);
      await carregar();
    } catch (e: any) {
      setErro(e.message ?? String(e));
    } finally {
      setProcessandoId(null);
      setConfirmando(null);
    }
  }

  async function alternarAtivo(u: UsuarioLinha) {
    setProcessandoId(u.user_id);
    setErro(null);
    setAviso(null);
    try {
      await chamar("update", { user_id: u.user_id, ativo: !u.ativo });
      setAviso(u.ativo ? `Acesso de ${u.nome} desativado.` : `Acesso de ${u.nome} reativado.`);
      await carregar();
    } catch (e: any) {
      setErro(e.message ?? String(e));
    } finally {
      setProcessandoId(null);
      setConfirmando(null);
    }
  }

  return (
    <>
      {form && (
        <div className="card">
          <h2>{form.user_id ? "Editar usuário" : "Novo usuário"}</h2>
          <form onSubmit={salvar}>
            <div className="row2">
              <div>
                <label htmlFor="u-nome">Nome completo</label>
                <input id="u-nome" type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
              </div>
              <div>
                <label htmlFor="u-email">E-mail (login)</label>
                <input
                  id="u-email"
                  type="text"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={!!form.user_id}
                  required
                />
              </div>
            </div>
            <div className="row2">
              <div>
                <label htmlFor="u-predio">Prédio {form.is_admin ? "(opcional para administrador)" : ""}</label>
                <select id="u-predio" value={form.predio_id} onChange={(e) => setForm({ ...form, predio_id: e.target.value })}>
                  <option value="">{form.is_admin ? "Todos os prédios" : "Selecione..."}</option>
                  {predios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Perfil</label>
                <div className="checkbox-row" style={{ gap: 20, marginTop: 10 }}>
                  <label className="checkbox-row">
                    <input
                      type="radio"
                      name="perfil"
                      checked={!form.is_admin}
                      onChange={() => setForm({ ...form, is_admin: false })}
                      disabled={form.user_id === perfil?.user_id}
                    />
                    Comum (só o prédio dele)
                  </label>
                  <label className="checkbox-row">
                    <input type="radio" name="perfil" checked={form.is_admin} onChange={() => setForm({ ...form, is_admin: true })} />
                    Administrador
                  </label>
                </div>
              </div>
            </div>
            {!form.user_id && (
              <p className="muted">
                O usuário entra com a senha provisória e será obrigado a trocá-la no primeiro acesso.
              </p>
            )}
            {erroForm && <div className="erro">{erroForm}</div>}
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button type="button" className="btn-secondary" onClick={() => setForm(null)}>
                Cancelar
              </button>
              <button className="btn-primary compacto" type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : form.user_id ? "Salvar alterações" : "Cadastrar usuário"}
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="card">
        <div className="card-head">
          <h2>Usuários</h2>
          <div className="card-head-acoes">
            <input
              type="text"
              className="busca"
              placeholder="Buscar por nome, e-mail ou prédio"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <button className="btn-primary compacto" onClick={novo}>
              Novo usuário
            </button>
          </div>
        </div>

        {aviso && <div className="aviso">{aviso}</div>}
        {erro && <div className="erro">{erro}</div>}

        {carregando ? (
          <p className="muted">Carregando...</p>
        ) : (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Prédio</th>
                  <th>Perfil</th>
                  <th>Situação</th>
                  <th>Último acesso</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((u) => {
                  const eu = u.user_id === perfil?.user_id;
                  const conf = confirmando?.id === u.user_id ? confirmando.acao : null;
                  return (
                    <tr key={u.user_id} className={u.ativo ? "" : "inativo"}>
                      <td>
                        {u.nome}
                        {eu && <span className="tag"> você</span>}
                      </td>
                      <td>{u.email ?? ""}</td>
                      <td>{u.predio_nome ?? (u.is_admin ? "Todos" : "")}</td>
                      <td>{u.is_admin ? "Administrador" : "Comum"}</td>
                      <td>
                        {!u.ativo ? "Desativado" : u.must_change_password ? "Aguardando 1º acesso" : "Ativo"}
                      </td>
                      <td>{dataCurta(u.ultimo_acesso)}</td>
                      <td className="acoes">
                        {conf === "reset" ? (
                          <>
                            <span className="confirma">Redefinir senha?</span>
                            <button className="link-perigo" disabled={processandoId === u.user_id} onClick={() => redefinir(u)}>
                              Sim
                            </button>
                            <button className="link" onClick={() => setConfirmando(null)}>
                              Cancelar
                            </button>
                          </>
                        ) : conf === "ativo" ? (
                          <>
                            <span className="confirma">{u.ativo ? "Desativar?" : "Reativar?"}</span>
                            <button className="link-perigo" disabled={processandoId === u.user_id} onClick={() => alternarAtivo(u)}>
                              Sim
                            </button>
                            <button className="link" onClick={() => setConfirmando(null)}>
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="link" onClick={() => editar(u)}>
                              Editar
                            </button>
                            {!eu && (
                              <>
                                <button className="link" onClick={() => setConfirmando({ id: u.user_id, acao: "reset" })}>
                                  Redefinir senha
                                </button>
                                <button className="link-perigo" onClick={() => setConfirmando({ id: u.user_id, acao: "ativo" })}>
                                  {u.ativo ? "Desativar" : "Reativar"}
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ marginTop: 12 }}>
          {usuarios.length} usuário(s). Desativar bloqueia o acesso a este sistema sem apagar o histórico.
        </p>
      </div>

    </>
  );
}
