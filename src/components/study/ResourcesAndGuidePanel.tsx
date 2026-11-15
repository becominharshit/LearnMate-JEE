import React, { useEffect, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { MathRichText } from '../MathRichText';
import { apiFetchWithAuth } from '../../services/workspaceService';

interface ResourcesAndGuidePanelProps {
  onAddQuickSheetMaterial: (
    title: string,
    subject: 'Physics' | 'Chemistry' | 'Mathematics',
    contentSummary: string
  ) => void;
}

const SUBJECT_QUICK_SHEETS: Record<
  'Physics' | 'Chemistry' | 'Mathematics',
  { title: string; formulas: string[] }[]
> = {
  Physics: [
    {
      title: 'Mechanics – Laws of Motion & Work',
      formulas: [
        '$\\vec{F} = \\frac{d\\vec{p}}{dt} = m\\vec{a}$',
        '$f_s \\le \\mu_s N, \\quad f_k = \\mu_k N$',
        '$W = \\int \\vec{F}\\cdot d\\vec{r} = \\Delta K$',
      ],
    },
    {
      title: 'Electrostatics & RC Circuits',
      formulas: [
        '$F = \\frac{1}{4\\pi\\varepsilon_0}\\frac{q_1 q_2}{r^2}$',
        '$q(t) = C\\varepsilon\\left(1 - e^{-t/RC}\\right)$',
        '$V = IR, \\quad P = I^2 R$',
      ],
    },
    {
      title: 'Ray Optics & Modern Physics',
      formulas: [
        '$\\frac{1}{v} - \\frac{1}{u} = \\frac{1}{f}, \\quad m = \\frac{v}{u}$',
        '$E = hf = \\frac{hc}{\\lambda}$',
        '$N(t) = N_0 e^{-\\lambda t}$',
      ],
    },
  ],
  Chemistry: [
    {
      title: 'Electrochemistry & Chemical Kinetics',
      formulas: [
        '$E_{\\text{cell}} = E^\\circ_{\\text{cell}} - \\frac{0.0591}{n}\\log_{10} Q$',
        '$k = \\frac{2.303}{t}\\log\\frac{[A]_0}{[A]}$',
        '$k = A e^{-E_a / RT}$',
      ],
    },
    {
      title: 'Thermodynamics & Equilibrium',
      formulas: [
        '$\\Delta G = \\Delta H - T\\Delta S = -nFE_{\\text{cell}}$',
        '$K_p = K_c (RT)^{\\Delta n_g}$',
        '$\\text{pH} = \\text{p}K_a + \\log\\frac{[\\text{Salt}]}{[\\text{Acid}]}$',
      ],
    },
    {
      title: 'Coordination & d-f Block',
      formulas: [
        '$\\mu_{\\text{spin}} = \\sqrt{n(n+2)}\\text{ BM}$',
        '$\\Delta_o = \\frac{4}{9}\\Delta_t\\text{ (inversion: }\\Delta_t = \\frac{4}{9}\\Delta_o)$',
        'CFSE (Octahedral) $= (-0.4 n_{t_{2g}} + 0.6 n_{e_g})\\Delta_o$',
      ],
    },
  ],
  Mathematics: [
    {
      title: 'Definite Integrals & Calculus',
      formulas: [
        '$\\int_0^a f(x)\\,dx = \\int_0^a f(a - x)\\,dx$',
        '$\\frac{d}{dx}\\int_{g(x)}^{h(x)} f(t)\\,dt = f(h(x))h\'(x) - f(g(x))g\'(x)$',
        '$\\lim_{x\\to 0}\\frac{\\sin x}{x} = 1, \\quad \\lim_{x\\to 0}(1+x)^{1/x} = e$',
      ],
    },
    {
      title: 'Conic Sections (Parabola & Ellipse)',
      formulas: [
        '$y^2 = 4ax \\implies P(at^2, 2at),\\;\\text{L.R.} = 4a$',
        '$\\frac{x^2}{a^2} + \\frac{y^2}{b^2} = 1,\\; b^2 = a^2(1 - e^2)$',
        '$PF_1 + PF_2 = 2a$',
      ],
    },
    {
      title: 'Complex Numbers & Vectors 3D',
      formulas: [
        '$z = re^{i\\theta} = r(\\cos\\theta + i\\sin\\theta)$',
        '$\\vec{a}\\times(\\vec{b}\\times\\vec{c}) = (\\vec{a}\\cdot\\vec{c})\\vec{b} - (\\vec{a}\\cdot\\vec{b})\\vec{c}$',
        '$d = \\frac{|(\\vec{a}_2 - \\vec{a}_1)\\cdot(\\vec{b}_1\\times\\vec{b}_2)|}{|\\vec{b}_1\\times\\vec{b}_2|}$',
      ],
    },
  ],
};

interface PortalCard {
  title: string;
  badge: string;
  desc: string;
  domain: string;
  url?: string;
  storeLinks?: { label: string; url: string }[];
}

const OFFICIAL_PORTALS: PortalCard[] = [
  {
    title: 'SATHEE (IIT Kanpur)',
    badge: 'Free Portal',
    desc: 'JEE video lectures, practice tests & mentorship by MoE.',
    domain: 'sathee.iitk.ac.in',
    url: 'https://sathee.iitk.ac.in/exams/jee',
  },
  {
    title: 'National Test Abhyas',
    badge: 'NTA App',
    desc: 'Official NTA mobile mock practice app for JEE Main & NEET.',
    domain: 'Google Play · App Store',
    storeLinks: [
      {
        label: 'Google Play',
        url: 'https://play.google.com/store/apps/details?id=com.abhyas.nta.com',
      },
      {
        label: 'App Store',
        url: 'https://apps.apple.com/in/app/national-test-abhyas/id1516503179',
      },
    ],
  },
  {
    title: 'JEE Main Portal',
    badge: 'Bulletin',
    desc: 'Syllabus PDF, public notices & exam schedule.',
    domain: 'jeemain.nta.nic.in',
    url: 'https://jeemain.nta.nic.in',
  },
  {
    title: 'NCERT e-Textbooks',
    badge: 'Textbooks',
    desc: 'Class 11 & 12 Physics, Chemistry, Math NCERT books.',
    domain: 'ncert.nic.in',
    url: 'https://ncert.nic.in/textbook.php',
  },
];

export const ResourcesAndGuidePanel: React.FC<ResourcesAndGuidePanelProps> = ({
  onAddQuickSheetMaterial,
}) => {
  const [resourceSubTab, setResourceSubTab] = useState<
    'Official Portals' | 'Exam Guide' | 'Quick Sheets'
  >('Official Portals');
  const [examGuideTab, setExamGuideTab] = useState<
    'Pattern' | 'Marking' | 'Exam Rules' | 'Schedule'
  >('Pattern');
  const [quickSheetSubject, setQuickSheetSubject] = useState<
    'Physics' | 'Chemistry' | 'Mathematics'
  >('Physics');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{
    text: string;
    sources: { title: string; uri: string }[];
  } | null>(null);
  const [searchingWeb, setSearchingWeb] = useState(false);

  useEffect(() => {
    setSearchResult(null);
  }, []);

  const handleGroundedSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchingWeb(true);
    try {
      const res = await apiFetchWithAuth<{ text?: string; sources?: { title: string; uri: string }[] }>(
        '/api/ai/search',
        { prompt: searchQuery }
      );
      if (!res.ok) {
        setSearchResult({
          text: `[${res.error.errorCode}] ${res.error.message}`,
          sources: [],
        });
      } else {
        setSearchResult({
          text: res.data.text || 'No grounded results returned.',
          sources: res.data.sources || [],
        });
      }
    } finally {
      setSearchingWeb(false);
    }
  };

  const activeSheets = SUBJECT_QUICK_SHEETS[quickSheetSubject];

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-12 py-5 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-semibold tracking-[-0.02em] text-2xl sm:text-3xl text-[#0F172A] dark:text-[#F8FAFC]">
            Resources
          </h1>
        </div>

        <form onSubmit={handleGroundedSearch} className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="w-4 h-4 text-[#475569] dark:text-[#94A3B8] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search live NTA JEE notices..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#111827] text-xs text-[#0F172A] dark:text-[#F8FAFC]"
            />
          </div>
          <button
            type="submit"
            disabled={searchingWeb}
            className="px-4 py-2 rounded-lg btn-brand text-xs font-semibold cursor-pointer transition-colors duration-150"
          >
            {searchingWeb ? 'Searching...' : 'Search NTA'}
          </button>
        </form>
      </div>

      {searchResult && (
        <div className="p-4 rounded-2xl bg-[#F1F5F9] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] space-y-2 text-xs">
          <div className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            Grounded Search Result
          </div>
          <div className="text-[#475569] dark:text-[#94A3B8] leading-relaxed">
            <MathRichText content={searchResult.text} />
          </div>
          {searchResult.sources.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {searchResult.sources.map((src, i) => (
                <a
                  key={i}
                  href={src.uri}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-md bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] text-[#0F172A] dark:text-[#F8FAFC] font-medium inline-flex items-center gap-1 hover:underline"
                >
                  <span>{src.title}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-[#E2E8F0] dark:border-white/[0.08] pb-1 overflow-x-auto">
        {(['Official Portals', 'Exam Guide', 'Quick Sheets'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setResourceSubTab(t)}
            className={`px-4 py-2 rounded-t-lg text-xs font-semibold border-b-2 transition-colors duration-150 whitespace-nowrap cursor-pointer ${
              resourceSubTab === t
                ? 'text-[#2563EB] dark:text-[#60A5FA] border-[#2563EB] dark:border-[#60A5FA]'
                : 'text-[#475569] dark:text-[#94A3B8] border-transparent hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 space-y-4">
          <h2 className="font-semibold tracking-[-0.02em] text-base text-[#0F172A] dark:text-[#F8FAFC]">
            Official Portals
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {OFFICIAL_PORTALS.map((portal) => (
              <div
                key={portal.title}
                className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                      {portal.title}
                    </h3>
                    <span className="text-[11px] font-medium text-[#475569] dark:text-[#94A3B8] whitespace-nowrap">
                      {portal.badge}
                    </span>
                  </div>
                  <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                    {portal.desc}
                  </p>
                </div>

                {portal.storeLinks ? (
                  <div className="pt-2 border-t border-[#E2E8F0] dark:border-white/[0.08] flex flex-wrap items-center gap-2">
                    {portal.storeLinks.map((store) => (
                      <a
                        key={store.label}
                        href={store.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 min-w-[110px] justify-center px-3 py-1.5 rounded-lg btn-brand text-xs font-semibold inline-flex items-center gap-1.5 transition-colors duration-150"
                      >
                        <span>{store.label}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F0] dark:border-white/[0.08]">
                    <span className="text-[11px] font-medium text-[#475569] dark:text-[#94A3B8]">
                      {portal.domain}
                    </span>
                    <a
                      href={portal.url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg btn-brand text-xs font-semibold inline-flex items-center gap-1.5 transition-colors duration-150"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 space-y-5">
          <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold tracking-[-0.02em] text-base text-[#0F172A] dark:text-[#F8FAFC]">
                Exam Guide
              </h2>
              <div className="flex items-center gap-1 text-xs">
                {(['Pattern', 'Marking', 'Exam Rules', 'Schedule'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setExamGuideTab(tab)}
                    className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors duration-150 ${
                      examGuideTab === tab
                        ? 'btn-brand text-white font-semibold'
                        : 'text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {examGuideTab === 'Pattern' && (
              <div className="divide-y divide-[#E2E8F0] dark:divide-white/[0.08] text-xs">
                {[
                  { k: 'Mode', v: 'Computer Based Test (CBT)' },
                  { k: 'Duration', v: '3 hours (180 mins)' },
                  { k: 'Subjects', v: 'Physics, Chemistry, Mathematics' },
                  {
                    k: 'Questions',
                    v: '75 compulsory (25/subject: 20 MCQ + 5 Numerical)',
                  },
                  { k: 'Total Marks', v: '300' },
                ].map((row) => (
                  <div key={row.k} className="py-2.5 flex items-center justify-between gap-2">
                    <span className="text-[#475569] dark:text-[#94A3B8]">{row.k}</span>
                    <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] text-right tabular-nums">
                      {row.v}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {examGuideTab === 'Marking' && (
              <div className="divide-y divide-[#E2E8F0] dark:divide-white/[0.08] text-xs">
                <div className="py-2.5 flex justify-between gap-2">
                  <span className="text-[#475569] dark:text-[#94A3B8]">Section A (20 MCQs)</span>
                  <span className="tabular-nums font-semibold text-[#00A86B]">+4 / −1</span>
                </div>
                <div className="py-2.5 flex justify-between gap-2">
                  <span className="text-[#475569] dark:text-[#94A3B8]">Section B (5 Numericals)</span>
                  <span className="tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                    +4 / −1 (NTA 2027)
                  </span>
                </div>
                <div className="py-2.5 flex justify-between gap-2">
                  <span className="text-[#475569] dark:text-[#94A3B8]">JEE Adv Multi-Choice</span>
                  <span className="tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                    +4 / +1 Partial / −2
                  </span>
                </div>
                <div className="py-2.5 flex justify-between gap-2">
                  <span className="text-[#475569] dark:text-[#94A3B8]">JEE Adv Numericals</span>
                  <span className="tabular-nums font-semibold text-[#0F172A] dark:text-[#F8FAFC]">+4 / 0</span>
                </div>
              </div>
            )}

            {examGuideTab === 'Exam Rules' && (
              <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                Bring your NTA Admit Card, valid photo ID, and transparent ballpoint pen. Electronic devices, calculators, and log tables are prohibited.
              </p>
            )}

            {examGuideTab === 'Schedule' && (
              <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                Session 1: January 2027 (09:00–12:00 IST, 15:00–18:00 IST). Session 2: April 2027.
              </p>
            )}
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold tracking-[-0.02em] text-base text-[#0F172A] dark:text-[#F8FAFC]">
                Quick Formula Sheets
              </h2>
              <div className="flex items-center gap-1 text-xs">
                {(['Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => setQuickSheetSubject(subj)}
                    className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors duration-150 ${
                      quickSheetSubject === subj
                        ? 'btn-brand text-white font-semibold'
                        : 'text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                    }`}
                  >
                    {subj}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {activeSheets.map((sheet) => (
                <div
                  key={sheet.title}
                  className="rounded-xl bg-[#F8FAFF] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-white/[0.08] p-3.5 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <h3 className="font-semibold text-xs text-[#0F172A] dark:text-[#F8FAFC]">
                      {sheet.title}
                    </h3>
                    <div className="space-y-1.5 text-[11px] text-[#475569] dark:text-[#94A3B8]">
                      {sheet.formulas.map((f, i) => (
                        <div key={i}>
                          <MathRichText content={f} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onAddQuickSheetMaterial(
                        sheet.title,
                        quickSheetSubject,
                        `**${sheet.title}**: ${sheet.formulas.join(' | ')}`
                      )
                    }
                    className="w-full py-1.5 rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-white/[0.08] text-[#0F172A] dark:text-[#F8FAFC] font-medium text-[11px] hover:bg-[#F1F5F9] dark:hover:bg-[#283548] transition-colors duration-150 cursor-pointer"
                  >
                    + Add to Materials
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
