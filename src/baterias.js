import { zipSync } from 'fflate'
import { apiBlob } from './api.js'

// Status da bateria, derivado do link salvo e do total de validações concluídas.
export function statusBateria({ link_pasta, total, concluidas }) {
  if (link_pasta) return { id: 'concluida', label: 'Concluída', className: 'status-concluida' }
  if (total > 0 && concluidas === total) {
    return { id: 'aguardando_upload', label: 'Aguardando Upload', className: 'status-upload' }
  }
  return { id: 'em_andamento', label: 'Em andamento', className: 'status-andamento' }
}

const nomeSeguro = (texto) => texto.replace(/[\\/:*?"<>|]/g, '-').trim()

export const nomePasta = (gml) => nomeSeguro(`Validacao GML ${gml}`)

// Monta o .zip da bateria: uma pasta com o PDF de cada jornada concluída.
export async function gerarZipBateria(bateria) {
  const pasta = nomePasta(bateria.gml)
  const arquivos = {}
  for (const e of bateria.execucoes.filter((x) => x.status === 'concluida')) {
    const pdf = new Uint8Array(await (await apiBlob(`execucoes/${e.id}`)).arrayBuffer())
    // PDFs já são comprimidos: guardar sem recomprimir (level 0) é mais rápido.
    arquivos[`${pasta}/${nomeSeguro(e.jornada_nome)}.pdf`] = [pdf, { level: 0 }]
  }
  return new Blob([zipSync(arquivos)], { type: 'application/zip' })
}
