import { useMemo, useState } from "react";
import "./index.css";

/** ── 백엔드 베이스 URL ── */
const API_BASE = (() => {
  const env = (process.env.REACT_APP_API_BASE || "").trim();
  if (env) return env;
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") return "http://localhost:4000";
  }
  return "/api"; // Netlify 프록시
})();

/** ── 유틸 ── */
function normalize(s = "") {
  return s
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .replace(/feat\.?|featuring|ft\.?/gi, "")
    .replace(/prod(?:uced)?\s*by|prod\.?/gi, "")
    .replace(/remix|inst(?:\.|)\s*version?/gi, "");
}
function levenshtein(a, b) {
  const m = a.length,
    n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  return dp[m][n];
}

/** ── API ── */
async function getByMonth(year, month) {
  const r = await fetch(
    `${API_BASE}/quiz/by-month?year=${year}&month=${String(month).padStart(
      2,
      "0"
    )}`
  );
  if (!r.ok) throw new Error("API error");
  return r.json();
}
async function getRandom() {
  const r = await fetch(`${API_BASE}/quiz/random`);
  if (!r.ok) throw new Error("API error");
  return r.json();
}
async function getByCode(code) {
  const r = await fetch(
    `${API_BASE}/quiz/by-code?code=${encodeURIComponent(code)}`
  );
  if (!r.ok) throw new Error("API error");
  return r.json();
}
async function getByGenre(genre) {
  const r = await fetch(
    `${API_BASE}/quiz/by-genre?genre=${encodeURIComponent(genre)}`
  );
  if (!r.ok) throw new Error("API error");
  return r.json();
}

const GENRES = [
  "발라드",
  "댄스",
  "랩/힙합",
  "R&B/Soul",
  "인디음악",
  "록/메탈",
  "트로트",
  "포크/블루스",
];

