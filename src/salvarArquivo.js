// Chrome/Edge: janela "Salvar como" que lembra a última pasta (ex.: pasta do SharePoint
// sincronizada pelo OneDrive). Outros navegadores: download comum.
// Precisa ser chamado direto no clique, antes de qualquer espera longa.
const PDF = { description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }
export const ZIP = { description: 'Pasta compactada (.zip)', accept: { 'application/zip': ['.zip'] } }

export async function escolherDestino(nomeSugerido, tipo = PDF) {
  if (!('showSaveFilePicker' in window)) return { download: nomeSugerido }
  try {
    return await window.showSaveFilePicker({
      id: 'validacoes-pdf',
      suggestedName: nomeSugerido,
      types: [tipo],
    })
  } catch (err) {
    if (err.name === 'AbortError') return null
    throw err
  }
}

export async function gravar(destino, blob) {
  if (destino.download) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = destino.download
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return
  }
  const writable = await destino.createWritable()
  await writable.write(blob)
  await writable.close()
}
