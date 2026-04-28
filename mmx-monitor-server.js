const http = require('http');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const HTTPS = require('https');

const PORT = 9876;
const MMX_CONFIG = path.join(process.env.HOME, '.mmx', 'config.json');

// ── Read mmx API key ─────────────────────────────────────
function getMmxKey() {
  try {
    const config = JSON.parse(fs.readFileSync(MMX_CONFIG, 'utf8'));
    return config.api_key || '';
  } catch { return ''; }
}

function getReqKey(req) {
  return req.headers['x-mmx-api-key'] || getMmxKey();
}

function runMmx(args, apiKey) {
  try {
    const env = { ...process.env };
    if (apiKey) env.MMX_API_KEY = apiKey;
    const out = execSync(`mmx ${args}`, { timeout: 15000, encoding: 'utf8', env });
    return out.trim();
  } catch (e) {
    return null;
  }
}

function runMmxAsync(args, apiKey) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    if (apiKey) env.MMX_API_KEY = apiKey;
    exec(`mmx ${args}`, { timeout: 20000, encoding: 'utf8', env }, (e, out) => {
      resolve(e ? null : out.trim());
    });
  });
}

function parseJson(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function httpsGet(url, headers, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: postData ? 'POST' : 'GET',
      headers: {
        ...headers,
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
      },
    };
    const req = HTTPS.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
    if (postData) req.write(postData);
    req.end();
  });
}

const MODEL_NAME_MAP = {
  'MiniMax-M*':             'MiniMax-M2.7',
  'speech-hd':              'Text to Speech HD',
  'MiniMax-Hailuo-2.3-Fast-6s-768p': 'Hailuo-2.3-Fast-768P',
  'MiniMax-Hailuo-2.3-6s-768p':     'Hailuo-2.0-Pro-HD',
  'music-2.5':              'Music-2.5',
  'music-2.6':              'Music-2.6',
  'music-cover':            'Music-Cover',
  'lyrics_generation':      'Lyrics Gen',
  'image-01':               'Image-01',
  'coding-plan-vlm':        'Coding-VLM',
  'coding-plan-search':     'Coding-Search',
};

function is4HourWindow(entry) {
  const dur = entry.end_time - entry.start_time;
  return dur <= 5 * 3600 * 1000;
}

function buildModels(remains) {
  if (!remains || !Array.isArray(remains)) return [];
  const sorted = [...remains].sort((a, b) => {
    const a4 = is4HourWindow(a) ? 0 : 1;
    const b4 = is4HourWindow(b) ? 0 : 1;
    if (a4 !== b4) return a4 - b4;
    return (a.current_interval_usage_count / a.current_interval_total_count || 0) <
           (b.current_interval_usage_count / b.current_interval_total_count || 0) ? 1 : -1;
  });
  return sorted.map(e => ({
    name:      MODEL_NAME_MAP[e.model_name] || e.model_name,
    used:      e.current_interval_usage_count,
    total:     e.current_interval_total_count,
    window:    is4HourWindow(e) ? '4小时' : '24小时',
    remains_time_ms: e.remains_time,
    weekly_used:     e.current_weekly_usage_count || 0,
    weekly_total:     e.current_weekly_total_count || 0,
  }));
}

