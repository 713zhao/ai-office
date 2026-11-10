// Local API used by the office UI. Runs inside the Vite dev/preview server (see vite.config.js).
// API keys are stored in data/floors.json (gitignored) or read from environment variables,
// and are never sent back to the browser.
import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_FLOORS, PROVIDERS, normalizeFloor } from '../src/floor-config.js'

const DATA_FILE = path.resolve(process.env.AI_OFFICE_DATA || 'data/floors.json')

function load() {
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    if (Array.isArray(saved) && saved.length) return saved
  } catch {}
  return structuredClone(DEFAULT_FLOORS)
}

function save(floors) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  fs.writeFileSync(DATA_FILE, JSON.stringify(floors, null, 2), { mode: 0o600 })
}

function keyFor(floor) {
  const p = floor.provider || {}
  return p.apiKey || (PROVIDERS[p.type]?.keyEnv && process.env[PROVIDERS[p.type].keyEnv]) || ''
}

// Public view: normalized, with the key replaced by a flag and its last 4 characters.
function publicFloor(floor) {
  const key = keyFor(floor)
  const fromEnv = !floor.provider?.apiKey && !!key
  return normalizeFloor({ ...floor, provider: { ...floor.provider, hasKey: !!key, keyHint: key ? (fromEnv ? `from ${PROVIDERS[floor.provider.type].keyEnv}` : `…${key.slice(-4)}`) : '' } }, floor.id)
}

// Merge an edit from the browser into a stored floor. A blank apiKey keeps the existing key.
function applyEdit(stored, body, id) {
  const next = normalizeFloor({ ...stored, ...body, provider: { ...stored?.provider, ...body.provider } }, id)
  delete next.provider.hasKey
  delete next.provider.keyHint
  const incoming = body.provider?.apiKey
  if (body.provider?.clearKey) next.provider.apiKey = ''
  else if (typeof incoming === 'string' && incoming.trim()) next.provider.apiKey = incoming.trim()
  else next.provider.apiKey = stored?.provider?.apiKey || ''
  return next
}

async function callModel(floor, system, prompt, maxTokens = 4096) {
  const { type, model, baseUrl } = floor.provider || {}
  const key = keyFor(floor)
  if (!type || type === 'none') throw new Error('This floor has no LLM provider configured.')
  if (!key && !(type === 'openai' && /localhost|127\.0\.0\.1/.test(baseUrl || ''))) throw new Error('No API key set for this floor.')
  const signal = AbortSignal.timeout(180_000)
  let res, data
  if (type === 'gemini') {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    })
    data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error?.message || `Gemini returned HTTP ${res.status}`)
    const out = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || ''
    if (!out) throw new Error(`Gemini returned no text (${data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason || 'unknown reason'}).`)
    return out
  }
  if (type === 'anthropic') {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] }),
    })
    data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error?.message || `Anthropic returned HTTP ${res.status}`)
    return (data.content || []).filter(block => block.type === 'text').map(block => block.text).join('')
  }
  // OpenAI-compatible chat completions (OpenAI, xAI, OpenRouter, Ollama, LM Studio…)
  res = await fetch(`${(baseUrl || PROVIDERS.openai.defaultBaseUrl).replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
  })
  data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error?.message || `Provider returned HTTP ${res.status}`)
  return data.choices?.[0]?.message?.content || ''
}

function agentSystemPrompt(floor, agentName, department) {
  const who = agentName ? `You are ${agentName}, a member of the ${department || 'floor'} department` : `You are the ${floor.name} team`
  return [
    `${who} on the "${floor.name}" floor of The AI Office (${floor.department}).`,
    `Floor focus: ${floor.description}`,
    floor.provider?.systemPrompt,
    'You receive a project assignment from your manager. Work on it and reply with a concise, well-structured report:',
    'what you did, your result or recommendation, and any open questions or next steps. Use Markdown.',
    'You cannot browse the web or open repositories; if a link is given, say what you would need from it.',
  ].filter(Boolean).join('\n')
}

async function readBody(req) {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 200_000) throw Object.assign(new Error('Request too large'), { status: 413 })
  }
  return raw ? JSON.parse(raw) : {}
}

const send = (res, status, body) => {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

export async function handleApi(req, res, next) {
  const url = new URL(req.url, 'http://local')
  if (!url.pathname.startsWith('/api/')) return next()
  try {
    const floors = load()
    const match = /^\/api\/floors\/(\d+)(\/test)?$/.exec(url.pathname)
    const id = match ? Number(match[1]) : null
    const index = id == null ? -1 : floors.findIndex(f => f.id === id)

    if (url.pathname === '/api/floors' && req.method === 'GET') return send(res, 200, floors.map(publicFloor))

    if (url.pathname === '/api/floors' && req.method === 'POST') {
      const body = await readBody(req)
      const newId = Math.max(0, ...floors.map(f => f.id)) + 1
      const floor = applyEdit(null, body, newId)
      save([...floors, floor])
      return send(res, 201, publicFloor(floor))
    }

    if (match && !match[2] && req.method === 'PUT') {
      if (index < 0) return send(res, 404, { error: 'Floor not found' })
      const body = await readBody(req)
      const updated = applyEdit(floors[index], body, id)
      if (updated.hidden && floors.filter(f => !f.hidden && f.id !== id).length === 0) return send(res, 400, { error: 'At least one floor must stay visible.' })
      floors[index] = updated
      save(floors)
      return send(res, 200, publicFloor(updated))
    }

    if (match?.[2] && req.method === 'POST') {
      if (index < 0) return send(res, 404, { error: 'Floor not found' })
      const reply = await callModel(floors[index], 'Reply with exactly: OK', 'Connection test.', 64)
      return send(res, 200, { ok: true, reply: reply.trim().slice(0, 200) })
    }

    if (url.pathname === '/api/run' && req.method === 'POST') {
      const body = await readBody(req)
      const floor = floors.find(f => f.id === Number(body.floorId))
      if (!floor) return send(res, 404, { error: 'Floor not found' })
      const normalized = normalizeFloor(floor, floor.id)
      const prompt = [
        `Project: ${body.project?.name || 'Untitled'}`,
        body.project?.repo && `Repository / path: ${body.project.repo}`,
        `Brief:\n${body.project?.brief || '(No brief given — propose a sensible first step.)'}`,
      ].filter(Boolean).join('\n\n')
      const text = await callModel({ ...floor, provider: { ...normalized.provider, apiKey: floor.provider?.apiKey } }, agentSystemPrompt(normalized, body.agentName, body.department), prompt)
      return send(res, 200, { text, model: normalized.provider.model, provider: normalized.provider.type })
    }

    return send(res, 404, { error: 'Unknown API route' })
  } catch (error) {
    return send(res, error.status || 502, { error: error.name === 'TimeoutError' ? 'The model took too long to answer.' : error.message })
  }
}

export function officeApi() {
  return {
    name: 'ai-office-api',
    configureServer(server) { server.middlewares.use(handleApi) },
    configurePreviewServer(server) { server.middlewares.use(handleApi) },
  }
}
