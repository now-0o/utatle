import { useMemo, useState } from 'react'
import './index.css'

const API_BASE =
  import.meta?.env?.VITE_API_BASE ||
  (typeof window !== 'undefined' && window.location.port === '3000'
    ? 'http://localhost:4000'
    : '');

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

async function fetchQuizRandom() {
  const r = await fetch(`${API_BASE}/api/quiz/random`, { headers: { 'Accept': 'application/json' } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const j = await r.json()
  return adaptQuizPayload(j)
}

async function fetchQuizByMonth(year, month) {
  const qs = new URLSearchParams({ year: String(year), month: String(month).padStart(2, '0') })
  const r = await fetch(`${API_BASE}/api/quiz/by-month?${qs}`, { headers: { 'Accept': 'application/json' } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const j = await r.json()
  return adaptQuizPayload(j)
}

function adaptQuizPayload(j) {
  const year = Number(j.year ?? j.y)
  const month = Number(j.month ?? j.m)
  const rank = Number(j.rank ?? j.chartRank ?? j.no ?? 0)
  const title = String(j.title ?? j.song_name ?? j.name ?? '')
  const artist = String(j.artist ?? j.singer ?? '')
  const ja = String(j.lyricsJa ?? j.ja ?? j.textJa ?? j.lyrics_ja ?? '')
  const fullKo =
    typeof j.lyricsKo === 'string'
      ? j.lyricsKo
      : Array.isArray(j.linesKo)
      ? j.linesKo.join('\n')
      : typeof j.ko === 'string'
      ? j.ko
      : ''
  return { year, month, rank, title, artist, ja, fullKo }
}

export default function App() {
  const [useGlobalRandom, setUseGlobalRandom] = useState(true)
  const [year, setYear] = useState(2017)
  const [month, setMonth] = useState(2)

  const [cur, setCur] = useState(null)
  const [guess, setGuess] = useState('')
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')

  async function startOrNext() {
    setState('loading')
    setError('')
    setCur(null)
    setGuess('')

    try {
      const data = useGlobalRandom
        ? await fetchQuizRandom()
        : await fetchQuizByMonth(year, month)

      setCur(data)
      setState('playing')
    } catch (e) {
      setError(e?.message || '문제 로드 실패')
      setState('idle')
    }
  }

  function check() {
    if (!cur) return
    const a = normalize(guess)
    const b = normalize(cur.title)
    const dist = levenshtein(a, b)
    const ok = a === b || dist <= Math.max(1, Math.floor(b.length * 0.15))
    setState(ok ? 'correct' : 'playing')
  }

  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), [])

  return (
    <div className="min-h-screen grid place-items-center p-4 sm:p-6 bg-gray-100 text-gray-900">
      <div className="w-full max-w-[680px] sm:max-w-2xl md:max-w-3xl bg-white border border-gray-300 rounded-2xl p-4 sm:p-6 shadow-lg">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-semibold">
            우타틀 <span className="text-indigo-600">Utatle</span>
          </h1>
          <nav className="text-xs sm:text-sm text-gray-500">K-lyrics Quiz · 월도 카테고리</nav>
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
              <div className="mt-2">
                <button
                  onClick={startOrNext}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium shadow hover:bg-indigo-500 w-full sm:w-auto"
                >
                  시작/다음
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <label className="text-sm text-gray-500">일본어 가사 (전체)</label>
            <div className="min-h-[200px] max-h-[400px] overflow-y-auto whitespace-pre-wrap leading-7 p-4 border border-gray-300 rounded-xl bg-gray-50 text-[15px]">
              {state === 'loading' && '문제 로드 중…'}
              {state !== 'loading' && cur && (cur.ja || '가사를 불러올 수 없습니다.')}
              {state === 'idle' && !cur && '시작을 누르세요'}
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
                placeholder="제목을 입력"
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
            비공개 실험 용도 · 백엔드 번역/데이터 조회 · 전체 가사 표시
          </footer>
        </section>
      </div>
    </div>
  )
}
