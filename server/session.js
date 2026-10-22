import crypto from 'node:crypto'
import { HttpError } from './http.js'

const COOKIE = 'validacao_session'
const MAX_AGE_S = 12 * 60 * 60

function secret() {
  const value = process.env.SESSION_SECRET
  if (!value || value.length < 32) throw new Error('SESSION_SECRET ausente ou com menos de 32 caracteres.')
  return value
}

const sign = (data) => crypto.createHmac('sha256', secret()).update(data).digest('base64url')

function cookie(value, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${COOKIE}=${value}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`
}

export function setSession(res, user) {
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    name: user.name,
    email: user.email,
    exp: Date.now() + MAX_AGE_S * 1000,
  })).toString('base64url')
  res.setHeader('Set-Cookie', cookie(`${payload}.${sign(payload)}`, MAX_AGE_S))
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', cookie('', 0))
}

export function getSession(req) {
  const token = (req.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1)
  if (!token) return null

  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = Buffer.from(sign(payload))
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return session.exp > Date.now() ? session : null
  } catch {
    return null
  }
}

export function requireUser(req) {
  const user = getSession(req)
  if (!user) throw new HttpError(401, 'Sessão expirada. Entre novamente.')
  return user
}
