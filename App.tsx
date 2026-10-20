import { useState } from "react";
import { useAuth } from "./lib/auth";
import Login from "./pages/Login";
import TrocarSenha from "./pages/TrocarSenha";
import Wizard from "./pages/Wizard";
import Historico from "./pages/Historico";
import Usuarios from "./pages/Usuarios";
import Logo from "./components/Logo";

type Aba = "novo" | "historico" | "usuarios";

function Caixa({ titulo, texto, sair }: { titulo: string; texto: string; sair?: () => void }) {
  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-logo">
          <Logo variant="escuro" height={40} />
        </div>
        <h1>{titulo}</h1>
        <p>{texto}</p>
        {sair && (
          <button className="btn-secondary" style={{ width: "100%" }} onClick={sair}>
            Sair
          </button>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const { loading, session, perfil, signOut } = useAuth();
  const [aba, setAba] = useState<Aba>("novo");

  if (loading) return <Caixa titulo="Termos de RH | JFL" texto="Carregando..." />;
  if (!session) return <Login />;

  if (!perfil) {
    return (
      <Caixa
        titulo="Acesso não liberado"
        texto="Seu login ainda não está vinculado a um prédio. Fale com o administrador."
        sair={() => signOut()}
      />
    );
  }
  if (perfil.ativo === false) {
    return (
      <Caixa
        titulo="Acesso desativado"
        texto="Seu acesso a este sistema foi desativado. Fale com o administrador."
        sair={() => signOut()}
      />
    );
  }
  if (perfil.must_change_password) return <TrocarSenha />;

  const abas: { id: Aba; nome: string }[] = [
    { id: "novo", nome: "Novo termo" },
    { id: "historico", nome: "Histórico" },
    ...(perfil.is_admin ? [{ id: "usuarios" as Aba, nome: "Usuários" }] : []),
  ];
  const abaAtiva: Aba = abas.some((a) => a.id === aba) ? aba : "novo";

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <Logo variant="claro" height={26} />
          <h1>Termos de RH | JFL</h1>
        </div>
        <div className="who">
          <span>
            {perfil.nome}
            {perfil.is_admin ? " | Administrador" : ""}
          </span>
          <button onClick={() => signOut()}>Sair</button>
        </div>
      </header>

      <nav className="tabs" aria-label="Seções">
        {abas.map((a) => (
          <button
            key={a.id}
            className={`tab ${abaAtiva === a.id ? "ativa" : ""}`}
            onClick={() => setAba(a.id)}
          >
            {a.nome}
          </button>
        ))}
      </nav>

      <main className={`container ${abaAtiva === "novo" ? "" : "largo"}`}>
        {abaAtiva === "novo" && <Wizard />}
        {abaAtiva === "historico" && <Historico />}
        {abaAtiva === "usuarios" && perfil.is_admin && <Usuarios />}
      </main>
    </>
  );
}
