import { FormEvent, useState } from "react";
import { useAuth } from "../lib/auth";
import Logo from "../components/Logo";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const msg = await signIn(email.trim(), senha);
    setCarregando(false);
    if (msg) {
      const semConexao = /fetch|network|failed to fetch/i.test(msg);
      setErro(
        semConexao
          ? "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente."
          : "E-mail ou senha inválidos."
      );
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-logo">
          <Logo variant="escuro" height={40} />
        </div>
        <h1>Termos de RH | JFL</h1>
        <p>Entre com o login do seu prédio.</p>
        <form onSubmit={onSubmit}>
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            required
          />
          {erro && <div className="erro">{erro}</div>}
          <button className="btn-primary" type="submit" disabled={carregando} style={{ width: "100%" }}>
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
