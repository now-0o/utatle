import { useMemo, useState } from 'react'
import './index.css'

// src/App.jsx (또는 사용 중인 파일 최상단)
const API_BASE = (() => {
  const env = import.meta?.env?.VITE_API_BASE?.trim()
  if (env) return env
  if (typeof window !== 'undefined') {
    const h = window.location.hostname
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:4000'
  }
  // Netlify 배포 환경: 프록시 상대경로 사용
  return '/api'
})()


function normalize(s = '') {
  return s
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[\[\]{}()'".,!?·:;/_-]/g, '')
    .replace(/feat\.?|ft\.?|remix|inst(\.|)version?/gi, '')
}

function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  return dp[m][n]
}

function adaptQuizPayload(j) {
  return {
    year: Number(j.year),
    month: Number(j.month),
    rank: Number(j.rank),
    title: String(j.title || ''),
    artist: String(j.artist || ''),
    genre: String(j.genre || ''),
    code: String(j.code || ''),
    ko: Array.isArray(j.lyricsKoLines) ? j.lyricsKoLines : [],
    ja: Array.isArray(j.lyricsJaLines) ? j.lyricsJaLines : [],
    jaRuby: Array.isArray(j.lyricsJaRubyLines) ? j.lyricsJaRubyLines : []
  }
}

