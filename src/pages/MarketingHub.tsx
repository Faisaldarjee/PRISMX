import React, { useState } from 'react';
import { BangOnLogo } from '../components/BangOnLogo';
import { Copy, Check, Download, Video, Share2, Sparkles, Flame, Tv, ArrowRight } from 'lucide-react';

export const MarketingHub: React.FC = () => {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const triggerCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // Raw SVG content of the new upgraded Bang On Logo, perfect for DP conversion!
  const logoRawSvg = `<svg width="512" height="512" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="solidGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#FFF7D6" />
      <stop offset="20%" stopColor="#F5C453" />
      <stop offset="50%" stopColor="#D89E23" />
      <stop offset="80%" stopColor="#FEEA98" />
      <stop offset="100%" stopColor="#96690B" />
    </linearGradient>

    <linearGradient id="shinyBevel" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#96690B" />
      <stop offset="30%" stopColor="#F5C453" />
      <stop offset="50%" stopColor="#FFFFFF" />
      <stop offset="70%" stopColor="#FFDF79" />
      <stop offset="100%" stopColor="#4A2F03" />
    </linearGradient>

    <radialGradient id="innerBgGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor="#121B2E" />
      <stop offset="60%" stopColor="#080D1A" />
      <stop offset="100%" stopColor="#03050C" />
    </radialGradient>
  </defs>

  <circle cx="100" cy="100" r="92" fill="url(#innerBgGlow)" stroke="url(#solidGold)" strokeWidth="6" />
  <circle cx="100" cy="100" r="84" stroke="#4A3610" strokeWidth="2" fill="none" opacity="0.8" />

  <line x1="88" y1="62" x2="88" y2="108" stroke="url(#solidGold)" strokeWidth="3" />
  <rect x="83" y="72" width="10" height="26" fill="url(#solidGold)" stroke="#2D1D04" strokeWidth="1.5" rx="1.5" />

  <line x1="106" y1="50" x2="106" y2="102" stroke="url(#shinyBevel)" strokeWidth="3" />
  <rect x="101" y="60" width="10" height="32" fill="url(#shinyBevel)" stroke="#2D1D04" strokeWidth="1.5" rx="1.5" />

  <line x1="124" y1="38" x2="124" y2="92" stroke="#FFFDF5" strokeWidth="3" />
  <rect x="119" y="46" width="10" height="36" fill="#FFFDF5" stroke="#2D1D04" strokeWidth="1.5" rx="1.5" />

  <path 
    d="M 60 45 
       L 115 45 
       C 145 45, 150 72, 126 92 
       C 152 100, 146 142, 110 145 
       L 60 145 
       Z" 
    fill="none" 
    stroke="url(#solidGold)" 
    strokeWidth="13" 
    strokeLinejoin="round" 
    strokeLinecap="round" 
  />
  <path 
    d="M 60 45 
       L 115 45 
       C 145 45, 150 72, 126 92 
       C 152 100, 146 142, 110 145 
       L 60 145 
       Z" 
    fill="none" 
    stroke="url(#shinyBevel)" 
    strokeWidth="4" 
    strokeLinejoin="round" 
    strokeLinecap="round" 
    opacity="0.95"
  />

  <path 
    d="M 42 125 
       L 78 90 
       L 100 110 
       L 155 52" 
    fill="none" 
    stroke="#000000" 
    strokeWidth="20" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
  />
  <path 
    d="M 42 125 
       L 78 90 
       L 100 110 
       L 155 52" 
    fill="none" 
    stroke="url(#solidGold)" 
    strokeWidth="13" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
  />
  <path 
    d="M 42 125 
       L 78 90 
       L 100 110 
       L 155 52" 
    fill="none" 
    stroke="#FFFDF5" 
    strokeWidth="4.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
  />

  <g transform="translate(155, 52) rotate(-42)">
    <polygon 
      points="0,0 -22,13 -13,3" 
      fill="#B08323" 
      stroke="#1E1602" 
      strokeWidth="1" 
    />
    <polygon 
      points="0,0 -13,-3 -22,-13" 
      fill="#FFFDF5" 
      stroke="#F5C453" 
      strokeWidth="1" 
    />
    <line x1="0" y1="0" x2="-13" y2="0" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.95" />
  </g>
</svg>`;

  const downloadLogo = () => {
    const element = document.createElement("a");
    const file = new Blob([logoRawSvg], { type: 'image/svg+xml' });
    element.href = URL.createObjectURL(file);
    element.download = "bang_on_ai_3d_gold_logo.svg";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const copySvgText = () => {
    triggerCopy(logoRawSvg, "svgCode");
  };

  // Launch text copy blocks
  const linkedinText = `🚀 Unveiling Bang On AI — The Ultimate Quant & Momentum Intelligence Suite for Indian Markets! 🇮🇳📈

Navigating market volatility requires strategy, not guesswork. Real wealth is compiled through structured SIPs and surgical swing targets, not hyperactive trading. 

For the past several months, we have been building Bang On AI, a full-stack algorithmic intelligence desk. It's built specifically for long-term retail investors and momentum swing traders navigating Indian equities, indices, and precious metals.

🔥 Key Highlights:
1. Smart Swing Engine: Scans NSE for dynamic breakouts using proprietary supply-demand zones.
2. Intelligent SIP Strategy Hub: Auto-synced accumulation points so you never average top-heavy valuations.
3. Live Accuracy Matrix: Complete mathematical transparency on every backtested signal.
4. Native Multi-Agent System: AI analysts distilling massive real-time macro sentiments into clean, actionable insights.

We are officially in Soft Launch. No hype, just pristine math, high fidelity charts, and institutional precision. 

👉 Join the Trade Desk now. Sync your favorite ticker watches with secure cloud backup today.
Explore the app: https://bangon-ai.web.app

#FinTech #AI #QuantInvesting #IndianStockMarket #FinanceInnovation #StockSwing #WealthBuilding`;

  const instagramText = `FINALLY WE ARE LIVE! 🚀🔥 Say hello to Bang On AI. 

No fancy jargon, no premium noise, no hidden secrets. Pure mathematical precision for Indian Retail Gold, Silver, and NSE Stock accumulators. 🇮🇳

We got tired of overly complicated trading terminal setups. So we built an algorithmic companion that:
📊 Tracks dynamic daily accumulation zones.
🎯 Spotlights Smart Swing zones.
🧬 Keeps a real-time, transparent Accuracy Matrix.
🤖 Integrates intelligent multi-agent market digests.

Check out our new premium 3D gold monogram logo! It represents structure, candle-breakout momentum, and upward accumulation waves. 📈💎

👉 Click the link in bio to register on the web-app and synchronize your real-time alerts. 
Drop a 🔥 in the comments if you want early passcodes!

#IndianStockMarket #WealthAccumulation #GoldInvesting #NiftyBreakout #BangOnAI #TradingPlatform #ActiveInvesting #WealthCreations`;

  // Dynamic AI Video Teaser Prompts
  const teaserPrompts = [
    {
      id: "clip1",
      title: "Moment 1: Ambient Macro Opening (The Spark)",
      promptText: "Cinematic macro shot of golden dust particles and light rays slowly falling onto a dark obsidian mechanical trading terminal. In the background, glowing holographic candlestick charts (red and emerald) flicker inside a dark futuristic void. Cyberpunk moody lighting, 3d render, ultra-realistic, slowly zooming in, 4k resolution, high-end motion design.",
      duration: "0:04",
      vibe: "Intense, futuristic, full of suspense."
    },
    {
      id: "clip2",
      title: "Moment 2: The Monogram Reveal (The Brand)",
      promptText: "Brushed 3D liquid metallic gold forming a beautiful monogram letter 'B'. Glows with a bright neon golden aura. The background is a clean matte-dark slate surface with subtle technical radar lines. Liquid metal flows upwards and is shiny. Stunning 3D path illustration, cinematic cinematic studio lighting, slow rotative pan, perfect branding reveal.",
      duration: "0:04",
      vibe: "Sophisticated, premium, high status."
    },
    {
      id: "clip3",
      title: "Moment 3: Slicing the Market (Breakout Arrow)",
      promptText: "Dynamic close-up shot of an energetic gold lightning zig-zag trend line slicing sharply upwards and to the right across a dark grid. Sparks fly off the arrowhead as it breaks through multiple holographic glass resistance barriers. Action motion, high-speed camera, gold particles scattering everywhere, beautiful 3D motion design.",
      duration: "0:03",
      vibe: "Fast, energetic, victorious breakout."
    },
    {
      id: "clip4",
      title: "Moment 4: Automated Trading Screen (The Science)",
      promptText: "Glowy abstract UI dashboard showing charts and data tables pulsing dynamically. Multiple small gold nodes are blinking, connecting with laser-thin neon lines to represent the 'Multi-Agent Network'. Text displays read 'ACQUIRING TREND' and 'ACCUMULATING' in monospace clean golden fonts. Sci-fi, extremely clean, tech aesthetic, shallow depth of field, 4k.",
      duration: "0:04",
      vibe: "High-tech, precise, quantitative logic."
    },
    {
      id: "clip5",
      title: "Moment 5: The Final Dynamic Fusion (The Teaser Outro)",
      promptText: "Slow zoom out to reveal the full golden circular emblem combining the monogram letter B and the breakout zigzag arrow, glowing with radiant neon light on a dark marble surface. Cinematic camera flash flares once, and then the screen softly dissolves into golden particle dust. Elegant, luxurious, final cinematic outro, 3d render.",
      duration: "0:05",
      vibe: "Impactful, premium, memorable call-to-action."
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Background radial effects */}
      <div className="absolute top-[-5%] right-[-10%] w-[350px] h-[350px] bg-[radial-gradient(circle,rgba(212,168,67,0.04),transparent_70%)] rounded-full pointer-events-none -z-10" />

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.04] pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-mono text-xs uppercase tracking-[0.2em] mb-1 font-bold">
            <Sparkles size={12} className="animate-pulse" />
            Vibe check & Launch Center
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-sans text-white">
            Marketing Kit & Branding Hub
          </h1>
          <p className="text-[#8892A4] font-body text-xs md:text-sm mt-1 max-w-2xl">
            Surgical copy vectors, AI Video Teaser prompts, and High-Resolution download kits. Everything you need to capture LinkedIn and Instagram attention elegantly.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={downloadLogo}
            className="px-4 py-2 bg-[#D4A843] hover:bg-[#E8C070] text-[#05070C] rounded-lg font-data text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-md shadow-[#D4A843]/10 transition-all cursor-pointer active:scale-95"
          >
            <Download size={13} /> Download Vector Logo 
          </button>
        </div>
      </div>

      {/* BENTO GRID: BRAND ASSET BLOCK AND SOCIAL COPYWRITING */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: INSTAGRAM DP / LOGO PLAYGROUND (4 COLUMNS) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="glass-card p-6 bg-white/[0.02] border border-white/[0.04] rounded-2xl relative overflow-hidden flex flex-col items-center justify-between min-h-[460px]">
            <div className="absolute top-0 right-0 p-3">
              <span className="text-[8px] font-mono tracking-wider text-amber-500 font-bold border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 rounded uppercase">
                High-Res SVG Active
              </span>
            </div>

            <div className="text-center w-full mt-4">
              <h2 className="text-xs font-black font-mono uppercase tracking-[0.2em] text-white">
                Instagram / LinkedIn DP
              </h2>
              <p className="text-[10px] text-[#8892A4] font-mono mt-0.5">
                Scales perfectly to 512x512 without pixelation.
              </p>
            </div>

            {/* Glowing Large Logo Demonstration Container */}
            <div className="my-8 relative flex items-center justify-center p-6 bg-[#040710] border border-white/[0.04] rounded-2xl shadow-inner w-56 h-56 transition-transform hover:scale-105 duration-300">
              <div className="absolute inset-0 bg-radial from-[#F5C453]/15 via-transparent to-transparent opacity-60 blur-xl rounded-full" />
              <BangOnLogo size={160} showText={false} className="relative z-10" />
            </div>

            <div className="w-full space-y-2.5">
              <button 
                onClick={downloadLogo}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-100 rounded-xl font-mono text-xs font-bold tracking-wider flex items-center justify-center gap-2 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
              >
                <Download size={12} /> Save SVG direct to Desktop
              </button>

              <button 
                onClick={copySvgText}
                className="w-full py-2 bg-transparent hover:bg-zinc-950/40 text-[#8892A4] hover:text-[#FFF] rounded-lg font-mono text-[10px] flex items-center justify-center gap-1.5 transition-colors border border-transparent hover:border-white/[0.03]"
              >
                {copiedText === 'svgCode' ? (
                  <>
                    <Check size={11} className="text-emerald-400" /> SVG code Copied!
                  </>
                ) : (
                  <>
                    <Copy size={11} /> Copy Raw SVG Code for conversion
                  </>
                )}
              </button>

              <div className="p-3 bg-[#0A0E1A]/60 rounded-lg border border-[#F5C453]/10 text-center">
                <p className="text-[10px] text-[#8892A4] font-body leading-relaxed">
                  💡 <span className="text-[#F5C453] font-semibold">How to get PNG?</span> Simply download this SVG, double click to open in Chrome/Safari, then right-click internally and press <span className="text-white underline">"Save Page As..."</span> or upload to any online conversion tool for an ultra high-res 4K PNG.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: PROFESSIONAL launch posts (7 COLUMNS) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="glass-card p-6 bg-white/[0.02] border border-white/[0.04] rounded-2xl space-y-6">
            
            {/* LINKEDIN POST TEMPLATE */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black font-mono tracking-wider text-sky-400 uppercase flex items-center gap-1.5 leading-none">
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" /> LinkedIn Soft Launch Copy
                </span>
                <button 
                  onClick={() => triggerCopy(linkedinText, 'linkedin')}
                  className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 rounded-lg text-[10px] font-mono text-slate-300 hover:text-white flex items-center gap-1 px-1.5 transition-colors cursor-pointer"
                >
                  {copiedText === 'linkedin' ? (
                    <>
                      <Check size={11} className="text-emerald-400" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={11} /> Copy Template
                    </>
                  )}
                </button>
              </div>
              <div className="p-4 bg-slate-950/70 border border-slate-900 rounded-xl max-h-52 overflow-y-auto select-all">
                <pre className="font-mono text-[11px] leading-relaxed text-[#8892A4] whitespace-pre-wrap">
                  {linkedinText}
                </pre>
              </div>
            </div>

            {/* INSTAGRAM BIO CORNER */}
            <div className="border-t border-white/[0.04] pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black font-mono tracking-wider text-pink-400 uppercase flex items-center gap-1.5 leading-none">
                  <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" /> Instagram Feed Description
                </span>
                <button 
                  onClick={() => triggerCopy(instagramText, 'instagram')}
                  className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 rounded-lg text-[10px] font-mono text-slate-300 hover:text-white flex items-center gap-1 px-1.5 transition-colors cursor-pointer"
                >
                  {copiedText === 'instagram' ? (
                    <>
                      <Check size={11} className="text-emerald-400" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={11} /> Copy Template
                    </>
                  )}
                </button>
              </div>
              <div className="p-4 bg-slate-950/70 border border-slate-900 rounded-xl max-h-44 overflow-y-auto select-all">
                <pre className="font-mono text-[11px] leading-relaxed text-[#8892A4] whitespace-pre-wrap">
                  {instagramText}
                </pre>
              </div>
            </div>

            {/* IG STORY BRIEF IDEAS */}
            <div className="border-t border-white/[0.04] pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 bg-sky-950/10 border border-sky-900/20 rounded-xl">
                <h4 className="text-[11px] font-bold font-mono text-sky-400 uppercase tracking-wider">💡 LINKEDIN LAUNCH STRATEGY</h4>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  Focus heavily on backtesting numbers, math correctness, and the lack of junk trading recommendations in our smart algorithms. Tag your fintech network and request beta reviews.
                </p>
              </div>
              <div className="p-3.5 bg-pink-950/10 border border-pink-900/20 rounded-xl">
                <h4 className="text-[11px] font-bold font-mono text-pink-400 uppercase tracking-wider">💡 INSTAGRAM STORY STRATEGY</h4>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  Record a brief screen video of mouse scrolling through the dynamic chart breakouts on the <strong>Dashboard</strong>. Add the new gold monogram logo as a sticker and use a dark synth music track!
                </p>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* TEASER VIDEO STORYBOARD SECTION - GENERATE VIDEO CLIPS & COMBINE */}
      <div className="glass-card p-6 bg-white/[0.02] border border-white/[0.04] rounded-2xl space-y-6">
        <div>
          <div className="flex items-center gap-2 text-[#00D084] font-mono text-xs uppercase tracking-[0.22em] mb-1 font-bold">
            <Video size={13} className="text-[#00D084]" />
            AI Video Generator Storyboard (Gen-3, Luma, LTX, Sora Prompts)
          </div>
          <h2 className="text-xl font-bold font-sans text-white">
            Cinematic Teaser Trailer Storyboard
          </h2>
          <p className="text-[#8892A4] font-body text-xs mt-1">
            Feed these 5 precise prompts into any AI Video Generator (e.g. runwayml.com, luma labs, sora or krea). Once processed, combine them back-to-back in CapCut, InShot or Premiere, throw on a bass-heavy dark synth music track, and you've got a viral reel or trailer.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 pt-2">
          {teaserPrompts.map((clip, index) => (
            <div 
              key={clip.id} 
              className="p-4 bg-slate-950/50 border border-white/[0.03] hover:border-[#D4A843]/15 rounded-xl flex flex-col justify-between transition-all group scale-100 hover:scale-[1.02]"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[8.5px] font-mono uppercase tracking-wider text-[#D4A843] font-bold">
                    CLIP {index + 1} ({clip.duration})
                  </span>
                  <Tv size={11} className="text-slate-600 group-hover:text-[#D4A843] transition-colors" />
                </div>
                <h3 className="text-xs font-bold leading-tight font-sans text-white truncate">
                  {clip.title}
                </h3>
                <p className="text-[10.5px] text-[#8892A4] leading-relaxed line-clamp-5 select-all hover:text-slate-300">
                  "{clip.promptText}"
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.03] space-y-2">
                <span className="text-[8.5px] font-mono text-slate-500 block italic leading-snug">
                  vibe: {clip.vibe}
                </span>
                <button
                  onClick={() => triggerCopy(clip.promptText, clip.id)}
                  className={`w-full py-1 rounded-md text-[9px] font-semibold font-mono tracking-wider uppercase transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    copiedText === clip.id 
                      ? 'bg-emerald-550 text-white' 
                      : 'bg-slate-900 group-hover:bg-slate-850 text-slate-300 hover:text-white'
                  }`}
                >
                  {copiedText === clip.id ? (
                    <>
                      <Check size={9} /> Prompt Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={9} /> Copy Prompt
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-emerald-950/10 border border-emerald-900/20 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wide">🔥 MASTER TEASER ASSEMBLY GUIDE:</h4>
            <ul className="list-disc list-inside text-[10px] text-slate-400 space-y-1 mt-1 leading-relaxed">
              <li>Generate each of the 5 scenes above on Runway Gen-2 / Gen-3 or Luma Labs (set durations to 3-5s).</li>
              <li>Download the 5 clips and place them in order on a mobile editor timelines like InShot, VN, or CapCut.</li>
              <li>Add a slow, deep visual transition (like a subtle fade to black or film flash) on each cut.</li>
              <li>Add a dark retro synthesizer background beat, sync the final emblem hit to the beat drop, and upload!</li>
            </ul>
          </div>
          <button 
            onClick={() => triggerCopy(teaserPrompts.map(p => `${p.title}\nPrompt: "${p.promptText}"\n`).join('\n'), 'allPrompts')}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-slate-200 rounded-lg text-xs font-mono font-bold border border-slate-800 flex items-center gap-2 shrink-0 cursor-pointer transition-colors"
          >
            {copiedText === 'allPrompts' ? (
              <>
                <Check size={11} className="text-emerald-400" /> Copied All Storyboards!
              </>
            ) : (
              <>
                <Copy size={11} /> Copy All 5 Prompts
              </>
            )}
          </button>
        </div>

      </div>

    </div>
  );
};
