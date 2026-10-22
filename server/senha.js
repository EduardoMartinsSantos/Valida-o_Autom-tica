// Mesmas regras de senha da Nova Escala (lib/auth.js de nova_escala):
// senha_hash "scrypt$salt$hash" ou, se NULL, a senha padrão da equipe (SENHA_PADRAO).
import crypto from 'node:crypto'
import { HttpError } from './http.js'

// Compara em tempo constante, mesmo com tamanhos diferentes.
function iguais(a, b) {
  const h = (v) => crypto.createHash('sha256').update(String(v)).digest()
  return crypto.timingSafeEqual(h(a), h(b))
}

function conferirHash(senha, armazenado) {
  const [alg, salt, hash] = String(armazenado || '').split('$')
  if (alg !== 'scrypt' || !salt || !hash) return false
  const calculado = crypto.scryptSync(senha, Buffer.from(salt, 'base64url'), 32)
  const esperado = Buffer.from(hash, 'base64url')
  return esperado.length === calculado.length && crypto.timingSafeEqual(calculado, esperado)
}

export function senhaConfere(senha, senhaHash) {
  if (senhaHash) return conferirHash(senha, senhaHash)
  const padrao = process.env.SENHA_PADRAO
  if (!padrao) throw new HttpError(500, 'SENHA_PADRAO não configurada no servidor.')
  return iguais(senha, padrao)
}