async function fetchJson(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

async function apiRandom() {
  const j = await fetchJson(`${API_BASE}/api/quiz/random`)
  return adaptQuizPayload(j)
}

async function apiByMonth(year, month) {
  const qs = new URLSearchParams({ year: String(year), month: String(month).padStart(2, '0') })
  const j = await fetchJson(`${API_BASE}/api/quiz/by-month?${qs}`)
  return adaptQuizPayload(j)
}

async function apiByCode(code) {
  const qs = new URLSearchParams({ code: String(code).trim() })
  const j = await fetchJson(`${API_BASE}/api/quiz/by-code?${qs}`)
  return adaptQuizPayload(j)
}

export default function App() {
  const [useGlobalRandom, setUseGlobalRandom] = useState(true)
  const [year, setYear] = useState(2017)
  const [month, setMonth] = useState(2)

  const [cur, setCur] = useState(null)
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const [guess, setGuess] = useState('')

  const [showRuby, setShowRuby] = useState(false)
  const [showHints, setShowHints] = useState(false)
  const [openIdx, setOpenIdx] = useState(null)

  const [codeInput, setCodeInput] = useState('')

  const [wrongMsg, setWrongMsg] = useState('');

  async function startOrNext() {
    setState('loading')
    setError('')
    setCur(null)
    setGuess('')
    setOpenIdx(null)
    setShowHints(false)
    try {
      const data = useGlobalRandom ? await apiRandom() : await apiByMonth(year, month)
      setCur(data)
      setState('playing')
    } catch (e) {
      setError(e?.message || '문제 로드 실패')
      setState('idle')
    }
  }

  async function loadByCode() {
    if (!codeInput.trim()) return
    setState('loading')
    setError('')
    setCur(null)
    setGuess('')
    setOpenIdx(null)
    setShowHints(false)
    try {
      const data = await apiByCode(codeInput.trim())
      setCur(data)
      setState('playing')
    } catch (e) {
      setError(e?.message || '코드 로드 실패')
      setState('idle')
    }
  }

  function check() {
    if (!cur) return;
    const a = normalize(guess);
    const b = normalize(cur.title);
    const dist = levenshtein(a, b);
    const ok = a === b || dist <= Math.max(1, Math.floor(b.length * 0.15));
  
    if (ok) {
      setState('correct');
      setWrongMsg('');
    } else {
      setState('playing');      // ← 게임 유지
      setWrongMsg('오답입니다. 다시 시도해보세요.');
    }
  }  

  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), [])

  const lines = cur ? (showRuby ? cur.jaRuby : cur.ja) : []
  const koLines = cur ? cur.ko : []

  return (
    <div className="min-h-screen grid place-items-center p-4 sm:p-6 bg-gray-100 text-gray-900">
      <div className="w-full max-w-[720px] sm:max-w-2xl md:max-w-3xl bg-white border border-gray-300 rounded-2xl p-4 sm:p-6 shadow-lg">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-semibold">
            우타틀 <span className="text-indigo-600">Utatle</span>
          </h1>
          <nav className="text-xs sm:text-sm text-gray-500">K-lyrics Quiz · 월도/코드/후리가나</nav>
        </header>

        <section className="mt-4 sm:mt-6 grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm text-gray-500">카테고리</label>
            <div className="inline-flex rounded-xl border border-gray-300 overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setUseGlobalRandom(true)}
                className={`px-3 sm:px-4 py-2 text-sm transition ${
                  useGlobalRandom ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                전체 랜덤
              </button>
              <button
                type="button"
                onClick={() => setUseGlobalRandom(false)}
                className={`px-3 sm:px-4 py-2 text-sm transition border-l border-gray-300 ${
                  !useGlobalRandom ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                월도 선택
              </button>
            </div>

            {!useGlobalRandom && (
              <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center">
                <div className="flex items-center rounded-lg border border-gray-300 bg-white w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setYear((y) => Math.max(2000, y - 1))}
                    className="px-3 py-2 text-gray-600 hover:bg-gray-50"
                  >
                    ‹
                  </button>
                  <div className="px-4 py-2 text-sm font-medium tabular-nums">{year}</div>
                  <button
                    type="button"
                    onClick={() => setYear((y) => Math.min(2023, y + 1))}
                    className="px-3 py-2 text-gray-600 hover:bg-gray-50"
                  >
                    ›
                  </button>
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 w-full sm:w-auto">
                  {monthOptions.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMonth(m)}
                      className={`px-3 py-2 rounded-md text-sm transition ${
                        month === m
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {String(m).padStart(2, '0')}
                    </button>
                  ))}
                </div>

                <button
                  onClick={startOrNext}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium shadow hover:bg-indigo-500 w-full sm:w-auto"
                >
                  시작/다음
                </button>
              </div>
            )}

            {useGlobalRandom && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={startOrNext}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium shadow hover:bg-indigo-500"
                >
                  시작/다음
                </button>
                <div className="flex items-center gap-2">
                  <input
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="매칭코드 입력"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadByCode()}
                  />
                  <button
                    onClick={loadByCode}
                    className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  >
                    코드로 불러오기
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showRuby}
                onChange={(e) => setShowRuby(e.target.checked)}
              />
              후리가나 표시
            </label>
            <button
              type="button"
              onClick={() => setShowHints((v) => !v)}
              disabled={!cur}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50"
            >
              힌트 보기
            </button>
            {cur?.code && (
              <div className="text-xs text-gray-500">
                코드 <span className="font-mono px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">{cur.code}</span>
              </div>
            )}
          </div>

          {showHints && cur && (
            <div className="rounded-xl border border-gray-300 bg-gray-50 p-3 text-sm text-gray-700">
              <div>장르: <span className="font-medium">{cur.genre || '정보 없음'}</span></div>
              <div>가수: <span className="font-medium">{cur.artist || '정보 없음'}</span></div>
            </div>
          )}

          <div className="grid gap-2">
            <label className="text-sm text-gray-500">일본어 가사</label>
            <div className="min-h-[220px] max-h-[420px] overflow-y-auto leading-7 p-4 border border-gray-300 rounded-xl bg-gray-50 text-[15px] space-y-2">
              {state === 'loading' && '문제 로드 중…'}
              {state === 'idle' && !cur && '시작을 누르세요'}
              {state !== 'loading' && cur && lines.length === 0 && '가사를 불러올 수 없습니다.'}
              {state !== 'loading' && cur && lines.length > 0 && (
                <ul className="space-y-1">
                  {lines.map((ln, idx) => (
                    <li key={idx} className="group">
                      <button
                        type="button"
                        className="w-full text-left hover:bg-white rounded px-2 py-1 transition"
                        onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                      >
                        {showRuby ? (
                          <span
                            dangerouslySetInnerHTML={{ __html: ln }}
                          />
                        ) : (
                          <span>{ln}</span>
                        )}
                      </button>
                      {openIdx === idx && koLines[idx] && (
                        <div className="mt-1 ml-2 pl-2 border-l-2 border-indigo-200 text-sm text-gray-700">
                          {koLines[idx]}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {!!error && <div className="text-red-600 text-sm">{error}</div>}
          </div>

          <div className="grid gap-2">
            <label className="text-sm text-gray-500">정답 (노래 제목)</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="제목을 입력(한글/영문 구분)"
                onKeyDown={(e) => e.key === 'Enter' && check()}
                disabled={state !== 'playing'}
              />
              <div className="flex gap-2">
                <button
                  onClick={check}
                  disabled={state !== 'playing'}
                  className="px-4 py-2 rounded-lg border border-gray-300 disabled:opacity-50"
                >
                  확인
                </button>
                <button
                  onClick={() => setState('giveup')}
                  disabled={state !== 'playing'}
                  className="px-4 py-2 rounded-lg border border-gray-300 disabled:opacity-50"
                >
                  포기
                </button>
              </div>
            </div>
            {state === 'correct' && cur && (
            <div className="text-green-600 text-sm mt-2">
              정답! {cur.title} — {cur.artist}
            </div>
            )}
            {wrongMsg && state === 'playing' && (
            <div className="text-red-600 text-sm mt-2">{wrongMsg}</div>
            )}
            {state === 'giveup' && cur && (
            <div className="text-red-600 text-sm mt-2">
              정답: {cur.title} — {cur.artist}
            </div>
            )}
            </div>

          {cur && (
            <div className="text-xs text-gray-500">
              {cur.year}-{String(cur.month).padStart(2, '0')} · #{cur.rank}
            </div>
          )}

          <footer className="pt-2 text-xs text-gray-400">
            비공개 실험 용도 · 백엔드 번역/루비/코드 지원
          </footer>
        </section>
      </div>
    </div>
  )
}
