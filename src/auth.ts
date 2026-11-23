const domain = (import.meta.env.VITE_COGNITO_DOMAIN || '').replace(/\/$/, '')
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID || ''
const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI || ''
const logoutUri = import.meta.env.VITE_COGNITO_LOGOUT_URI || ''

interface Tokens { access_token: string; id_token?: string; refresh_token?: string; expires_in: number; token_type: string }
const TOKEN_KEY = 'studymate.tokens'
const VERIFIER_KEY = 'studymate.pkce_verifier'
const STATE_KEY = 'studymate.oauth_state'
let refreshing: Promise<string | null> | null = null

function randomString(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('')
}
function base64url(bytes: Uint8Array): string {
  let s = ''; for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')
}
async function pkceChallenge(verifier: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(bytes))
}
function saveTokens(t: Tokens, previousRefresh?: string) {
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ ...t, refresh_token: t.refresh_token || previousRefresh, expires_at: Date.now() + (t.expires_in * 1000) }))
}
function currentTokens(): (Tokens & {expires_at: number}) | null {
  try { return JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null') } catch { return null }
}
export function hasSession(): boolean { return !!currentTokens() }
export function requireConfig() {
  if (!domain.startsWith('https://') || !clientId || !redirectUri || !logoutUri) {
    throw new Error('Configure Cognito settings in frontend/.env.local')
  }
}
export async function signIn() {
  requireConfig()
  const verifier = randomString()
  const state = randomString()
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)
  const params = new URLSearchParams({
    response_type: 'code', client_id: clientId, redirect_uri: redirectUri,
    scope: 'openid email profile', code_challenge_method: 'S256',
    code_challenge: await pkceChallenge(verifier), state,
  })
  window.location.assign(`${domain}/oauth2/authorize?${params}`)
}
async function tokenRequest(params: URLSearchParams): Promise<Tokens> {
  const response = await fetch(`${domain}/oauth2/token`, {
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:params,
  })
  if (!response.ok) throw new Error(`Cognito token exchange failed (HTTP ${response.status})`)
  return response.json() as Promise<Tokens>
}
export async function handleCallback(): Promise<void> {
  requireConfig()
  const query = new URLSearchParams(window.location.search)
  if (query.has('error')) throw new Error(query.get('error_description') || query.get('error') || 'Authentication failed')
  const code = query.get('code')
  const state = query.get('state')
  const expected = sessionStorage.getItem(STATE_KEY)
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  if (!code || !state || !expected || state !== expected || !verifier) throw new Error('Invalid login callback; please sign in again')
  const tokens = await tokenRequest(new URLSearchParams({
    grant_type: 'authorization_code', client_id: clientId,
    code, code_verifier: verifier, redirect_uri: redirectUri,
  }))
  saveTokens(tokens)
  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)
  history.replaceState(null, '', import.meta.env.BASE_URL)
}
export async function accessToken(): Promise<string | null> {
  const current = currentTokens()
  if (!current) return null
  if (current.expires_at > Date.now() + 30_000) return current.access_token
  if (!current.refresh_token) return null
  if (refreshing) return refreshing
  refreshing = (async () => {
    try {
      const tokens = await tokenRequest(new URLSearchParams({
        grant_type: 'refresh_token', client_id: clientId, refresh_token: current.refresh_token!,
      }))
      saveTokens(tokens, current.refresh_token)
      return tokens.access_token
    } catch { sessionStorage.removeItem(TOKEN_KEY); return null }
    finally { refreshing = null }
  })()
  return refreshing
}
export function signOut() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)
  const params = new URLSearchParams({ client_id: clientId, logout_uri: logoutUri })
  window.location.assign(`${domain}/logout?${params}`)
}
