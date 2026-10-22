import { jsPDF } from 'jspdf'

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 15
const CONTENT_W = PAGE_W - 2 * MARGIN
// Largura máxima dos prints no PDF: mantém o arquivo abaixo do limite de envio (~3 MB).
const MAX_IMG_PX = 1600

// Nome de arquivo válido no Windows/SharePoint.
export function nomeArquivoPdf(jornadaNome, gml, data) {
  // sv-SE formata como "2026-10-22 14:05".
  const carimbo = new Date(data).toLocaleString('sv-SE').slice(0, 16).replace(':', 'h')
  return `Validacao - GML ${gml} - ${jornadaNome} - ${carimbo}.pdf`.replace(/[\\/:*?"<>|]/g, '-')
}

// Converte qualquer imagem para JPEG (reduzida até MAX_IMG_PX): o jsPDF aceita e o PDF fica bem menor.
async function paraJpeg(blob) {
  const bitmap = await createImageBitmap(blob)
  const escala = Math.min(1, MAX_IMG_PX / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return { data: canvas.toDataURL('image/jpeg', 0.8), width: canvas.width, height: canvas.height }
}

export async function gerarPdfValidacao({ jornada, prints, usuario, data, gml }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGIN

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  const titulo = doc.splitTextToSize(`Validação - ${jornada.nome}`, CONTENT_W)
  doc.text(titulo, MARGIN, y + 6)
  y += titulo.length * 8 + 4

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(`GML: ${gml}`, MARGIN, y)
  doc.text(`Validado por: ${usuario.name ?? usuario.email}`, MARGIN, y + 6)
  doc.text(`Data: ${data.toLocaleString('pt-BR')}`, MARGIN, y + 12)
  y += 22

  for (const [i, passo] of jornada.passos.entries()) {
    const img = await paraJpeg(prints[passo.id].blob)
    const maxH = PAGE_H - 2 * MARGIN - 14
    let w = CONTENT_W
    let h = (img.height * w) / img.width
    if (h > maxH) {
      h = maxH
      w = (img.width * h) / img.height
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    const linhas = doc.splitTextToSize(`${i + 1}. ${passo.titulo}`, CONTENT_W)
    const alturaTitulo = linhas.length * 6 + 3
    if (y + alturaTitulo + h > PAGE_H - MARGIN) {
      doc.addPage()
      y = MARGIN
    }
    doc.text(linhas, MARGIN, y + 5)
    y += alturaTitulo
    doc.addImage(img.data, 'JPEG', MARGIN, y, w, h)
    y += h + 10
  }

  return doc.output('blob')
}
