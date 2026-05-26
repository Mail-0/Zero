import { GitHub } from '@/components/icons/icons';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

/** Orchid 5-petal logomark. Fills with currentColor so it can be tinted via
 *  Tailwind text-* utilities. Source: orchid.ai brand. */
function OrchidMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  // Each petal is two cubic Beziers that meet at a sharp cusp at the tip;
  // we add a same-color stroke with round joins/caps to soften those cusps
  // and force geometricPrecision so the browser doesn't fall back to fast
  // (jaggy) rasterization at small sizes.
  const petals = [
    'M10.0469 4.36984C10.0469 8.68706 13.1977 11.5443 14.1306 12.2957C14.2834 12.4187 14.4921 12.4187 14.645 12.2957C15.5778 11.5444 18.7288 8.68731 18.7288 4.3701C18.7288 1.36715 17.3 0 14.3878 0C11.4756 0 10.0469 1.36688 10.0469 4.36984Z',
    'M22.9625 7.46631C18.8837 8.8004 17.1579 12.6999 16.7364 13.8253C16.6673 14.0096 16.7318 14.2095 16.8953 14.3177C17.8934 14.9787 21.5663 17.1125 25.6451 15.7784C28.4822 14.8504 29.3323 13.0601 28.4324 10.2719C27.5324 7.48375 25.7996 6.53834 22.9625 7.46631Z',
    'M24.028 20.7882C21.5072 17.2955 17.2897 16.8483 16.0963 16.7925C15.9008 16.7833 15.7319 16.9068 15.6801 17.0968C15.3641 18.2566 14.4832 22.4324 17.004 25.9251C18.7574 28.3545 20.7115 28.6152 23.0676 26.8921C25.4237 25.1688 25.7814 23.2177 24.028 20.7882Z',
    'M11.7707 25.9253C14.2915 22.4326 13.4107 18.2567 13.0947 17.0969C13.0429 16.9068 12.8741 16.7833 12.6785 16.7925C11.4852 16.8483 7.2678 17.2953 4.74698 20.788C2.99356 23.2174 3.35116 25.1688 5.70723 26.8921C8.06329 28.6152 10.0173 28.3547 11.7707 25.9253Z',
    'M3.13025 15.7782C7.20901 17.1123 10.8821 14.9786 11.8802 14.3177C12.0438 14.2094 12.1082 14.0096 12.0392 13.8252C11.6177 12.6999 9.89214 8.80041 5.81336 7.46631C2.97627 6.53835 1.24313 7.48372 0.343193 10.2719C-0.556745 13.06 0.293156 14.8503 3.13025 15.7782Z',
  ];
  return (
    <svg
      viewBox="-0.6 -0.6 30 29.2"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Orchid logo"
      shapeRendering="geometricPrecision"
      className={className}
      style={style}
    >
      <g
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={0.9}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {petals.map((d) => (
          <path key={d} d={d} fillRule="evenodd" clipRule="evenodd" />
        ))}
      </g>
    </svg>
  );
}

/**
 * 0.email → Orchid announcement page.
 *
 * The original Zero landing is deprecated. This page exists to gracefully
 * hand visitors off to https://orchid.ai (the executive assistant that
 * grew out of 0.email) while still letting existing users sign in to the
 * legacy Zero inbox.
 */
