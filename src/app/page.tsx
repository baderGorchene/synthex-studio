'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles, ArrowRight, Check, ShieldCheck, Database, FileText,
  Network, Cpu, Layers, BookOpen, ExternalLink,
  ChevronDown, ChevronUp, Share2, Compass, CheckCircle2
} from 'lucide-react';
import { SynthexLogo } from '@/components/brand/SynthexLogo';

export default function MarketingLandingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Interactive Mini-Demo State
  const [selectedDemoNode, setSelectedDemoNode] = useState<string>('node-rag');
  const [demoFilter, setDemoFilter] = useState<'all' | 'claims' | 'sources'>('all');

  const demoNodes = [
    {
      id: 'node-rag',
      type: 'concept',
      title: 'Retrieval-Augmented Generation',
      subtitle: 'Hybrid Semantic + Lexical Pipeline',
      badge: 'Core Concept',
      color: 'border-[#284b63] bg-[#284b63]/[0.06] text-[#284b63]',
      x: 40,
      y: 70
    },
    {
      id: 'node-claim-1',
      type: 'claim',
      title: 'Dense embeddings fail on multi-hop cross-document reasoning',
      subtitle: 'Supported by 14 empirical benchmarks',
      badge: 'Supported Claim',
      status: 'supported',
      color: 'border-emerald-500 bg-emerald-50/80 text-emerald-950',
      x: 340,
      y: 30
    },
    {
      id: 'node-claim-2',
      type: 'claim',
      title: 'Graph RAG reduces hallucinations by 42% in technical domains',
      subtitle: 'Edge-weighted Personalized PageRank',
      badge: 'Verified Assertion',
      status: 'supported',
      color: 'border-emerald-500 bg-emerald-50/80 text-emerald-950',
      x: 340,
      y: 200
    },
    {
      id: 'node-source',
      type: 'source',
      title: 'arXiv:2603.04891v2 (March 2026)',
      subtitle: 'Deep Epistemic Verification in LLMs',
      badge: 'Academic Source',
      color: 'border-amber-500 bg-amber-50/80 text-amber-950',
      x: 640,
      y: 110
    }
  ];

  const faqs = [
    {
      q: 'What are Context Credits and how do they work?',
      a: 'Context Credits are the transparent currency used in Synthex to power AI research and synthesis without confusing dollar micro-fractions. A Graph Chat inquiry costs 1 credit, a Quick Web-Grounded Research session costs 5 credits, and a Deep Multi-Hop Investigation (3 web hops + cross-axis decomposition) costs 20 credits. Every new user receives 100 free credits on our 3-day trial without needing a credit card.'
    },
    {
      q: 'Does Synthex silently write or hallucinate facts into my graph?',
      a: 'Never. Synthex operates on strict Human-in-the-Loop epistemic review (Principle #2). When autonomous research runs finish, proposed nodes and relationships enter a dedicated Review Queue. You inspect every proposed claim, citation quote, and connection before accepting or rejecting them into your workspace.'
    },
    {
      q: 'Can I bring my own OpenAI or Gemini API key (BYOK)?',
      a: 'Yes! The BYOK tier ($3.00/month) gives you full cloud sync, unlimited workspaces, Google Cloud Storage paper vaults, and PDF citation deep-linking. You plug your own OpenAI or Google Gemini API key into workspace settings with zero platform AI markup.'
    },
    {
      q: 'How does Synthex work offline for local developers?',
      a: 'Synthex features a dual-mode database engine. When running locally without cloud services or Clerk API keys, it uses SQLite with full local disk storage in zero-config offline mode. You can export your graphs at any moment into clean JSON, Mermaid diagrams, or Markdown vaults.'
    },
    {
      q: 'Can I export my research to Obsidian or Logseq?',
      a: 'Yes. With one click, Synthex packages your active research workspace into a standardized Obsidian / Logseq .zip vault complete with YAML frontmatter, bidirectional [[wikilinks]], canvas JSON, and structured folders.'
    },
    {
      q: 'How do Teams collaborate on Synthex?',
      a: 'The Team Plan ($29.99/seat/mo) integrates Clerk Organizations with role-based access control (Admin, Researcher, Reviewer). Teams share a 5,000 monthly pooled Context Credit allowance, collaborate on shared live graphs, and coordinate research review queues.'
    }
  ];

  return (
    <div className="marketing-landing-page min-h-screen bg-white text-[#353535] selection:bg-[#3c6e71] selection:text-white font-sans antialiased overflow-x-clip">
      {/* Background Decorative Gradients & Grid */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[600px] bg-gradient-to-b from-[#3c6e71]/[0.08] via-[#284b63]/[0.04] to-transparent blur-3xl opacity-70" />
        <div className="absolute top-[800px] -left-[200px] w-[600px] h-[600px] bg-[#3c6e71]/[0.04] blur-[120px] rounded-full" />
        <div className="absolute top-[1400px] -right-[200px] w-[700px] h-[700px] bg-[#284b63]/[0.04] blur-[140px] rounded-full" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(40, 75, 99, 0.18) 1px, transparent 0)`,
            backgroundSize: '28px 28px'
          }}
        />
      </div>

      {/* STICKY BLURRED NAVBAR */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/90 border-b border-[#d9d9d9] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105">
              <SynthexLogo size={34} />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-[#353535] group-hover:text-[#284b63] transition-colors">
                Synthex
              </span>
              <span className="text-[10.5px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-[#3c6e71]/10 border border-[#3c6e71]/30 text-[#3c6e71]">
                Studio
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#4f5d5b]">
            <a href="#features" className="hover:text-[#284b63] transition-colors">Features</a>
            <a href="#metaphor" className="hover:text-[#284b63] transition-colors">The Folded Sheet</a>
            <a href="#evidence" className="hover:text-[#284b63] transition-colors">Evidence Paths</a>
            <a href="#pricing" className="hover:text-[#284b63] transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-[#284b63] transition-colors">FAQ</a>
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/app"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-[#4f5d5b] hover:text-[#284b63] hover:bg-[#f7f8f7] transition-all"
            >
              Open Studio
            </Link>
            <Link
              href="/sign-in"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-[#4f5d5b] hover:text-[#284b63] hover:bg-[#f7f8f7] transition-all"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-[#3c6e71] hover:bg-[#284b63] text-white shadow-md shadow-[#284b63]/15 hover:shadow-[#284b63]/15 transition-all"
            >
              <span>Start 3-Day Trial</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* Mobile Menu Trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(v => !v)}
            className="md:hidden p-2 rounded-lg text-[#64706f] hover:text-[#284b63] hover:bg-[#f7f8f7]"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-[#d9d9d9] bg-white/95 backdrop-blur-xl px-4 pt-3 pb-6 space-y-3">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 text-[#4f5d5b] hover:text-[#284b63]">Features</a>
            <a href="#metaphor" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 text-[#4f5d5b] hover:text-[#284b63]">The Folded Sheet</a>
            <a href="#evidence" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 text-[#4f5d5b] hover:text-[#284b63]">Evidence Paths</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 text-[#4f5d5b] hover:text-[#284b63]">Pricing</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 text-[#4f5d5b] hover:text-[#284b63]">FAQ</a>
            <div className="pt-3 border-t border-[#d9d9d9] flex flex-col gap-2">
              <Link href="/app" className="text-center py-2 text-sm text-[#4f5d5b] bg-[#f7f8f7] rounded-lg font-medium">Launch App</Link>
              <Link href="/sign-up" className="text-center py-2 text-sm bg-[#3c6e71] text-white rounded-lg font-semibold">Start Free Trial (100 Credits)</Link>
            </div>
          </div>
        )}
      </header>

      {/* HERO SECTION */}
      <section className="landing-hero relative z-10 pt-16 pb-20 sm:pt-24 sm:pb-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="landing-hero-copy text-left max-w-3xl mr-auto space-y-6">
          {/* Eyebrow Pill */}
          <div className="landing-trust-line inline-flex items-center gap-2 text-[#3c6e71] text-xs font-semibold">
            <span className="flex h-1.5 w-1.5 rounded-full bg-[#3c6e71]" />
            <span>Desktop-First · Strict Epistemic Provenance · Zero Silent Writes</span>
          </div>

          {/* Primary Headline */}
          <h1 className="landing-hero-title text-4xl sm:text-6xl font-extrabold tracking-tight text-[#353535] leading-[1.12]">
            Transform Unstructured Insights into{' '}
            <span className="text-[#284b63]">
              Grounded Semantic Graphs
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-[#4f5d5b] leading-relaxed font-normal max-w-2xl">
            Stop losing critical dependencies across flat documents and infinite whiteboards.
            Synthex synthesizes papers, web sources, and assertions into an auditable knowledge graph — with every claim verified against ground truth.
          </p>

          {/* CTA Buttons */}
          <div className="landing-hero-actions pt-2 flex flex-col sm:flex-row items-center justify-start gap-4">
            <Link
              href="/sign-up"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#3c6e71] hover:bg-[#284b63] text-white font-semibold text-sm shadow-xl shadow-[#284b63]/15 hover:shadow-[#284b63]/15 transition-all group"
            >
              <Sparkles size={16} className="text-white" />
              <span>Start Free 3-Day Trial</span>
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/app"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#f7f8f7] hover:bg-[#eef1f0]/90 border border-[#d9d9d9] text-[#353535] hover:text-[#284b63] font-semibold text-sm transition-all shadow-sm"
            >
              <span>Explore Interactive Studio</span>
              <ExternalLink size={14} className="text-[#64706f]" />
            </Link>
          </div>

          {/* Trial Value Callout */}
          <div className="landing-trial-details flex flex-wrap items-center justify-start gap-x-4 gap-y-2 text-xs text-[#64706f] pt-1">
            <span className="flex items-center gap-1.5"><Check size={14} className="text-[#3c6e71]" /> 100 Free Context Credits</span>
            <span>·</span>
            <span className="flex items-center gap-1.5"><Check size={14} className="text-[#3c6e71]" /> No credit card required</span>
            <span>·</span>
            <span className="flex items-center gap-1.5"><Check size={14} className="text-[#3c6e71]" /> Instant local SQLite fallback</span>
          </div>
        </div>

        {/* INTERACTIVE MINI-CANVAS SHOWCASE */}
        <div id="evidence" className="landing-canvas-preview mt-12 relative rounded-2xl border border-[#d9d9d9] bg-white shadow-lg p-4 sm:p-6 overflow-hidden">
          {/* Top Bar of the Mock Canvas */}
          <div className="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-[#d9d9d9] gap-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/70 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/70 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/70 inline-block" />
              <span className="ml-2 text-xs font-mono text-[#64706f]">synthex-workspace // rag-epistemic-survey</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDemoFilter('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${demoFilter === 'all' ? 'bg-[#3c6e71]/10 text-[#3c6e71] border border-[#3c6e71]/40' : 'text-[#64706f] hover:text-[#284b63]'}`}
              >
                All Cards
              </button>
              <button
                type="button"
                onClick={() => setDemoFilter('claims')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${demoFilter === 'claims' ? 'bg-[#3c6e71]/10 text-[#3c6e71] border border-[#3c6e71]/40' : 'text-[#64706f] hover:text-[#284b63]'}`}
              >
                Claims (2)
              </button>
              <button
                type="button"
                onClick={() => setDemoFilter('sources')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${demoFilter === 'sources' ? 'bg-[#3c6e71]/10 text-[#3c6e71] border border-[#3c6e71]/40' : 'text-[#64706f] hover:text-[#284b63]'}`}
              >
                Sources (1)
              </button>
            </div>
          </div>

          {(() => {
            // --- Responsive graph layout ---
            // Use a viewBox-based approach so the graph scales to fit the container
            const VB_W = 920; // viewBox width
            const VB_H = 380; // viewBox height
            const CARD_W = 200;
            const CARD_H = 130;

            // Positions: 3-column directed graph layout (concept → claims → source)
            const nodePositions: Record<string, { x: number; y: number }> = {
              'node-rag':     { x: 20,  y: (VB_H - CARD_H) / 2 },       // centered-left
              'node-claim-1': { x: 280, y: 20 },                         // top-center
              'node-claim-2': { x: 280, y: VB_H - CARD_H - 20 },        // bottom-center
              'node-source':  { x: 700, y: (VB_H - CARD_H) / 2 },       // centered-right
            };

            // Edge definitions with semantic labels
            const demoEdges = [
              { from: 'node-rag', to: 'node-claim-1', label: 'generates', color: '#284b63', dashed: true },
              { from: 'node-rag', to: 'node-claim-2', label: 'generates', color: '#284b63', dashed: false },
              { from: 'node-claim-1', to: 'node-source', label: 'cited by', color: '#3c6e71', dashed: true },
              { from: 'node-claim-2', to: 'node-source', label: 'grounded in', color: '#8a5a00', dashed: false },
            ];

            // Filter visible nodes
            const visibleNodes = demoNodes.filter(n => {
              if (demoFilter === 'claims' && n.type !== 'claim') return false;
              if (demoFilter === 'sources' && n.type !== 'source') return false;
              return true;
            });
            const visibleIds = new Set(visibleNodes.map(n => n.id));
            const visibleEdges = demoEdges.filter(e => visibleIds.has(e.from) && visibleIds.has(e.to));

            return (
              <div className="landing-sheet-frame relative bg-[#fafbfb] rounded-xl border border-[#d9d9d9] overflow-hidden">
                {/* Responsive SVG canvas — scales to fill container width */}
                <svg
                  className="w-full h-auto block"
                  viewBox={`0 0 ${VB_W} ${VB_H}`}
                  preserveAspectRatio="xMidYMid meet"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Dot grid background */}
                  <defs>
                    <pattern id="demo-dot-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                      <circle cx="10" cy="10" r="0.8" fill="#c0c5c4" />
                    </pattern>
                    <marker id="demo-arrow-dark" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
                      <path d="M 0 0 L 8 3 L 0 6 Z" fill="#284b63" />
                    </marker>
                    <marker id="demo-arrow-teal" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
                      <path d="M 0 0 L 8 3 L 0 6 Z" fill="#3c6e71" />
                    </marker>
                    <marker id="demo-arrow-amber" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
                      <path d="M 0 0 L 8 3 L 0 6 Z" fill="#8a5a00" />
                    </marker>
                    {/* Card drop shadow */}
                    <filter id="card-shadow" x="-6%" y="-6%" width="112%" height="118%">
                      <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#284b63" floodOpacity="0.08" />
                    </filter>
                    <filter id="card-shadow-active" x="-6%" y="-6%" width="112%" height="118%">
                      <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#3c6e71" floodOpacity="0.15" />
                    </filter>
                  </defs>

                  <rect width={VB_W} height={VB_H} fill="url(#demo-dot-grid)" />

                  {/* Edges */}
                  {visibleEdges.map((edge, i) => {
                    const from = nodePositions[edge.from];
                    const to = nodePositions[edge.to];
                    if (!from || !to) return null;

                    const x1 = from.x + CARD_W;
                    const y1 = from.y + CARD_H / 2;
                    const x2 = to.x;
                    const y2 = to.y + CARD_H / 2;

                    const dx = (x2 - x1) * 0.45;
                    const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                    const labelX = (x1 + x2) / 2;
                    const labelY = (y1 + y2) / 2;

                    const markerId = edge.color === '#284b63' ? 'demo-arrow-dark' : edge.color === '#3c6e71' ? 'demo-arrow-teal' : 'demo-arrow-amber';

                    return (
                      <g key={`edge-${i}`}>
                        <path
                          d={pathD}
                          fill="none"
                          stroke={edge.color}
                          strokeWidth="1.5"
                          strokeDasharray={edge.dashed ? '5 3' : 'none'}
                          strokeOpacity="0.55"
                          markerEnd={`url(#${markerId})`}
                          className="landing-edge-flow"
                        />
                        {/* Edge label */}
                        <rect x={labelX - 30} y={labelY - 9} width="60" height="16" rx="8" fill="white" fillOpacity="0.92" stroke={edge.color} strokeWidth="0.8" strokeOpacity="0.25" />
                        <text x={labelX} y={labelY + 3} textAnchor="middle" fill={edge.color} fontSize="8" fontWeight="600" letterSpacing="0.3" opacity="0.85">
                          {edge.label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Card nodes rendered as SVG foreignObject for proper text wrapping */}
                  {visibleNodes.map(node => {
                    const pos = nodePositions[node.id];
                    if (!pos) return null;
                    const isSelected = selectedDemoNode === node.id;

                    return (
                      <g key={node.id}>
                        {/* Card background rect */}
                        <rect
                          x={pos.x}
                          y={pos.y}
                          width={CARD_W}
                          height={CARD_H}
                          rx="12"
                          fill="white"
                          stroke={isSelected ? '#3c6e71' : '#d9d9d9'}
                          strokeWidth={isSelected ? '2' : '1'}
                          filter={isSelected ? 'url(#card-shadow-active)' : 'url(#card-shadow)'}
                          className="cursor-pointer transition-all"
                          onClick={() => setSelectedDemoNode(node.id)}
                        />
                        {/* Selection ring */}
                        {isSelected && (
                          <rect
                            x={pos.x - 3}
                            y={pos.y - 3}
                            width={CARD_W + 6}
                            height={CARD_H + 6}
                            rx="14"
                            fill="none"
                            stroke="#3c6e71"
                            strokeWidth="1"
                            strokeOpacity="0.2"
                          />
                        )}
                        {/* Card content via foreignObject */}
                        <foreignObject
                          x={pos.x}
                          y={pos.y}
                          width={CARD_W}
                          height={CARD_H}
                          className="cursor-pointer"
                          onClick={() => setSelectedDemoNode(node.id)}
                        >
                          <div
                            className="w-full h-full p-3 flex flex-col justify-between"
                            style={{ fontFamily: 'inherit' }}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[8px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-[#f0f1f0] text-[#4f5d5b]">
                                  {node.badge}
                                </span>
                                {node.status === 'supported' && (
                                  <span className="flex items-center gap-0.5 text-[8px] font-semibold text-[#167256]">
                                    <CheckCircle2 size={9} /> Supported
                                  </span>
                                )}
                              </div>
                              <h4 className="text-[11px] font-semibold text-[#353535] leading-tight line-clamp-2">{node.title}</h4>
                              <p className="text-[9px] text-[#64706f] mt-0.5 leading-snug line-clamp-2">{node.subtitle}</p>
                            </div>

                            <div className="pt-1.5 border-t border-[#e5e5e5] flex items-center justify-between text-[8px] text-[#64706f]">
                              <span>Click to inspect</span>
                              <ArrowRight size={9} className={isSelected ? 'text-[#3c6e71]' : 'text-[#64706f]'} />
                            </div>
                          </div>
                        </foreignObject>
                      </g>
                    );
                  })}
                </svg>
              </div>
            );
          })()}

          {/* Interactive Inspection Ribbon */}
          <div className="mt-4 p-3 rounded-lg bg-white border border-[#d9d9d9] flex flex-col sm:flex-row items-center justify-between text-xs text-[#4f5d5b] gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#3c6e71] shrink-0" />
              <span>
                <strong>Epistemic Guarantee:</strong> Selected card verified against 3 peer-reviewed citations. 0 unchecked assertions.
              </span>
            </div>
            <Link
              href="/app"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#3c6e71] hover:text-[#3c6e71] shrink-0"
            >
              Open in full canvas editor <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* LOGO & TRUST PROOF BANNER */}
        <div className="landing-proof mt-16 pt-10 border-t border-[#d9d9d9] text-left">
          <p className="text-xs uppercase tracking-widest text-[#64706f] font-semibold mb-6">
            Architected for Rigorous Research & Technical Synthesis
          </p>
          <div className="landing-proof-list grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-4xl text-[#64706f] text-xs font-medium">
            <div className="landing-proof-item flex items-center gap-2 py-3">
              <CheckCircle2 size={15} className="text-[#3c6e71]" />
              <span>Grounded Google Search</span>
            </div>
            <div className="landing-proof-item flex items-center gap-2 py-3">
              <Cpu size={15} className="text-[#3c6e71]" />
              <span>GPT-6 & Gemini Multi-Hop</span>
            </div>
            <div className="landing-proof-item flex items-center gap-2 py-3">
              <Database size={15} className="text-[#284b63]" />
              <span>Local SQLite + Cloud SQL</span>
            </div>
            <div className="landing-proof-item flex items-center gap-2 py-3">
              <Share2 size={15} className="text-[#8a5a00]" />
              <span>Obsidian & Logseq Vaults</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: THE FOLDED KNOWLEDGE SHEET METAPHOR */}
      <section id="metaphor" className="py-20 border-t border-[#d9d9d9] bg-[#f7f8f7] relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="text-xs uppercase font-bold tracking-widest text-[#3c6e71]">Design Philosophy</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#353535] tracking-tight">
              The &ldquo;Folded Knowledge Sheet&rdquo; Metaphor
            </h2>
            <p className="text-[#4f5d5b] text-sm sm:text-base leading-relaxed">
              Why linear note tools and infinite whiteboards fail modern research — and how Synthex restores durable semantic clarity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-white border border-[#d9d9d9] hover:border-[#d9d9d9] transition-all">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-[#b4233a] mb-5">
                <FileText size={20} />
              </div>
              <h3 className="text-lg font-bold text-[#353535] mb-2">Flat Documents Hide Structure</h3>
              <p className="text-sm text-[#64706f] leading-relaxed">
                Linear docs force complex, multi-variable investigations into an artificial vertical scroll. Critical contradictions and dependency paths disappear into paragraph text.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-[#d9d9d9] hover:border-[#d9d9d9] transition-all">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#8a5a00] mb-5">
                <Layers size={20} />
              </div>
              <h3 className="text-lg font-bold text-[#353535] mb-2">Whiteboards Become Chaotic</h3>
              <p className="text-sm text-[#64706f] leading-relaxed">
                Freeform infinite whiteboards lack semantic types. Without structured relations like <code className="text-[#8a5a00] text-xs font-mono">supports</code> or <code className="text-[#b4233a] text-xs font-mono">contradicts</code>, boards devolve into unmanageable sticker piles.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-b from-[#3c6e71]/10 to-white border border-[#3c6e71]/40 shadow-xl shadow-[#284b63]/10">
              <div className="w-10 h-10 rounded-xl bg-[#3c6e71]/10 border border-[#3c6e71]/30 flex items-center justify-center text-[#3c6e71] mb-5">
                <Sparkles size={20} />
              </div>
              <h3 className="text-lg font-bold text-[#353535] mb-2">The Synthex Semantic Sheet</h3>
              <p className="text-sm text-[#4f5d5b] leading-relaxed">
                A calm, paper-like surface with collapsible sub-canvas clusters. Labeled directional edges preserve causality, while human-in-the-loop review protects graph integrity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: CORE FEATURES & CAPABILITIES */}
      <section id="features" className="py-24 border-t border-[#d9d9d9] relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="text-xs uppercase font-bold tracking-widest text-[#3c6e71]">System Capabilities</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#353535] tracking-tight">
              Built for Researchers Who Demand Grounded Truth
            </h2>
            <p className="text-[#4f5d5b] text-sm sm:text-base leading-relaxed">
              Every feature is designed around rigor: verified web grounding, human sign-off, and portable knowledge.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-white border border-[#d9d9d9] hover:border-[#3c6e71]/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-[#3c6e71]/10 border border-[#3c6e71]/30 flex items-center justify-center text-[#3c6e71] mb-4 group-hover:scale-110 transition-transform">
                <Compass size={20} />
              </div>
              <h3 className="text-base font-bold text-[#353535] mb-2">Recursive Deep Research</h3>
              <p className="text-xs sm:text-sm text-[#64706f] leading-relaxed">
                Deconstructs inquiries across analytical axes (foundational theory, empirical breakthrough, counterarguments) using multi-hop web exploration with live streaming steps.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-white border border-[#d9d9d9] hover:border-[#3c6e71]/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-[#3c6e71]/10 border border-[#3c6e71]/30 flex items-center justify-center text-[#3c6e71] mb-4 group-hover:scale-110 transition-transform">
                <ShieldCheck size={20} />
              </div>
              <h3 className="text-base font-bold text-[#353535] mb-2">Zero Silent AI Writes</h3>
              <p className="text-xs sm:text-sm text-[#64706f] leading-relaxed">
                AI never injects unchecked facts into your graph. Generated proposals wait in an interactive review drawer where you accept, adjust, or reject every card and edge.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-white border border-[#d9d9d9] hover:border-sky-500/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-[#284b63] mb-4 group-hover:scale-110 transition-transform">
                <BookOpen size={20} />
              </div>
              <h3 className="text-base font-bold text-[#353535] mb-2">PDF Citation Deep-Linking</h3>
              <p className="text-xs sm:text-sm text-[#64706f] leading-relaxed">
                Upload academic papers to the document vault. Synthex extracts cited claims and links directly to target pages (<code className="text-[#284b63] font-mono text-xs">#page=14</code>) with highlighted text excerpts.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-white border border-[#d9d9d9] hover:border-amber-500/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#8a5a00] mb-4 group-hover:scale-110 transition-transform">
                <Network size={20} />
              </div>
              <h3 className="text-base font-bold text-[#353535] mb-2">HiPPO Personalized PageRank</h3>
              <p className="text-xs sm:text-sm text-[#64706f] leading-relaxed">
                Graph RAG engine converges personalized random walks across epistemically tagged edges, surfacing contradictory literature and supporting evidence within prompt budgets.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-white border border-[#d9d9d9] hover:border-emerald-500/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#167256] mb-4 group-hover:scale-110 transition-transform">
                <Share2 size={20} />
              </div>
              <h3 className="text-base font-bold text-[#353535] mb-2">Portable Markdown & Obsidian Vaults</h3>
              <p className="text-xs sm:text-sm text-[#64706f] leading-relaxed">
                Avoid vendor lock-in. Export complete workspaces as Obsidian / Logseq vaults with <code className="text-emerald-300 font-mono text-xs">[[wikilinks]]</code>, Mermaid diagrams, or structured <code className="text-emerald-300 font-mono text-xs">CONTEXT.md</code> briefs.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-white border border-[#d9d9d9] hover:border-[#3c6e71]/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-[#3c6e71]/10 border border-[#3c6e71]/30 flex items-center justify-center text-[#3c6e71] mb-4 group-hover:scale-110 transition-transform">
                <Database size={20} />
              </div>
              <h3 className="text-base font-bold text-[#353535] mb-2">Dual-Mode Architecture</h3>
              <p className="text-xs sm:text-sm text-[#64706f] leading-relaxed">
                Runs 100% offline with zero dependencies on local SQLite. In cloud production, automatically scales on Google Cloud Run with PostgreSQL and Google Cloud Storage.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: PRICING MATRIX */}
      <section id="pricing" className="py-24 border-t border-[#d9d9d9] bg-[#f7f8f7] relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
            <span className="text-xs uppercase font-bold tracking-widest text-[#3c6e71]">Transparent Subscriptions</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#353535] tracking-tight">
              Predictable Plans for Solo & Team Research
            </h2>
            <p className="text-[#4f5d5b] text-sm sm:text-base leading-relaxed">
              Start with our 3-day free trial (100 Context Credits, no credit card required), or bring your own API key.
            </p>

            {/* Billing Cycle Toggle */}
            <div className="pt-4 flex items-center justify-center gap-3">
              <span className={`text-xs font-semibold ${billingCycle === 'monthly' ? 'text-[#353535]' : 'text-[#64706f]'}`}>Monthly</span>
              <button
                type="button"
                onClick={() => setBillingCycle(b => (b === 'monthly' ? 'annual' : 'monthly'))}
                className="w-12 h-6 rounded-full bg-[#f7f8f7] border border-[#d9d9d9] p-0.5 transition-colors relative"
                aria-label="Toggle annual billing"
                aria-pressed={billingCycle === 'annual'}
              >
                <div className={`w-5 h-5 rounded-full bg-[#3c6e71] transition-transform ${billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
              <span className={`text-xs font-semibold flex items-center gap-1.5 ${billingCycle === 'annual' ? 'text-[#353535]' : 'text-[#64706f]'}`}>
                <span>Annual</span>
                <span className="px-2 py-0.5 rounded-full bg-[#3c6e71]/10 text-[#3c6e71] text-[10px] font-bold">Save 20%</span>
              </span>
            </div>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {/* TIER 1: Free Trial */}
            <div className="p-6 rounded-2xl bg-white border border-[#d9d9d9] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-[#353535]">3-Day Free Trial</h3>
                  <span className="px-2 py-0.5 rounded-full bg-[#f7f8f7] text-[10px] font-bold text-[#4f5d5b]">Starter</span>
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-[#353535]">$0</span>
                  <span className="text-xs text-[#64706f]"> / 3 days</span>
                </div>
                <p className="text-xs text-[#64706f] mb-6">
                  Explore full graph research with 100 seeded Context Credits. No credit card required.
                </p>

                <ul className="space-y-2.5 text-xs text-[#4f5d5b] mb-6">
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#3c6e71]" /> 100 Context Credits</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#3c6e71]" /> Unlimited local workspaces</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#3c6e71]" /> Interactive Graph Canvas</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#3c6e71]" /> Full Mermaid & Markdown exports</li>
                </ul>
              </div>

              <Link
                href="/sign-up"
                className="w-full py-2.5 text-center text-xs font-semibold text-[#353535] bg-[#f7f8f7] hover:bg-[#eef1f0] rounded-xl transition-colors"
              >
                Start Free Trial
              </Link>
            </div>

            {/* TIER 2: BYOK (Bring Your Own Key) */}
            <div className="p-6 rounded-2xl bg-white border border-[#d9d9d9] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-[#353535]">BYOK / No-AI</h3>
                  <span className="px-2 py-0.5 rounded-full bg-[#f7f8f7] text-[10px] font-bold text-[#4f5d5b]">Self-Hosted</span>
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-[#353535]">
                    {billingCycle === 'annual' ? '$2.40' : '$3.00'}
                  </span>
                  <span className="text-xs text-[#64706f]"> / month</span>
                </div>
                <p className="text-xs text-[#64706f] mb-6">
                  Cloud storage and sync for users who bring their own OpenAI or Gemini API key.
                </p>

                <ul className="space-y-2.5 text-xs text-[#4f5d5b] mb-6">
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#3c6e71]" /> Bring your own API key</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#3c6e71]" /> 0 platform AI markup</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#3c6e71]" /> Cloud SQL sync & backup</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#3c6e71]" /> GCS document vault & PDF jumps</li>
                </ul>
              </div>

              <Link
                href="/sign-up"
                className="w-full py-2.5 text-center text-xs font-semibold text-[#353535] bg-[#f7f8f7] hover:bg-[#eef1f0] rounded-xl transition-colors"
              >
                Select BYOK
              </Link>
            </div>

            {/* TIER 3: Pro Tier (Most Popular) */}
            <div className="p-6 rounded-2xl bg-gradient-to-b from-[#3c6e71]/10 to-white border-2 border-[#3c6e71] shadow-xl shadow-[#284b63]/10 flex flex-col justify-between relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#3c6e71] text-[10px] font-bold text-white uppercase tracking-wider shadow-sm">
                Most Popular
              </div>

              <div>
                <div className="flex items-center justify-between mb-3 mt-1">
                  <h3 className="text-base font-bold text-[#353535]">Pro Studio</h3>
                  <span className="px-2 py-0.5 rounded-full bg-[#3c6e71]/10 text-[#3c6e71] text-[10px] font-bold">1 User</span>
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-[#353535]">
                    {billingCycle === 'annual' ? '$7.99' : '$9.99'}
                  </span>
                  <span className="text-xs text-[#64706f]"> / month</span>
                </div>
                <p className="text-xs text-[#4f5d5b] mb-6">
                  Managed multi-hop research with prioritized inference and automatic model fallbacks.
                </p>

                <ul className="space-y-2.5 text-xs text-[#353535] mb-6">
                  <li className="flex items-center gap-2 font-semibold text-[#3c6e71]"><Check size={14} /> 1,500 Context Credits / mo</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#3c6e71]" /> Autonomous Multi-Hop Deep Research</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#3c6e71]" /> Google Search Grounding & citations</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#3c6e71]" /> 20 GB GCS Document Vault</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#3c6e71]" /> Obsidian & Logseq Vault ZIP export</li>
                </ul>
              </div>

              <Link
                href="/sign-up"
                className="w-full py-2.5 text-center text-xs font-semibold text-white bg-[#3c6e71] hover:bg-[#284b63] rounded-xl transition-all shadow-md shadow-[#284b63]/15"
              >
                Get Pro Studio
              </Link>
            </div>

            {/* TIER 4: Team Plan */}
            <div className="p-6 rounded-2xl bg-white border border-[#d9d9d9] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-[#353535]">Team Plan</h3>
                  <span className="px-2 py-0.5 rounded-full bg-[#f7f8f7] text-[10px] font-bold text-[#4f5d5b]">Multi-Seat</span>
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-[#353535]">
                    {billingCycle === 'annual' ? '$23.99' : '$29.99'}
                  </span>
                  <span className="text-xs text-[#64706f]"> / seat / mo</span>
                </div>
                <p className="text-xs text-[#64706f] mb-6">
                  Shared collaborative research canvases with Clerk Organizations role-based access.
                </p>

                <ul className="space-y-2.5 text-xs text-[#4f5d5b] mb-6">
                  <li className="flex items-center gap-2 font-semibold text-[#3c6e71]"><Check size={14} /> 5,000 Pooled Credits / mo</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#3c6e71]" /> Clerk Organization RBAC & invites</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#3c6e71]" /> Collaborative shared graphs</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#3c6e71]" /> Team-wide review staging queue</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-[#3c6e71]" /> Centralized Stripe invoice billing</li>
                </ul>
              </div>

              <Link
                href="/sign-up"
                className="w-full py-2.5 text-center text-xs font-semibold text-[#353535] bg-[#f7f8f7] hover:bg-[#eef1f0] rounded-xl transition-colors"
              >
                Create Team Workspace
              </Link>
            </div>
          </div>

          {/* Context Credits Refill Note */}
          <div className="mt-8 text-center text-xs text-[#64706f]">
            Need more research runs? Credit Refill Packs are available on demand at <strong className="text-[#353535]">$5.00 for 500 Context Credits</strong> anytime without changing subscription plans.
          </div>
        </div>
      </section>

      {/* SECTION: FREQUENTLY ASKED QUESTIONS */}
      <section id="faq" className="py-20 border-t border-[#d9d9d9] relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14 space-y-3">
            <span className="text-xs uppercase font-bold tracking-widest text-[#3c6e71]">Common Questions</span>
            <h2 className="text-3xl font-extrabold text-[#353535] tracking-tight">Everything You Need to Know</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div
                  key={faq.q}
                  className="rounded-xl border border-[#d9d9d9] bg-white overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${idx}`}
                    className="w-full px-5 py-4 text-left flex items-center justify-between text-sm font-semibold text-[#353535] hover:text-[#284b63] transition-colors"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp size={16} className="text-[#64706f] shrink-0" /> : <ChevronDown size={16} className="text-[#64706f] shrink-0" />}
                  </button>
                  <div id={`faq-answer-${idx}`} hidden={!isOpen} className="landing-faq-answer px-5 pb-5 pt-1 text-xs sm:text-sm text-[#4f5d5b] leading-relaxed border-t border-[#d9d9d9]">
                    {faq.a}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINAL HIGH-IMPACT CTA SECTION */}
      <section className="py-24 border-t border-[#d9d9d9] bg-gradient-to-b from-white to-[#f7f8f7] relative z-10 text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-[#353535] tracking-tight">
            Ready to Build a Grounded Knowledge Graph?
          </h2>
          <p className="text-base text-[#4f5d5b] max-w-xl mx-auto leading-relaxed">
            Join researchers and technical architects turning unstructured papers and web inquiries into verified semantic assets.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#3c6e71] hover:bg-[#284b63] text-white font-semibold text-sm shadow-xl shadow-[#284b63]/15 transition-all"
            >
              <Sparkles size={16} className="text-white" />
              <span>Start 3-Day Free Trial (100 Credits)</span>
            </Link>
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#f7f8f7] hover:bg-[#eef1f0] text-[#353535] hover:text-[#284b63] font-semibold text-sm transition-all border border-[#d9d9d9]"
            >
              <span>Open Local Studio</span>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#d9d9d9] bg-[#f7f8f7] py-12 text-xs text-[#64706f] relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 flex items-center justify-center">
              <SynthexLogo size={22} />
            </div>
            <span className="font-bold text-[#353535]">Synthex Studio</span>
            <span className="text-[#64706f]">·</span>
            <span>Desktop-First Epistemic Knowledge Platform</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/app" className="hover:text-[#284b63] transition-colors">Workspace</Link>
            <a href="#features" className="hover:text-[#284b63] transition-colors">Features</a>
            <a href="#pricing" className="hover:text-[#284b63] transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-[#284b63] transition-colors">FAQ</a>
            <Link href="/sign-in" className="hover:text-[#284b63] transition-colors">Sign In</Link>
          </div>

          <div className="text-[#64706f]">
            © {new Date().getFullYear()} Synthex. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
