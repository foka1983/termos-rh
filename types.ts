export type Processo = "admissao" | "demissao";

export interface Predio {
  id: string;
  nome: string;
}

export interface Departamento {
  id: string;
  codigo: string;
  nome: string;
}

export interface Cargo {
  id: string;
  codigo: string;
  nome: string;
  departamento_id: string | null;
}

export interface Termo {
  id: string;
  codigo: string;
  nome: string;
  processo: Processo;
  arquivo_template: string | null;
  aplica_todos_departamentos: boolean;
  aplica_todos_cargos: boolean;
  aplica_todos_predios: boolean;
  motivo_condicao: string | null;
  ativo: boolean;
}

export interface ParametroTermo {
  id: string;
  termo_id: string;
  campo: string;
  tipo_resposta: string;
  opcoes: string | null;
  descricao: string | null;
}

export interface UsuarioPredio {
  user_id: string;
  predio_id: string | null;
  nome: string;
  is_admin: boolean;
  must_change_password: boolean;
  ativo: boolean;
}

export interface EventoInput {
  predio_id: string;
  tipo_evento: Processo;
  nome_completo: string;
  cpf: string;
  cargo_id: string;
  departamento_id: string;
  data_evento: string; // yyyy-mm-dd
  motivo?: string | null;
  aviso_previo?: boolean | null;
}