export default function HomeContent() {
  const { setTheme } = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Lightweight, cached fetch of GitHub star count so the button feels alive.
  const { data: githubData } = useQuery<{ stargazers_count: number }>({
    queryKey: ['githubStars'],
    queryFn: async () => {
      const res = await fetch('https://api.github.com/repos/Mail-0/Zero', {
        headers: { Accept: 'application/vnd.github.v3+json' },
      });
      if (!res.ok) throw new Error('Failed to fetch GitHub stars');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const stars = githubData?.stargazers_count;

  useEffect(() => {
    setTheme('dark');
  }, [setTheme]);

  // Respect reduced-motion: pause the ambient orchid loop.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) videoRef.current?.pause();
  }, []);

  return (
    <main className="relative flex min-h-svh w-full flex-col overflow-hidden bg-[#070708] text-white">
      {/* ── Ambient orchid video, softly masked, top-right ─────────────────── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute -right-[18%] -top-[22%] h-[125%] w-[110%] opacity-[0.55] md:-right-[8%] md:-top-[18%] md:h-[130%] md:w-[75%]"
          style={{
            maskImage: 'url(/orchid-mask.svg)',
            WebkitMaskImage: 'url(/orchid-mask.svg)',
            maskSize: '100% 100%',
            WebkitMaskSize: '100% 100%',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            poster="/orchid-hero-poster.jpg"
            className="block h-full w-full select-none object-cover"
            style={{ objectPosition: '30% center' }}
            draggable={false}
          >
            <source src="/orchid-hero.webm" type="video/webm" />
            <source src="/orchid-hero.mp4" type="video/mp4" />
          </video>
        </div>

        {/* Soft warm halo behind the orchid */}
        <div className="absolute -right-[10%] top-[5%] h-[600px] w-[600px] rounded-full bg-[#f5b46a]/10 blur-[160px] md:h-[800px] md:w-[800px]" />
        {/* Deep violet pool, bottom-left, anchors the copy */}
        <div className="absolute -bottom-[20%] -left-[10%] h-[700px] w-[700px] rounded-full bg-[#3a2566]/40 blur-[180px]" />
        {/* Subtle paper grain at the very back */}
        <div
          className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
          style={{
            backgroundImage: 'url(/orchid-mountain.jpeg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        {/* Vignette so copy stays readable */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 80% at 20% 60%, rgba(7,7,8,0) 0%, rgba(7,7,8,0.65) 60%, rgba(7,7,8,0.95) 100%)',
          }}
        />
      </div>

      {/* ── Minimal top bar ──────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12 md:py-8">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex items-center gap-2.5"
        >
          <img src="/white-icon.svg" alt="" width={20} height={20} className="opacity-70" />
          <span className="text-[13px] font-medium tracking-tight text-white/70">0.email</span>
          <span className="mx-1 h-3 w-px bg-white/20" />
          <span className="text-[12px] text-white/45">est. spring 2025</span>
        </motion.div>
        <motion.a
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
          href="https://orchid.ai"
          className="group hidden items-center gap-2 text-[13px] text-white/60 transition-colors hover:text-white sm:inline-flex"
        >
          orchid.ai
          <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">
            →
          </span>
        </motion.a>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative z-10 flex flex-1 flex-col justify-center px-6 pb-24 pt-12 md:px-16 md:pb-32 md:pt-20">
        <div className="max-w-[760px]">
          {/* Eyebrow chip */}
          <motion.div
            initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 backdrop-blur-sm"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e9c896] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#e9c896]" />
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/70">
              A new chapter
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="font-serif text-[clamp(44px,8vw,96px)] font-medium leading-[0.95] tracking-[-0.04em] text-white"
            style={{
              fontFamily:
                "'Louize', 'Cormorant Garamond', 'EB Garamond', ui-serif, Georgia, serif",
            }}
          >
            {/* Line 1: 0.email (with animated strikethrough) is now */}
            <span className="block text-white/55">
              <span className="relative inline-block">
                <span>0.email</span>
                <motion.span
                  aria-hidden
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.85 }}
                  className="pointer-events-none absolute left-0 top-[55%] h-[3px] w-full origin-left rounded-full bg-gradient-to-r from-white/70 via-[#e9c896]/80 to-transparent"
                />
              </span>{' '}
              <span className="text-white/35">is now</span>
            </span>
            {/* Line 2: Orchid. */}
            <motion.span
              initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1], delay: 1.15 }}
              className="mt-1 flex items-baseline gap-4"
            >
              <span
                className="bg-gradient-to-br from-white via-[#fff0d8] to-[#e0b07a] bg-clip-text text-transparent"
                style={{ paddingRight: '0.05em' }}
              >
                Orchid.
              </span>
              <motion.span
                aria-hidden
                initial={{ opacity: 0, scale: 0.6, rotate: -18 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 1.3 }}
                className="hidden -translate-y-1 text-white md:inline-flex"
                style={{ filter: 'drop-shadow(0 0 22px rgba(255,255,255,0.45))' }}
              >
                <OrchidMark className="h-12 w-12 md:h-[58px] md:w-[58px]" />
              </motion.span>
            </motion.span>
          </motion.h1>

          {/* Body copy */}
          <motion.p
            initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 1.9 }}
            className="mt-8 max-w-[560px] text-[15px] leading-[1.65] text-white/65 md:text-[17px]"
          >
            What started as the fastest open-source inbox grew into something bigger.{' '}
            <span className="text-white/85">
              Orchid is the executive assistant that doesn&apos;t sleep
            </span>
            — handling your inbox, calendar, meeting prep, and follow-ups, in your voice, approved
            by you.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 2.2 }}
            className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
          >
            <a
              href="https://orchid.ai"
              className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-white px-6 py-3.5 text-[14px] font-medium text-[#08152e] shadow-[0_10px_40px_-10px_rgba(255,228,180,0.45)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_14px_50px_-10px_rgba(255,228,180,0.6)] active:scale-[0.98]"
            >
              <span className="relative z-10">Meet Orchid</span>
              <span className="relative z-10 inline-block transition-transform duration-200 group-hover:translate-x-0.5">
                →
              </span>
              {/* subtle warm sheen */}
              <span
                aria-hidden
                className="absolute inset-0 -z-0 bg-gradient-to-r from-white via-[#fff4dd] to-white opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />
            </a>
            <a
              href="https://app.0.email"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-6 py-3.5 text-[14px] font-medium text-white/85 backdrop-blur-sm transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
            >
              Sign in to Zero
            </a>
            <a
              href="https://github.com/Mail-0/Zero"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-5 py-3.5 text-[14px] font-medium text-white/85 backdrop-blur-sm transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
            >
              <GitHub className="h-[15px] w-[15px] fill-white/85 transition-colors group-hover:fill-white" />
              <span>GitHub</span>
              {typeof stars === 'number' && stars > 0 ? (
                <span className="flex items-center gap-1 border-l border-white/15 pl-2 text-[12.5px] text-white/55">
                  <span aria-hidden>★</span>
                  {stars.toLocaleString()}
                </span>
              ) : null}
            </a>
          </motion.div>

          {/* Read the announcement / signature */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 2.5 }}
            className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-3 text-[12.5px] text-white/40"
          >
            <a
              href="https://orchid.ai/blog/the-end-of-inbox-zero"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-white/70"
            >
              <span>Read the announcement</span>
              <span className="text-white/30">↗</span>
            </a>
            <span className="hidden h-3 w-px bg-white/15 sm:inline-block" />
            <Link to="/privacy" className="transition-colors hover:text-white/70">
              Privacy
            </Link>
            <Link to="/terms" className="transition-colors hover:text-white/70">
              Terms
            </Link>
            <span className="hidden h-3 w-px bg-white/15 sm:inline-block" />
            <span className="text-white/30">© 2025 Zero Email Inc.</span>
          </motion.div>
        </div>
      </section>

      {/* Edge ornament: thin horizon line, like a serif underscore */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 2.4 }}
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-px origin-left bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />
    </main>
  );
}