export default function App() {
  /** 카테고리: global | month | genre */
  const [category, setCategory] = useState("global");
  const [selectedGenre, setSelectedGenre] = useState("");

  const [year, setYear] = useState(2023);
  const [month, setMonth] = useState();

  const [cur, setCur] = useState(null);
  const [furiganaOn, setFuriganaOn] = useState(true);

  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState("");
  const [state, setState] = useState("idle"); // idle|loading|playing|correct|giveup
  const [error, setError] = useState("");

  /** 힌트 버튼 상태(버튼 텍스트로 노출) */
  const [hintGenreShown, setHintGenreShown] = useState(false);
  const [hintArtistShown, setHintArtistShown] = useState(false);

  /** 매칭코드 */
  const [code, setCode] = useState("");

  /** 클릭한 줄의 원문(한글) 공개 인덱스 */
  const [revealed, setRevealed] = useState(new Set());
  function toggleReveal(i) {
    setRevealed((prev) => {
      const s = new Set(prev);
      s.has(i) ? s.delete(i) : s.add(i);
      return s;
    });
  }

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => i + 1),
    []
  );

  async function startOrNext() {
    if (state === "loading") return;
    setState("loading");
    setError("");
    setCur(null);
    setFeedback("");
    setHintGenreShown(false);
    setHintArtistShown(false);
    setRevealed(new Set());

    try {
      let data;
      if (category === "global") {
        data = await getRandom();
      } else if (category === "month") {
        data = await getByMonth(year, month);
      } else {
        // genre
        if (!selectedGenre) throw new Error("장르를 선택하세요.");
        data = await getByGenre(selectedGenre);
      }
      setCur(data);
      setState("playing");
    } catch (e) {
      setError(e?.message || "문제 로드 실패");
      setState("idle");
    }
  }

  async function loadByCode() {
    if (!code.trim() || state === "loading") return;
    setState("loading");
    setError("");
    setCur(null);
    setFeedback("");
    setHintGenreShown(false);
    setHintArtistShown(false);
    setRevealed(new Set());

    try {
      const data = await getByCode(code.trim());
      setCur(data);
      setState("playing");
    } catch {
      setError("코드로 문제 로드 실패");
      setState("idle");
    }
  }

  function check() {
    if (!cur) return;
    const a = normalize(guess);
    const b = normalize(cur.title);
    const dist = levenshtein(a, b);
    const ok = a === b || dist <= Math.max(1, Math.floor(b.length * 0.15));
    if (ok) {
      setState("correct");
      setFeedback(`정답! ${cur.title} — ${cur.artist}`);
    } else {
      setState("playing"); // 재시도 가능
      setFeedback("오답! 다시 시도해보세요.");
    }
  }

  function giveUp() {
    if (!cur) return;
    setState("giveup");
    setFeedback(`정답: ${cur.title} — ${cur.artist}`);
  }

  return (
    <div className="min-h-screen grid place-items-center p-3 sm:p-6 bg-gray-100 text-gray-900">
      <div className="w-full max-w-[720px] bg-white border border-gray-300 rounded-2xl p-4 sm:p-6 shadow-lg">
        {/* 헤더 */}
        <header className="flex items-start sm:items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-semibold">
            우타틀 <span className="text-indigo-600">Utatle</span>
          </h1>

          {/* 헤더 우측: 후리가나 토글(컴팩트) */}
          <div>
            <button
              onClick={() => setFuriganaOn((v) => !v)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition
                ${
                  furiganaOn
                    ? "bg-indigo-600 text-white hover:bg-indigo-500"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
            >
              {furiganaOn ? "후리가나 ON" : "후리가나 OFF"}
            </button>
          </div>
        </header>

        {/* 컨트롤 섹션 */}
        <section className="mt-4 sm:mt-6 grid gap-3">
          <div className="grid gap-2">
            <label className="text-sm text-gray-500">카테고리</label>

            {/* 카테고리 탭: 전체 랜덤 / 월도 / 장르 */}
            <div className="inline-flex rounded-xl border border-gray-300 overflow-hidden bg-white w-full">
              <button
                type="button"
                onClick={() => setCategory("global")}
                className={`flex-1 px-4 py-2 text-sm transition ${
                  category === "global"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                전체 랜덤
              </button>
              <button
                type="button"
                onClick={() => setCategory("month")}
                className={`flex-1 px-4 py-2 text-sm transition border-l border-gray-300 ${
                  category === "month"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                월도 선택
              </button>
              <button
                type="button"
                onClick={() => setCategory("genre")}
                className={`flex-1 px-4 py-2 text-sm transition border-l border-gray-300 ${
                  category === "genre"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                장르
              </button>
            </div>

            {/* 월도 선택 */}
            {category === "month" && (
              <div className="mt-2 grid gap-2">
                <div className="flex items-center rounded-lg border border-gray-300 bg-white w-full">
                  <button
                    type="button"
                    onClick={() => setYear((y) => Math.max(2000, y - 1))}
                    className="px-3 py-2 text-gray-600 hover:bg-gray-50"
                  >
                    ‹
                  </button>
                  <div className="px-4 py-2 text-sm font-medium tabular-nums flex-1 text-center">
                    {year}
                  </div>
                  <button
                    type="button"
                    onClick={() => setYear((y) => Math.min(2023, y + 1))}
                    className="px-3 py-2 text-gray-600 hover:bg-gray-50"
                  >
                    ›
                  </button>
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
                  {monthOptions.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMonth(m)}
                      className={`px-3 py-2 rounded-md text-sm transition ${
                        month === m
                          ? "bg-indigo-600 text-white"
                          : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {String(m).padStart(2, "0")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 장르 선택 */}
            {category === "genre" && (
              <div className="mt-2 grid gap-2">
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900"
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                >
                  <option value="">장르 선택</option>
                  {GENRES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 1) 시작/다음: 풀폭 */}
            <div className="mt-2">
              <button
                onClick={startOrNext}
                disabled={state === "loading"}
                className="w-full px-4 py-3 rounded-xl bg-indigo-600 text-white font-medium shadow hover:bg-indigo-500 disabled:opacity-50"
              >
                시작/다음
              </button>
            </div>

            <div className="h-px w-full bg-gray-200 my-3"></div>

            {/* 3) 힌트: 반반(버튼 텍스트로 표시) */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => setHintGenreShown(true)}
                disabled={!cur}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 hover:bg-gray-50 disabled:opacity-50 truncate"
                title={
                  hintGenreShown && cur
                    ? cur.genre || "정보 없음"
                    : "힌트(장르)"
                }
              >
                {hintGenreShown && cur
                  ? cur.genre || "정보 없음"
                  : "힌트(장르)"}
              </button>

              <button
                onClick={() => setHintArtistShown(true)}
                disabled={!cur}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 hover:bg-gray-50 disabled:opacity-50 truncate"
                title={
                  hintArtistShown && cur
                    ? cur.artist || "정보 없음"
                    : "힌트(가수)"
                }
              >
                {hintArtistShown && cur
                  ? cur.artist || "정보 없음"
                  : "힌트(가수)"}
              </button>
            </div>
          </div>

          {/* 문제 영역: 라인 클릭 시 원문 표시, 후리가나 HTML 렌더 */}
          <div className="grid gap-2">
            <label className="text-sm text-gray-500">일본어 가사 (전체)</label>
            <div className="min-h-[200px] max-h-[420px] overflow-y-auto leading-7 p-4 border border-gray-300 rounded-xl bg-gray-50 text-[15px]">
              {state === "loading" && "불러오는 중…"}

              {state !== "loading" &&
                cur &&
                (() => {
                  const ja = furiganaOn
                    ? cur.lyricsJaRubyLines || cur.lyricsJaLines || []
                    : cur.lyricsJaLines || [];
                  return ja.map((line, idx) => (
                    <div key={idx} className="py-1">
                      <button
                        type="button"
                        onClick={() => toggleReveal(idx)}
                        className="w-full text-left rounded px-2 -mx-2 hover:bg-indigo-50"
                      >
                        {furiganaOn ? (
                          <div
                            className="whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{
                              __html: line && line.length ? line : " ",
                            }}
                          />
                        ) : (
                          <span className="whitespace-pre-wrap">
                            {line && line.length ? line : " "}
                          </span>
                        )}
                      </button>

                      {revealed.has(idx) && (
                        <div className="mt-1 pl-2 border-l-2 border-indigo-200 text-sm text-gray-700 whitespace-pre-wrap">
                          {cur.lyricsKoLines?.[idx] || ""}
                        </div>
                      )}
                    </div>
                  ));
                })()}

              {state === "idle" && !cur && "시작을 누르세요"}
            </div>
            {!!error && <div className="text-red-600 text-sm">{error}</div>}
          </div>

          {/* 정답 입력 */}
          <div className="grid gap-2">
            <label className="text-sm text-gray-500">정답 (노래 제목)</label>
            <div className="flex flex-col gap-2">
              <input
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2"
                value={guess}
                onChange={(e) => {
                  setGuess(e.target.value);
                  setFeedback("");
                }}
                placeholder="제목을 입력"
                onKeyDown={(e) => e.key === "Enter" && check()}
                disabled={state === "loading" || !cur}
              />
              {/* 모바일 풀폭, sm↑ 반반 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={check}
                  disabled={state === "loading" || !cur}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 disabled:opacity-50"
                >
                  확인
                </button>
                <button
                  onClick={giveUp}
                  disabled={state === "loading" || !cur}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 disabled:opacity-50"
                >
                  포기
                </button>
              </div>
            </div>

            {!!feedback && (
              <div
                className={`text-sm mt-2 ${
                  state === "correct"
                    ? "text-green-600"
                    : state === "giveup"
                    ? "text-red-600"
                    : "text-amber-600"
                }`}
              >
                {feedback}
              </div>
            )}
          </div>

          {/* 2) 매칭코드 입력 + 불러오기 */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
            <input
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="매칭코드 입력"
            />
            <button
              onClick={loadByCode}
              disabled={state === "loading"}
              className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              코드 불러오기
            </button>
          </div>

          {/* 메타/매칭코드 */}
          {cur && (
            <div className="text-xs text-gray-500 flex items-center justify-between">
              <span>
                {cur.year}-{String(cur.month).padStart(2, "0")} · #{cur.rank}
              </span>
              <span>
                매칭코드: <span className="font-mono">{cur.code}</span>
              </span>
            </div>
          )}

          <footer className="pt-2 text-xs text-gray-400">
            비공개 실험 용도 · DeepL API 번역 · 후리가나{" "}
            {furiganaOn ? "ON" : "OFF"}
          </footer>
        </section>
      </div>
    </div>
  );
}
