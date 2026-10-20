import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import Logo from "../components/Logo";

export default function TrocarSenha() {
  const { session, refreshPerfil, signOut } = useAuth();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmar) {
      setErro("As senhas não conferem.");
      return;
    }
    setCarregando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) {
      setErro(
        /same|different from the old/i.test(error.message)
          ? "A nova senha precisa ser diferente da senha provisória."
          : error.message
      );
      setCarregando(false);
      return;
    }
    if (session?.user) {
      const { data: atualizado, error: errFlag } = await supabase
        .from("rh_usuarios_predios")
        .update({ must_change_password: false })
        .eq("user_id", session.user.id)
        .select("user_id");
      if (errFlag || !atualizado || atualizado.length === 0) {
        setErro("Senha alterada, mas não foi possível concluir o primeiro acesso. Saia e entre novamente com a nova senha.");
        setCarregando(false);
        return;
      }
    }
    await refreshPerfil();
    setCarregando(false);
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-logo"><Logo variant="escuro" height={40} /></div>
        <h1>Troque sua senha</h1>
        <p>Este é seu primeiro acesso. Defina uma senha nova antes de continuar.</p>
        <form onSubmit={onSubmit}>
          <label htmlFor="senha">Nova senha</label>
          <input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="new-password"
            required
          />
          <label htmlFor="confirmar">Confirmar nova senha</label>
          <input
            id="confirmar"
            type="password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            autoComplete="new-password"
            required
          />
          {erro && <div className="erro">{erro}</div>}
          <button className="btn-primary" type="submit" disabled={carregando} style={{ width: "100%" }}>
            {carregando ? "Salvando..." : "Salvar e continuar"}
          </button>
        </form>
        <button className="btn-secondary" style={{ marginTop: 16, width: "100%" }} onClick={() => signOut()}>
          Sair
        </button>
      </div>
    </div>
  );
}