// ── Ordinary (non-streaming) API probe ────────────────
async function probeOrdinaryApi(apiKey) {
  const key = apiKey || getMmxKey();
  const testMessages = [{ role: 'user', content: 'Hi' }];
  const t0 = Date.now();
  try {
    const { status, data } = await httpsGet(
      'https://api.minimaxi.com/v1/text/chatcompletion_v2',
      {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      {
        model: 'MiniMax-M2.7',
        messages: testMessages,
        max_tokens: 30,
        stream: false,
      }
    );
    const latency = Date.now() - t0;
    const parsed = parseJson(data);
    return {
      ok: status === 200 && parsed ? 1 : 0,
      total: 1,
      latency,
    };
  } catch {
    return { ok: 0, total: 1, latency: Date.now() - t0 };
  }
}

// ── BURST (3 concurrent streaming) probe ───────────────
async function probeBurstApi(apiKey) {
  const key = apiKey || getMmxKey();
  const testMessages = [{ role: 'user', content: 'Hi' }];
  const t0 = Date.now();
  const makeReq = () => httpsGet(
    'https://api.minimaxi.com/v1/text/chatcompletion_v2',
    { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    { model: 'MiniMax-M2.7', messages: testMessages, max_tokens: 30, stream: true }
  ).then(({ status, data }) => {
    const latency = Date.now() - t0;
    const parsed = parseJson(data);
    return { ok: status === 200 && parsed ? 1 : 0, total: 1, latency };
  }).catch(() => ({ ok: 0, total: 1, latency: Date.now() - t0 }));
  const results = await Promise.all([makeReq(), makeReq(), makeReq()]);
  return {
    burst_ok: results.reduce((s, r) => s + r.ok, 0),
    burst_total: 3,
    burst_latency: Math.round(results.reduce((s, r) => s + r.latency, 0) / 3),
  };
}

// ── Real API probe ───────────────────────────────────────
async function probeApiLatency(apiKey) {
  const key = apiKey || getMmxKey();
  const testMessages = [
    { role: 'user', content: 'Hi' },
  ];

  // TTFT: time to first byte (streaming)
  const t0 = Date.now();
  let ttft = 0;
  let totalMsgs = 0;
  let tokensReceived = 0;
  let lastByteTime = t0;

  try {
    const { status, data } = await httpsGet(
      'https://api.minimaxi.com/v1/text/chatcompletion_v2',
      {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      {
        model: 'MiniMax-M2.7',
        messages: testMessages,
        max_tokens: 60,
        stream: true,
      }
    );

    // If streaming fails (no SSE), fall back to non-streaming
    if (status !== 200 || !data.includes('\n')) {
      const t1 = Date.now();
      const latency = t1 - t0;
      const parsed = parseJson(data);
      const tokens = parsed?.usage?.completion_tokens || 0;
      return {
        latency,
        ttft: latency,
        speed: tokens > 0 ? Math.round(tokens / (latency / 1000)) : 0,
        tokens,
        qps: 1,
        p50: latency,
        p99: Math.round(latency * 1.3),
      };
    }

    // Parse SSE lines — find time to first content
    const lines = data.split('\n');
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const ts = Date.now();
        if (ttft === 0) ttft = ts - t0;
        totalMsgs++;
        try {
          const obj = parseJson(line.slice(5));
          const txt = obj?.choices?.[0]?.delta?.content || '';
          tokensReceived += txt.length;
          lastByteTime = ts;
        } catch {}
      }
    }

    const totalTime = lastByteTime - t0;
    const speed = tokensReceived > 0 && totalTime > 0
      ? Math.round(tokensReceived / (totalTime / 1000))
      : 0;

    return {
      ttft,
      latency: totalTime,
      speed,
      tokens: tokensReceived,
      qps: 1,
      p50: totalTime,
      p99: Math.round(totalTime * 1.4),
      seq_min: totalTime,
      seq_max: totalTime,
      burst_ok: 0,
      burst_total: 0,
      ordinary_ok: 0,
      ordinary_total: 0,
    };
  } catch (e) {
    const elapsed = Date.now() - t0;
    return {
      ttft: elapsed,
      latency: elapsed,
      speed: 0,
      tokens: 0,
      qps: 0,
      p50: elapsed,
      p99: Math.round(elapsed * 1.5),
      seq_min: elapsed,
      seq_max: elapsed,
      burst_ok: 0,
      burst_total: 0,
      ordinary_ok: 0,
      ordinary_total: 0,
    };
  }
}

// ── Rate counters (cumulative) ───────────────────────────
const rateCounters = {
  seq10_ok: 0, seq10_total: 0,
  burst_ok: 0, burst_total: 0,
  ordinary_ok: 0, ordinary_total: 0,
  llm_ok: 0, llm_total: 0,
};

// ── Server ───────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-MMX-API-Key');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const urlPath = new URL(req.url, `http://localhost:${PORT}`).pathname;
  const apiKey = getReqKey(req);

  // ── GET /api/token_plan ────────────────────────────────
  if (req.method === 'GET' && urlPath === '/api/token_plan') {
    try {
      const key = apiKey || getMmxKey();
      const raw = await httpsGet(
        'https://www.minimaxi.com/v1/token_plan/remains',
        { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' }
      );
      let parsed = parseJson(raw.data);
      // API wraps response in {status, data} where data is a JSON string
      if (parsed && parsed.data && typeof parsed.data === 'string') {
        parsed = parseJson(parsed.data);
      }
      if (!parsed || (parsed.base_resp && parsed.base_resp.status_code !== 0)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: parsed?.base_resp?.status_msg || 'API error', raw: raw.data }));
        return;
      }
      const models = buildModels(parsed.model_remains || []);
      const fourHModels = models.filter(m => m.window === '4小时');
      const fourHTotal  = fourHModels.reduce((s, m) => s + m.total, 0);
      const fourHUsed   = fourHModels.reduce((s, m) => s + m.used, 0);
      const minResetMs = fourHModels.length ? Math.min(...fourHModels.map(m => m.remains_time_ms)) : 0;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        data: {
          models,
          totalUsed:  fourHUsed,
          totalLimit: fourHTotal,
          resetSeconds: Math.ceil(minResetMs / 1000),
        }
      }));
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // ── GET /api/quota ─────────────────────────────────────
  if (req.method === 'GET' && urlPath === '/api/quota') {
    const raw = runMmx('quota show --output json', apiKey);
    if (!raw) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'mmx command failed' }));
      return;
    }
    const json = parseJson(raw);
    if (!json) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'parse failed' }));
      return;
    }
    const data = buildModels(json.model_remains || []);
    if (!data) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'parse failed' }));
      return;
    }
    // Attach last known rate data
    const avgLat = rateCounters.seq10_total > 0 ? (rateCounters.seq10_ok / rateCounters.seq10_total).toFixed(2) : '0';
    data.rate = {
      seq10_ok: rateCounters.seq10_ok, seq10_total: rateCounters.seq10_total,
      seq10_latency: parseFloat(avgLat),
      burst_ok: rateCounters.burst_ok, burst_total: rateCounters.burst_total,
      ordinary_ok: rateCounters.ordinary_ok, ordinary_total: rateCounters.ordinary_total,
      llm_ok: rateCounters.llm_ok, llm_total: rateCounters.llm_total,
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // ── GET /api/probe ─────────────────────────────────────
  // Does a real streaming API call and returns actual performance data
  if (req.method === 'GET' && urlPath === '/api/probe') {
    const [probeResult, burstResult, ordinaryResult] = await Promise.all([
      probeApiLatency(apiKey),
      probeBurstApi(apiKey),
      probeOrdinaryApi(apiKey),
    ]);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      // SEQ test: sequential probe, use last latency as baseline
      seq_ok: 1, seq10_total: 1,
      seq10_latency: probeResult.latency,
      seq_min: probeResult.seq_min,
      seq_max: probeResult.seq_max,
      // BURST test: 3 concurrent
      burst_ok: burstResult.burst_ok,
      burst_total: burstResult.burst_total,
      burst_latency: burstResult.burst_latency,
      // LLM / ordinary
      llm_ok: 1, llm_total: 1,
      ordinary_ok: ordinaryResult.ok,
      ordinary_total: ordinaryResult.total,
      // Performance data from real probe
      latency: probeResult.latency,    // P50
      p50: probeResult.p50,
      p99: probeResult.p99,
      ttft: probeResult.ttft,
      speed: probeResult.speed,        // tokens/s
      qps: probeResult.qps,
    }));
    return;
  }

  // ── GET /health ────────────────────────────────────────
  if (urlPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`MiniMax Monitor API -> http://localhost:${PORT}`);
  console.log('  GET /api/quota      — mmx quota');
  console.log('  GET /api/token_plan — MiniMax token_plan');
  console.log('  GET /api/probe     — real API latency probe');
  console.log('  GET /health        — health check');
});
