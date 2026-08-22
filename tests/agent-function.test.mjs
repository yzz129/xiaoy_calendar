import assert from 'node:assert/strict'
import { onRequestGet, onRequestOptions, onRequestPost } from '../functions/api/agent.js'

const originalFetch = globalThis.fetch

try {
  const DB = {
    prepare(sql) {
      return {
        bind() { return this },
        async first() {
          if (sql.includes('FROM sessions')) return {
            id: 'user-1', nickname: 'tester', role: 'user', status: 'active',
            session_id: 'session-1', expires_at: '2099-01-01T00:00:00.000Z',
          }
          return null
        },
        async run() { return { success: true } },
      }
    },
  }
  const authHeaders = { Origin: 'https://calendar.yzzwnw.asia', Authorization: 'Bearer test-session' }
  globalThis.fetch = async (url) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions')
    return Response.json({
      model: 'free-test-model',
      choices: [{ message: { content: JSON.stringify({
        status: 'clarify',
        reply: '我先了解一下你的可用时间。',
        questions: ['你每天可以安排多少分钟？'],
        searchQuery: '',
        actionDrafts: [],
        planDrafts: [],
      }) } }],
    })
  }

  const env = {
    DB,
    OPENROUTER_API_KEY: 'test-key',
    POLLINATIONS_API_KEY: 'test-pollinations-key',
    TAVILY_API_KEY: 'test-search-key',
  }
  const capabilityRequest = new Request('https://calendar.yzzwnw.asia/api/agent', {
    headers: authHeaders,
  })
  const capability = await onRequestGet({ request: capabilityRequest, env })
  assert.equal(capability.status, 200)
  const capabilities = await capability.json()
  assert.deepEqual(capabilities.providers, ['openrouter', 'pollinations'])
  assert.equal(capabilities.imageGeneration, 'disabled_without_verified_zero_price_model')

  const nativePreflight = await onRequestOptions({
    request: new Request('https://calendar.yzzwnw.asia/api/agent', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://localhost',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    }),
  })
  assert.equal(nativePreflight.status, 204)
  assert.equal(nativePreflight.headers.get('Access-Control-Allow-Origin'), 'https://localhost')

  const rejectedPreflight = await onRequestOptions({
    request: new Request('https://calendar.yzzwnw.asia/api/agent', {
      method: 'OPTIONS',
      headers: { Origin: 'https://example.com' },
    }),
  })
  assert.equal(rejectedPreflight.status, 403)

  const request = new Request('https://calendar.yzzwnw.asia/api/agent', {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: '帮我制定英语学习计划',
      messages: [],
      calendar: { today: '2026-08-20', profile: { intensity: 'balanced' } },
    }),
  })
  const response = await onRequestPost({ request, env })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://calendar.yzzwnw.asia')
  const payload = await response.json()
  assert.equal(payload.status, 'clarify')
  assert.equal(payload.questions.length, 1)
  assert.equal(payload.provider.name, 'openrouter')

  globalThis.fetch = async (url) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions')
    return Response.json({
      model: 'free-test-model',
      choices: [{ message: { content: JSON.stringify({
        status: 'proposal',
        reply: '我准备把今天设为休息日并记一条便签，请确认。',
        questions: [],
        searchQuery: '',
        actionDrafts: [
          { kind: 'set_day_status', date: '2026-08-20', status: 'rest' },
          { kind: 'add_note', date: '2026-08-20', text: '好好休息' },
          { kind: 'delete_note', date: '2026-08-20', noteId: 'not-real' },
          { kind: 'open_profile', section: 'password' },
          { kind: 'jump_to_date', date: '2027-03-01' },
        ],
        planDrafts: [],
      }) } }],
    })
  }

  const actionResponse = await onRequestPost({
    request: new Request('https://calendar.yzzwnw.asia/api/agent', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '把今天设为休息日，写上好好休息，再打开密码设置，然后跳到明年3月',
        messages: [],
        calendar: {
          today: '2026-08-20',
          recentAvailability: [{ date: '2026-08-20', notes: [], plannedTasks: [] }],
        },
      }),
    }),
    env,
  })
  assert.equal(actionResponse.status, 200)
  const actionPayload = await actionResponse.json()
  assert.equal(actionPayload.status, 'proposal')
  assert.equal(actionPayload.actionDrafts.length, 4)
  assert.deepEqual(actionPayload.actionDrafts.map((action) => action.kind), ['set_day_status', 'add_note', 'open_profile', 'jump_to_date'])
  assert.equal(actionPayload.actionDrafts[0].duration, 0)
  assert.equal(actionPayload.actionDrafts[2].section, 'password')
  assert.equal(actionPayload.actionDrafts[2].sensitive, true)
  assert.equal(actionPayload.actionDrafts[3].date, '2027-03-01')
  assert.equal(actionPayload.actionDrafts[3].automatic, true)

  globalThis.fetch = async (url) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions')
    return Response.json({
      model: 'free-test-model',
      choices: [{ message: { content: JSON.stringify({
        status: 'proposal',
        reply: '我会一次性设置整个 7 月，请确认。',
        questions: [],
        searchQuery: '',
        actionDrafts: [{
          kind: 'set_date_range_status',
          startDate: '2026-07-01',
          endDate: '2026-07-31',
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          status: 'work',
          duration: 1,
        }],
        planDrafts: [],
      }) } }],
    })
  }

  const rangeResponse = await onRequestPost({
    request: new Request('https://calendar.yzzwnw.asia/api/agent', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '把 2026 年 7 月所有日期设为工作日',
        messages: [],
        calendar: { today: '2026-08-20' },
      }),
    }),
    env,
  })
  assert.equal(rangeResponse.status, 200)
  const rangePayload = await rangeResponse.json()
  assert.equal(rangePayload.actionDrafts.length, 1)
  assert.deepEqual(rangePayload.actionDrafts[0], {
    id: rangePayload.actionDrafts[0].id,
    kind: 'set_date_range_status',
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    status: 'work',
    duration: 1,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    dayCount: 31,
  })

  globalThis.fetch = async (url) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions')
    return Response.json({
      model: 'free-test-model',
      choices: [{ message: { content: JSON.stringify({
        status: 'proposal',
        reply: '兼容旧格式。',
        questions: [],
        searchQuery: '',
        actionDrafts: Array.from({ length: 10 }, (_, index) => ({
          kind: 'set_day_status',
          date: `2026-07-${String(index + 1).padStart(2, '0')}`,
          status: 'rest',
        })),
        planDrafts: [],
      }) } }],
    })
  }

  const legacyRangeResponse = await onRequestPost({
    request: new Request('https://calendar.yzzwnw.asia/api/agent', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '把 2026 年 7 月所有日期都设为休息日', messages: [], calendar: { today: '2026-08-20' } }),
    }),
    env,
  })
  const legacyRangePayload = await legacyRangeResponse.json()
  assert.equal(legacyRangePayload.actionDrafts.length, 1)
  assert.equal(legacyRangePayload.actionDrafts[0].kind, 'set_date_range_status')
  assert.equal(legacyRangePayload.actionDrafts[0].startDate, '2026-07-01')
  assert.equal(legacyRangePayload.actionDrafts[0].endDate, '2026-07-31')
  assert.equal(legacyRangePayload.actionDrafts[0].dayCount, 31)

  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions')
    const body = JSON.parse(init.body)
    assert.equal(body.stream, true)
    assert.match(body.messages[0].content, /<<<XY_META>>>/)
    const serialized = `我先了解一下你的可用时间。\n<<<XY_META>>>\n${JSON.stringify({
      status: 'clarify',
      questions: ['你每天可以安排多少分钟？'],
      searchQuery: '',
      actionDrafts: [],
      planDrafts: [],
    })}`
    const pieces = [serialized.slice(0, 4), serialized.slice(4, 11), serialized.slice(11, 25), serialized.slice(25)]
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        await new Promise((resolve) => setTimeout(resolve, 120))
        for (const content of pieces) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ model: 'free-test-model', choices: [{ delta: { content } }] })}\n\n`))
          await new Promise((resolve) => setTimeout(resolve, 3))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
  }

  const streamResponse = await onRequestPost({
    request: new Request('https://calendar.yzzwnw.asia/api/agent', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        message: '流式告诉我下一步',
        stream: true,
        messages: [],
        calendar: { today: '2026-08-20' },
      }),
    }),
    env,
  })
  assert.equal(streamResponse.status, 200)
  assert.match(streamResponse.headers.get('Content-Type'), /text\/event-stream/)
  const streamReader = streamResponse.body.getReader()
  const streamDecoder = new TextDecoder()
  let streamBody = ''
  let firstDeltaAt = 0
  const streamStartedAt = Date.now()
  while (!firstDeltaAt) {
    const { done, value } = await streamReader.read()
    assert.equal(done, false)
    streamBody += streamDecoder.decode(value, { stream: true })
    if (streamBody.includes('event: delta')) firstDeltaAt = Date.now()
  }
  assert.ok(firstDeltaAt - streamStartedAt < 100, '首段可见文字应在模型首 token 之前到达')
  assert.match(streamBody, /收到，我先梳理重点/)
  assert.doesNotMatch(streamBody, /event: result/)
  while (true) {
    const { done, value } = await streamReader.read()
    streamBody += streamDecoder.decode(value || new Uint8Array(), { stream: !done })
    if (done) break
  }
  assert.match(streamBody, /event: ready/)
  assert.match(streamBody, /event: status/)
  assert.match(streamBody, /event: delta/)
  assert.match(streamBody, /event: result/)
  assert.match(streamBody, /event: done/)
  assert.match(streamBody, /我先了解一下你的可用时间/)
  assert.match(streamBody, /event: reset/)
  assert.ok(streamBody.indexOf('event: delta') < streamBody.indexOf('event: result'))

  let malformedProviderCalls = 0
  globalThis.fetch = async (url, init) => {
    malformedProviderCalls += 1
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions')
    const body = JSON.parse(init.body)
    assert.equal(body.stream, true)
    const serialized = `我需要确认三点：\n1. 你的具体学习目标是什么？\n2. 每天可以投入多少时间？\n3. 有明确的截止日期吗？\n<<<XY_META>>>\n{"status":"clarify","questions"["你的具体学习目标是什么？"],"searchQuery":""}`
    const encoder = new TextEncoder()
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ model: 'broken-json-model', choices: [{ delta: { content: serialized } }] })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    }), { headers: { 'Content-Type': 'text/event-stream' } })
  }

  const recoveredResponse = await onRequestPost({
    request: new Request('https://calendar.yzzwnw.asia/api/agent', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        message: '帮我安排一个学习计划',
        stream: true,
        messages: [],
        calendar: { today: '2026-08-20' },
      }),
    }),
    env: { DB, OPENROUTER_API_KEY: 'test-key', POLLINATIONS_API_KEY: 'unused-fallback-key' },
  })
  const recoveredBody = await recoveredResponse.text()
  assert.equal(malformedProviderCalls, 1, '正文已流出后不应切换模型并重复输出')
  assert.match(recoveredBody, /event: result/)
  assert.match(recoveredBody, /event: done/)
  assert.doesNotMatch(recoveredBody, /event: error/)
  assert.match(recoveredBody, /你的具体学习目标是什么/)

  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://gen.pollinations.ai/v1/chat/completions')
    assert.equal(init.headers.Authorization, 'Bearer test-pollinations-key')
    const body = JSON.parse(init.body)
    assert.equal(body.model, 'YoannDev90/diffusiongemma-26b-a4b-it:free')
    return Response.json({
      model: 'YoannDev90/diffusiongemma-26b-a4b-it:free',
      choices: [{ message: { content: JSON.stringify({
        status: 'answer',
        reply: 'Pollinations 文本模型已接入。',
        questions: [],
        searchQuery: '',
        actionDrafts: [],
        planDrafts: [],
      }) } }],
    })
  }

  const pollinationsResponse = await onRequestPost({
    request: new Request('https://calendar.yzzwnw.asia/api/agent', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '只回答一句话',
        messages: [],
        calendar: { today: '2026-08-20' },
      }),
    }),
    env: { DB, POLLINATIONS_API_KEY: 'test-pollinations-key' },
  })
  assert.equal(pollinationsResponse.status, 200)
  const pollinationsPayload = await pollinationsResponse.json()
  assert.equal(pollinationsPayload.provider.name, 'pollinations')
  assert.equal(pollinationsPayload.provider.model, 'YoannDev90/diffusiongemma-26b-a4b-it:free')
} finally {
  globalThis.fetch = originalFetch
}

console.log('agent function tests passed')
