/**
 * Realistic product mockups for the landing page.
 * These mirror the actual Cekatan UI with real Indonesian labels,
 * real layout structure, and realistic data — designed to look like screenshots.
 */

/* ─── Dashboard Mockup ─── */

export function DashboardMockup({ className = '' }: { className?: string }) {
  return (
    <div className={`relative group ${className}`}>
      {/* Glow behind */}
      <div className="absolute -inset-1 bg-gradient-to-b from-blue-500/20 via-blue-400/10 to-transparent rounded-2xl blur-2xl opacity-60 group-hover:opacity-80 transition-opacity duration-700" />

      {/* Browser chrome */}
      <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-slate-900 shadow-2xl shadow-black/60">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 h-9 bg-slate-800/80 border-b border-white/5">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
          </div>
          <div className="flex-1 mx-6">
            <div className="h-5 bg-slate-700/40 rounded-md text-[10px] text-slate-500 flex items-center justify-center font-mono">
              cekatan.com/dashboard
            </div>
          </div>
        </div>

        {/* App layout */}
        <div className="flex min-h-[300px]">
          {/* Sidebar */}
          <div className="w-[120px] p-2 space-y-0.5 border-r border-white/5 bg-slate-800/30 shrink-0">
            {/* Logo area */}
            <div className="flex items-center gap-1.5 px-2 py-2 mb-1">
              <svg viewBox="0 0 40 40" className="w-4 h-4">
                <path d="M6 21L15 30L34 10" stroke="#4D94FF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              <span className="text-[9px] font-bold text-white/80">cekatan</span>
            </div>
            <NavItem active icon="home" label="Home" />
            <NavItem icon="clipboard" label="Assess" />
            <NavItem icon="chart" label="Analytics" />
            <NavItem icon="book" label="Library" />
            <NavItem icon="user" label="Profile" />
            <div className="pt-2 mt-2 border-t border-white/5">
              <div className="px-2 mb-1">
                <span className="text-[7px] uppercase tracking-wider text-slate-600">Organisasi</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-700/30">
                <div className="w-4 h-4 rounded bg-blue-500/30 flex items-center justify-center text-[7px] text-blue-300 font-bold">G</div>
                <span className="text-[8px] text-slate-400 truncate">PT. Gama Int...</span>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 p-3.5 space-y-3 overflow-hidden">
            {/* Title row */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-white/90">Ringkasan Organisasi</p>
                <p className="text-[7px] text-slate-500">PT. Gama Intisamudera</p>
              </div>
              <div className="flex gap-1.5">
                <div className="px-2 py-1 rounded-md bg-blue-600 text-[7px] text-white font-medium">+ Buat Asesmen</div>
                <div className="px-2 py-1 rounded-md bg-slate-700/50 text-[7px] text-slate-400">Kandidat</div>
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-4 gap-2">
              <DashStatCard icon="users" value="24" label="Anggota" color="blue" />
              <DashStatCard icon="chart" value="8" label="Asesmen" color="purple" />
              <DashStatCard icon="trending" value="156" label="Percobaan" color="green" />
              <DashStatCard icon="target" value="78%" label="Lulus" color="amber" />
            </div>

            {/* Two-column: chart + table */}
            <div className="grid grid-cols-5 gap-2.5">
              {/* Area chart */}
              <div className="col-span-3 rounded-lg bg-slate-800/50 p-2.5 border border-white/[0.04]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[8px] text-slate-400 font-medium">Aktivitas Mingguan</span>
                  <span className="text-[7px] text-slate-600">12 minggu</span>
                </div>
                <svg className="w-full h-14" viewBox="0 0 300 56" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="dashAreaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4D94FF" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#4D94FF" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Grid lines */}
                  {[14, 28, 42].map(y => (
                    <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="#334155" strokeWidth="0.3" strokeDasharray="4 4" />
                  ))}
                  <path d="M0,42 C25,38 50,35 75,30 C100,25 125,32 150,28 C175,24 200,18 225,14 C250,10 275,8 300,6 L300,56 L0,56Z" fill="url(#dashAreaFill)" />
                  <path d="M0,42 C25,38 50,35 75,30 C100,25 125,32 150,28 C175,24 200,18 225,14 C250,10 275,8 300,6" stroke="#4D94FF" strokeWidth="1.5" fill="none" />
                  <circle cx="225" cy="14" r="3" fill="#4D94FF" />
                  <circle cx="225" cy="14" r="6" fill="#4D94FF" opacity="0.15" />
                </svg>
              </div>

              {/* Recent results */}
              <div className="col-span-2 rounded-lg bg-slate-800/50 p-2.5 border border-white/[0.04]">
                <span className="text-[8px] text-slate-400 font-medium">Hasil Terbaru</span>
                <div className="mt-2 space-y-1.5">
                  {[
                    { name: 'Budi S.', score: 88, pass: true },
                    { name: 'Rina W.', score: 72, pass: true },
                    { name: 'Andi P.', score: 54, pass: false },
                    { name: 'Sari M.', score: 91, pass: true },
                  ].map((r) => (
                    <div key={r.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${r.pass ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className="text-[8px] text-slate-300">{r.name}</span>
                      </div>
                      <span className={`text-[8px] font-medium ${r.pass ? 'text-green-400' : 'text-red-400'}`}>{r.score}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom: Radar + Top performers */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Radar chart */}
              <div className="rounded-lg bg-slate-800/50 p-2.5 border border-white/[0.04]">
                <span className="text-[8px] text-slate-400 font-medium">Radar Kompetensi</span>
                <svg className="w-full h-[72px] mt-1" viewBox="0 0 120 96">
                  {/* Grid */}
                  <polygon points="60,8 102,32 88,76 32,76 18,32" stroke="#334155" strokeWidth="0.4" fill="none" />
                  <polygon points="60,22 88,38 78,68 42,68 32,38" stroke="#334155" strokeWidth="0.4" fill="none" />
                  <polygon points="60,36 74,44 69,60 51,60 46,44" stroke="#334155" strokeWidth="0.4" fill="none" />
                  {/* Axis lines */}
                  <line x1="60" y1="8" x2="60" y2="48" stroke="#334155" strokeWidth="0.3" />
                  <line x1="102" y1="32" x2="60" y2="48" stroke="#334155" strokeWidth="0.3" />
                  <line x1="88" y1="76" x2="60" y2="48" stroke="#334155" strokeWidth="0.3" />
                  <line x1="32" y1="76" x2="60" y2="48" stroke="#334155" strokeWidth="0.3" />
                  <line x1="18" y1="32" x2="60" y2="48" stroke="#334155" strokeWidth="0.3" />
                  {/* Data shape */}
                  <polygon points="60,14 96,34 80,72 38,68 24,36" stroke="#4D94FF" strokeWidth="1.2" fill="#4D94FF" fillOpacity="0.12" />
                  {/* Data points */}
                  {[[60,14],[96,34],[80,72],[38,68],[24,36]].map(([cx,cy], i) => (
                    <circle key={i} cx={cx} cy={cy} r="2" fill="#4D94FF" />
                  ))}
                  {/* Labels */}
                  <text x="60" y="5" textAnchor="middle" className="text-[5px] fill-slate-500">Leadership</text>
                  <text x="108" y="33" textAnchor="start" className="text-[5px] fill-slate-500">Teknis</text>
                  <text x="92" y="82" textAnchor="start" className="text-[5px] fill-slate-500">Komunikasi</text>
                  <text x="28" y="82" textAnchor="end" className="text-[5px] fill-slate-500">Analitis</text>
                  <text x="12" y="33" textAnchor="end" className="text-[5px] fill-slate-500">Safety</text>
                </svg>
              </div>

              {/* Top performers */}
              <div className="rounded-lg bg-slate-800/50 p-2.5 border border-white/[0.04]">
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-[8px] text-amber-400">★</span>
                  <span className="text-[8px] text-slate-400 font-medium">Performa Terbaik</span>
                </div>
                {[
                  { name: 'Sari Mulyani', score: 94, tests: 6 },
                  { name: 'Budi Santoso', score: 88, tests: 5 },
                  { name: 'Rina Wijaya', score: 85, tests: 4 },
                ].map((p, i) => (
                  <div key={p.name} className="flex items-center gap-2 py-1">
                    <span className={`text-[8px] font-bold w-3 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-400' : 'text-amber-600'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] text-slate-300 truncate">{p.name}</p>
                      <p className="text-[6px] text-slate-600">{p.tests} asesmen</p>
                    </div>
                    <span className="text-[8px] font-semibold text-green-400">{p.score}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Assessment Mockup ─── */

export function AssessmentMockup({ className = '' }: { className?: string }) {
  return (
    <div className={`relative group ${className}`}>
      <div className="absolute -inset-1 bg-gradient-to-b from-green-500/15 via-blue-400/10 to-transparent rounded-2xl blur-2xl opacity-50 group-hover:opacity-70 transition-opacity duration-700" />

      <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-slate-900 shadow-2xl shadow-black/60">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 h-9 bg-slate-800/80 border-b border-white/5">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
          </div>
          <div className="flex-1 mx-6">
            <div className="h-5 bg-slate-700/40 rounded-md text-[10px] text-slate-500 flex items-center justify-center font-mono">
              cekatan.com/t/gis-safety/exam
            </div>
          </div>
        </div>

        {/* Exam content */}
        <div className="p-4 space-y-3 min-h-[300px]">
          {/* Header: question counter + timer */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-white/80">Ujian Keselamatan Kerja</p>
              <p className="text-[7px] text-slate-500">PT. Gama Intisamudera</p>
            </div>
            {/* Timer badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/20">
              <svg className="w-3 h-3 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="text-[9px] font-mono font-medium text-amber-400">14:32</span>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] text-slate-400">Soal 12 dari 20</span>
              <span className="text-[8px] text-slate-500">Dijawab: 11</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all" style={{ width: '60%' }} />
            </div>
          </div>

          {/* Question */}
          <div className="rounded-xl bg-slate-800/50 border border-white/[0.04] p-3.5 space-y-3">
            <p className="text-[9px] text-white/90 leading-relaxed">
              Apa yang harus dilakukan pertama kali saat terjadi kecelakaan kerja di area bongkar muat pelabuhan?
            </p>

            {/* Answer options */}
            <div className="space-y-1.5">
              <ExamOption letter="A" text="Langsung menghubungi rumah sakit terdekat" />
              <ExamOption letter="B" text="Mengamankan area dan memastikan tidak ada bahaya lanjutan" selected />
              <ExamOption letter="C" text="Melaporkan kejadian ke supervisor melalui radio" />
              <ExamOption letter="D" text="Memindahkan korban ke tempat yang aman" />
            </div>
          </div>

          {/* Question dots */}
          <div className="flex items-center justify-center gap-1 py-1">
            {Array.from({ length: 20 }, (_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === 11 ? 'bg-blue-400 ring-2 ring-blue-400/30' :
                  i < 11 ? 'bg-green-400/70' :
                  i === 15 ? 'bg-amber-400/70' :
                  'bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center">
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-white/[0.06] text-[8px] text-slate-400">
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
              Sebelumnya
            </button>
            <button className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-blue-600 text-[8px] text-white font-medium">
              Selanjutnya
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Results Mockup ─── */

export function ResultsMockup({ className = '' }: { className?: string }) {
  return (
    <div className={`relative group ${className}`}>
      <div className="absolute -inset-1 bg-gradient-to-b from-green-500/20 via-green-400/10 to-transparent rounded-2xl blur-2xl opacity-50 group-hover:opacity-70 transition-opacity duration-700" />

      <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-slate-900 shadow-2xl shadow-black/60">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 h-9 bg-slate-800/80 border-b border-white/5">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
          </div>
          <div className="flex-1 mx-6">
            <div className="h-5 bg-slate-700/40 rounded-md text-[10px] text-slate-500 flex items-center justify-center font-mono">
              cekatan.com/t/gis-safety/results
            </div>
          </div>
        </div>

        {/* Results content */}
        <div className="p-5 min-h-[280px] flex flex-col items-center justify-center text-center">
          <p className="text-[8px] text-slate-500 mb-1">PT. Gama Intisamudera</p>
          <p className="text-[11px] font-semibold text-white/90 mb-5">Ujian Keselamatan Kerja</p>

          {/* Score circle */}
          <div className="relative w-24 h-24 mb-4">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" stroke="#1e293b" strokeWidth="6" fill="none" />
              <circle cx="50" cy="50" r="42" stroke="#22c55e" strokeWidth="6" fill="none"
                strokeDasharray={`${0.88 * 2 * Math.PI * 42} ${2 * Math.PI * 42}`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white">88%</span>
              <span className="text-[8px] font-semibold text-green-400">LULUS</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-6 mb-5">
            <div className="text-center">
              <p className="text-[10px] font-semibold text-white">17/20</p>
              <p className="text-[7px] text-slate-500">Benar</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-semibold text-white">70%</p>
              <p className="text-[7px] text-slate-500">Nilai Lulus</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-semibold text-white">15:28</p>
              <p className="text-[7px] text-slate-500">Waktu</p>
            </div>
          </div>

          {/* Certificate button */}
          <div className="w-full max-w-[200px] px-4 py-2 rounded-lg bg-blue-600 text-[9px] text-white font-medium flex items-center justify-center gap-1.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Unduh Sertifikat
          </div>

          <p className="text-[7px] text-slate-600 mt-3">Hasil ini telah dicatat oleh PT. Gama Intisamudera</p>
        </div>
      </div>
    </div>
  )
}

/* ─── Analytics Mockup ─── */

export function AnalyticsMockup({ className = '' }: { className?: string }) {
  return (
    <div className={`relative group ${className}`}>
      <div className="absolute -inset-1 bg-gradient-to-b from-purple-500/15 via-blue-400/10 to-transparent rounded-2xl blur-2xl opacity-50 group-hover:opacity-70 transition-opacity duration-700" />

      <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-slate-900 shadow-2xl shadow-black/60">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 h-9 bg-slate-800/80 border-b border-white/5">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
          </div>
          <div className="flex-1 mx-6">
            <div className="h-5 bg-slate-700/40 rounded-md text-[10px] text-slate-500 flex items-center justify-center font-mono">
              cekatan.com/orgs/gama/analytics
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3 min-h-[280px]">
          {/* Header */}
          <div>
            <p className="text-[10px] font-semibold text-white/90">Analitik Organisasi</p>
            <p className="text-[7px] text-slate-500">PT. Gama Intisamudera</p>
          </div>

          {/* Summary stat cards */}
          <div className="grid grid-cols-4 gap-2">
            <AnalyticsStatCard value="8" label="Asesmen" sub="5 diterbitkan" color="blue" />
            <AnalyticsStatCard value="24" label="Peserta" sub="156 percobaan" color="purple" />
            <AnalyticsStatCard value="76%" label="Skor Rata-rata" sub="142 selesai" color="green" />
            <AnalyticsStatCard value="78%" label="Kelulusan" sub="12 timeout" color="amber" />
          </div>

          {/* Bar chart: weekly activity */}
          <div className="rounded-lg bg-slate-800/50 p-2.5 border border-white/[0.04]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[8px] text-slate-400 font-medium">Aktivitas Mingguan (12 Minggu)</span>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-blue-500" />
                <span className="text-[6px] text-slate-500">Penyelesaian</span>
              </div>
            </div>
            <svg className="w-full h-12" viewBox="0 0 240 48">
              {[8, 12, 6, 15, 10, 18, 14, 22, 16, 20, 25, 19].map((v, i) => (
                <rect key={i} x={i * 20 + 2} y={48 - v * 1.6} width="14" height={v * 1.6} rx="1.5" fill="#3b82f6" fillOpacity={i === 10 ? 1 : 0.7} />
              ))}
            </svg>
          </div>

          {/* Score distribution + pass rate */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Score distribution */}
            <div className="rounded-lg bg-slate-800/50 p-2.5 border border-white/[0.04]">
              <span className="text-[8px] text-slate-400 font-medium">Distribusi Skor</span>
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                <div className="rounded-md bg-red-500/10 border border-red-500/20 p-1.5 text-center">
                  <p className="text-[10px] font-bold text-red-400">12</p>
                  <p className="text-[5px] text-red-400/70">&lt;40%</p>
                  <p className="text-[5px] text-slate-600">Kesulitan</p>
                </div>
                <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-1.5 text-center">
                  <p className="text-[10px] font-bold text-amber-400">45</p>
                  <p className="text-[5px] text-amber-400/70">40-70%</p>
                  <p className="text-[5px] text-slate-600">Berkembang</p>
                </div>
                <div className="rounded-md bg-green-500/10 border border-green-500/20 p-1.5 text-center">
                  <p className="text-[10px] font-bold text-green-400">85</p>
                  <p className="text-[5px] text-green-400/70">≥70%</p>
                  <p className="text-[5px] text-slate-600">Mahir</p>
                </div>
              </div>
            </div>

            {/* Assessment table */}
            <div className="rounded-lg bg-slate-800/50 p-2.5 border border-white/[0.04]">
              <span className="text-[8px] text-slate-400 font-medium">Rincian Asesmen</span>
              <div className="mt-2 space-y-1">
                <div className="flex items-center text-[6px] text-slate-600 border-b border-white/5 pb-1">
                  <span className="flex-1">Nama</span>
                  <span className="w-8 text-right">Skor</span>
                  <span className="w-8 text-right">Lulus</span>
                </div>
                {[
                  { name: 'K3 Pelabuhan', score: '82%', pass: '85%' },
                  { name: 'ISPS Code', score: '76%', pass: '72%' },
                  { name: 'Crane Safety', score: '71%', pass: '68%' },
                  { name: 'First Aid', score: '89%', pass: '92%' },
                ].map((a) => (
                  <div key={a.name} className="flex items-center text-[7px] py-0.5">
                    <span className="flex-1 text-slate-300 truncate">{a.name}</span>
                    <span className="w-8 text-right text-slate-400">{a.score}</span>
                    <span className="w-8 text-right text-green-400">{a.pass}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Helper sub-components ─── */

function NavItem({ active, icon, label }: { active?: boolean; icon: string; label: string }) {
  const icons: Record<string, React.ReactNode> = {
    home: <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />,
    clipboard: <><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /></>,
    chart: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
    book: <path d="M4 19.5A2.5 2.5 0 016.5 17H20V4H6.5A2.5 2.5 0 004 6.5v13z" />,
    user: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  }

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md ${active ? 'bg-blue-500/15 border border-blue-500/20' : 'hover:bg-slate-700/20'}`}>
      <svg className={`w-3 h-3 ${active ? 'text-blue-400' : 'text-slate-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {icons[icon]}
      </svg>
      <span className={`text-[8px] ${active ? 'text-blue-300 font-medium' : 'text-slate-500'}`}>{label}</span>
    </div>
  )
}

function DashStatCard({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) {
  const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', iconBg: 'bg-blue-500/20' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', iconBg: 'bg-purple-500/20' },
    green: { bg: 'bg-green-500/10', text: 'text-green-400', iconBg: 'bg-green-500/20' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', iconBg: 'bg-amber-500/20' },
  }
  const c = colorMap[color]

  const icons: Record<string, React.ReactNode> = {
    users: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></>,
    chart: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
    trending: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
    target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  }

  return (
    <div className={`rounded-lg ${c.bg} p-2 border border-white/[0.04]`}>
      <div className={`w-5 h-5 rounded ${c.iconBg} flex items-center justify-center mb-1`}>
        <svg className={`w-3 h-3 ${c.text}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {icons[icon]}
        </svg>
      </div>
      <p className="text-[11px] font-bold text-white">{value}</p>
      <p className="text-[7px] text-slate-500">{label}</p>
    </div>
  )
}

function AnalyticsStatCard({ value, label, sub, color }: { value: string; label: string; sub: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-500/20 bg-blue-500/5',
    purple: 'border-purple-500/20 bg-purple-500/5',
    green: 'border-green-500/20 bg-green-500/5',
    amber: 'border-amber-500/20 bg-amber-500/5',
  }
  return (
    <div className={`rounded-lg p-2 border ${colorMap[color]}`}>
      <p className="text-[11px] font-bold text-white">{value}</p>
      <p className="text-[7px] text-slate-400">{label}</p>
      <p className="text-[6px] text-slate-600 mt-0.5">{sub}</p>
    </div>
  )
}

function ExamOption({ letter, text, selected }: { letter: string; text: string; selected?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors ${
      selected
        ? 'bg-blue-500/10 border-blue-500/30'
        : 'bg-slate-800/30 border-white/[0.04]'
    }`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold shrink-0 ${
        selected
          ? 'bg-blue-500 text-white border-2 border-blue-400'
          : 'bg-slate-800 text-slate-400 border-2 border-slate-600'
      }`}>
        {letter}
      </div>
      <span className={`text-[8px] leading-relaxed ${selected ? 'text-blue-200' : 'text-slate-400'}`}>{text}</span>
    </div>
  )
}
