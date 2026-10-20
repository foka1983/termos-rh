# Termos de RH — JFL

Aplicação interna para gerar automaticamente os termos (admissão/demissão) que cada
colaborador precisa assinar, com base no prédio, departamento e cargo. Preenche os
campos conhecidos (empresa, CNPJ, nome, CPF, cargo, departamento, data) direto nos
modelos Word reais e gera arquivos **.docx editáveis** (não PDF) para impressão,
conferência de itens/checkboxes e assinatura manual.

## Como funciona

1. O RH do prédio faz login (ou um Administrador, que enxerga todos os prédios).
2. Preenche os dados do colaborador e escolhe Admissão ou Demissão.
3. O sistema busca, nas tabelas de regras do Supabase, quais termos se aplicam
   àquele departamento/cargo/prédio (e, em caso de demissão, ao motivo informado).
4. A pessoa confere a lista de termos aplicáveis (pode desmarcar algum se necessário)
   e clica em "Gerar e baixar documentos". Cada termo é baixado como `.docx` já
   preenchido nos campos conhecidos — os itens de lista, checkboxes de EPI/ferramentas
   e assinaturas continuam em branco para preenchimento manual.
5. Cada geração fica registrada (auditoria) nas tabelas `rh_eventos` /
   `rh_eventos_termos` no Supabase.

## Stack

- **Frontend:** Vite + React + TypeScript, 100% estático (sem servidor próprio).
- **Geração dos .docx:** `docxtemplater` + `pizzip`, rodando no navegador — os
  modelos ficam no bucket público `termos-templates` do Supabase Storage e são preenchidos localmente, sem
  precisar de backend próprio.
- **Banco/autenticação:** Supabase (projeto compartilhado já existente da JFL),
  com Row Level Security: cada login só enxerga os dados do seu prédio; os dois
  Administradores enxergam tudo.
- **Hospedagem:** Vercel (projeto `jfl-termos-rh-v4`, sempre o mesmo link).

## Rodando localmente

Pré-requisito: Node.js 18 ou superior.

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

Para gerar a versão de produção (o que o Cloudflare Pages faz automaticamente a
cada push):

```bash
npm run build
```

Os arquivos finais ficam em `dist/`.

## Sobre o arquivo `.env`

O arquivo `.env` já vem com a URL do projeto Supabase e a chave pública
(`sb_publishable_...`). Essa chave é segura para ficar exposta no navegador —
ela não dá acesso a nada além do que as políticas de Row Level Security
permitirem para o usuário logado. Por isso ela foi commitada normalmente (não
está no `.gitignore`).

## Publicando no GitHub + Cloudflare Pages

Este ambiente onde a aplicação foi construída não tem acesso à sua conta do
GitHub, então esses dois passos precisam ser feitos por você (uma única vez):

1. **Criar o repositório no GitHub** (pode ser privado):
   - Crie um repositório vazio, por exemplo `jfl-termos-rh`.
   - Dentro da pasta do projeto:
     ```bash
     git remote add origin https://github.com/SEU_USUARIO/jfl-termos-rh.git
     git branch -M main
     git push -u origin main
     ```
   (O projeto já vem com um commit inicial pronto.)

2. **Conectar ao Cloudflare Pages:**
   - No painel da Cloudflare, vá em **Workers & Pages → Create → Pages → Connect to Git**.
   - Selecione o repositório `jfl-termos-rh`.
   - Configuração de build:
     - **Framework preset:** Vite
     - **Build command:** `npm run build`
     - **Build output directory:** `dist`
   - Não é necessário configurar variáveis de ambiente adicionais — o `.env`
     já commitado é suficiente. Se preferir defini-las também pelo painel (boa
     prática, mas opcional), os nomes são `VITE_SUPABASE_URL` e
     `VITE_SUPABASE_ANON_KEY`.
   - Clique em **Save and Deploy**. Toda vez que você der `git push`, o
     Cloudflare Pages publica a nova versão automaticamente.

## Contas de acesso

As 17 contas (15 dos prédios + 2 Administradoras) já foram criadas no Supabase
com a senha provisória `jfl12345678@` e `must_change_password = true` — ou
seja, no primeiro login o sistema obriga a pessoa a trocar a senha antes de
liberar o uso.

| Prédio  | Perfis com acesso |
|---|---|
| AVNU | 3 logins |
| JFL 125 | 3 logins |
| JML747 | 3 logins |
| VHouse | 3 logins |
| VO699 | 3 logins |
| Administrador (todos os prédios + edição das regras) | Fernanda Okamoto, Rafaela Melo |

## O que ainda falta / decisões em aberto para o v1

- **Edição das regras (quais termos se aplicam a qual cargo/departamento):**
  o v1 não tem uma tela própria para isso. Como solução provisória, as
  Administradoras podem editar diretamente as tabelas `rh_termos`,
  `rh_termos_departamentos`, `rh_termos_cargos`, `rh_cargos` e
  `rh_departamentos` pelo **Table Editor do Supabase**. Se fizer sentido, dá
  para construir uma tela de administração dentro do próprio app depois.
- **Termos de demissão:** a estrutura (tabelas, motivo do desligamento, aviso
  prévio) já está pronta, mas os modelos reais desses termos ainda não foram
  enviados. Assim que enviar os arquivos, é só tagueá-los e cadastrá-los.
- **Assinatura eletrônica:** fora do escopo do v1, como combinado — os
  documentos saem em `.docx` para assinatura manual/física.

## Verificações feitas antes da entrega

- `npm run build` roda limpo (TypeScript + Vite), sem erros.
- Todas as 17 contas foram conferidas diretamente no banco: login vinculado ao
  prédio certo, papel de Administrador correto nas duas contas certas.
- As políticas de segurança (RLS) foram revisadas com o assessor de segurança
  do Supabase, sem pendências nas tabelas novas.
- Não foi possível, a partir deste ambiente, fazer um teste de login "ao
  vivo" ponta a ponta contra o Supabase de produção (a política de rede deste
  ambiente bloqueia esse acesso direto) — recomenda-se um teste manual rápido
  logo após o primeiro deploy, testando um login de prédio e um de
  Administrador.


## Abas do sistema

- **Novo termo:** fluxo de geração dos documentos (vários termos saem em um único .zip).
- **Histórico:** registros gerados. Cada prédio vê só os seus; administradores veem todos e podem excluir registros.
- **Usuários (somente administradores):** cadastrar, editar nome/prédio/perfil, redefinir senha para a provisória
  e desativar/reativar acesso. Toda a operação passa pela função segura `rh-admin-usuarios` (Supabase Edge
  Function), que confere no servidor se quem chamou é administrador ativo. Nenhuma chave secreta fica no navegador.
- Usuário desativado (`ativo = false`) perde o acesso aos dados e vê a tela "Acesso desativado".
