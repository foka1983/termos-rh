import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { SUPABASE_URL } from "./supabase";

// Mapeia o código do termo para o arquivo .docx já marcado. Os modelos ficam no bucket público
// "termos-templates" do Supabase Storage (para trocar um modelo, basta substituir o arquivo lá).
// TRM02 tem dois anexos que são arquivos físicos separados (não um único docx),
// por isso entram como chaves próprias — o chamador decide incluí-los ou não
// conforme a escolha feita em "Parâmetros do Termo".
export const TEMPLATE_FILE: Record<string, string> = {
  TRM01: "TRM01.docx",
  TRM02: "TRM02.docx",
  TRM02_ANEXO_I: "TRM02_Anexo_I.docx",
  TRM02_ANEXO_II: "TRM02_Anexo_II.docx",
  TRM03: "TRM03.docx",
  TRM04: "TRM04.docx",
  TRM05: "TRM05.docx",
  TRM06: "TRM06.docx",
  TRM07: "TRM07.docx",
  TRM08: "TRM08.docx",
  TRM09: "TRM09.docx",
  TRM10: "TRM10.docx",
  TRM11: "TRM11.docx",
};

export interface CamposVariaveis {
  empresa?: string | null;
  cnpj?: string | null;
  nome_completo?: string | null;
  cpf?: string | null;
  cargo?: string | null;
  departamento?: string | null;
  data_admissao?: string | null;
  data_desligamento?: string | null;
  motivo_desligamento?: string | null;
  tipo_aviso_previo?: string | null;
}

async function fetchTemplateBuffer(fileName: string): Promise<ArrayBuffer> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/termos-templates/${encodeURIComponent(fileName)}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Não foi possível carregar o modelo "${fileName}" (HTTP ${res.status})`);
  }
  return res.arrayBuffer();
}

/**
 * Gera um .docx preenchido a partir de um template já marcado com {{tags}}.
 * Retorna um Blob pronto para download. Campos ausentes viram string vazia
 * (não quebram a geração — o campo fica em branco no documento).
 */
export async function gerarDocx(fileName: string, campos: CamposVariaveis): Promise<Blob> {
  const buffer = await fetchTemplateBuffer(fileName);
  const zip = new PizZip(buffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });

  doc.render({
    empresa: campos.empresa ?? "",
    cnpj: campos.cnpj ?? "",
    nome_completo: campos.nome_completo ?? "",
    cpf: campos.cpf ?? "",
    cargo: campos.cargo ?? "",
    departamento: campos.departamento ?? "",
    data_admissao: campos.data_admissao ?? "",
    data_desligamento: campos.data_desligamento ?? "",
    motivo_desligamento: campos.motivo_desligamento ?? "",
    tipo_aviso_previo: campos.tipo_aviso_previo ?? "",
  });

  const out = doc.getZip().generate({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  return out as Blob;
}

export function baixarBlob(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function formatarDataBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Empacota vários arquivos em um único .zip e baixa. */
export async function baixarComoZip(nomeZip: string, arquivos: { nome: string; blob: Blob }[]) {
  const zip = new PizZip();
  const usados = new Set<string>();
  for (const a of arquivos) {
    let nome = a.nome.replace(/[\\/:*?"<>|]/g, "-");
    let n = 2;
    while (usados.has(nome)) nome = nome.replace(/(\.docx)$/, ` (${n++})$1`);
    usados.add(nome);
    zip.file(nome, await a.blob.arrayBuffer());
  }
  const blob = zip.generate({ type: "blob", mimeType: "application/zip" }) as Blob;
  baixarBlob(blob, nomeZip);
}
