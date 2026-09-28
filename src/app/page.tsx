'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles, ArrowRight, Check, ShieldCheck, Database, FileText,
  Network, Cpu, Layers, BookOpen, ExternalLink,
  ChevronDown, ChevronUp, Share2, Compass, CheckCircle2
} from 'lucide-react';

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
      color: 'border-indigo-500 bg-indigo-50/80 text-indigo-900',
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
    <div className="min-h-screen bg-slate-900 text-slate-100 selection:bg-indigo-500 selection:text-white font-sans antialiased overflow-x-hidden">
      {/* Background Decorative Gradients & Grid */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[600px] bg-gradient-to-b from-indigo-600/20 via-sky-600/10 to-transparent blur-3xl opacity-70" />
        <div className="absolute top-[800px] -left-[200px] w-[600px] h-[600px] bg-teal-500/10 blur-[120px] rounded-full" />
        <div className="absolute top-[1400px] -right-[200px] w-[700px] h-[700px] bg-indigo-500/10 blur-[140px] rounded-full" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '28px 28px'
          }}
        />
      </div>

      {/* STICKY BLURRED NAVBAR */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-slate-800/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-teal-400 p-[1px] shadow-lg shadow-indigo-500/20 transition-transform group-hover:scale-105">
              <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center">
                <Sparkles size={16} className="text-teal-400 group-hover:rotate-12 transition-transform duration-300" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white group-hover:text-indigo-200 transition-colors">
                Synthex
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                Studio
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#metaphor" className="hover:text-white transition-colors">The Folded Sheet</a>
            <a href="#evidence" className="hover:text-white transition-colors">Evidence Paths</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/app"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
            >
              Open Studio
            </Link>
            <Link
              href="/sign-in"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 hover:shadow-indigo-500/50 transition-all"
            >
              <span>Start 3-Day Trial</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* Mobile Menu Trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(v => !v)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-800 bg-slate-900/95 backdrop-blur-xl px-4 pt-3 pb-6 space-y-3">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 text-slate-300 hover:text-white">Features</a>
            <a href="#metaphor" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 text-slate-300 hover:text-white">The Folded Sheet</a>
            <a href="#evidence" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 text-slate-300 hover:text-white">Evidence Paths</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 text-slate-300 hover:text-white">Pricing</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 text-slate-300 hover:text-white">FAQ</a>
            <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
              <Link href="/app" className="text-center py-2 text-sm text-slate-300 bg-slate-800 rounded-lg font-medium">Launch App</Link>
              <Link href="/sign-up" className="text-center py-2 text-sm text-white bg-indigo-600 rounded-lg font-semibold">Start Free Trial (100 Credits)</Link>
            </div>
          </div>
        )}
      </header>

      {/* HERO SECTION */}
      <section className="relative z-10 pt-16 pb-20 sm:pt-24 sm:pb-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold backdrop-blur-md animate-fade-in shadow-sm">
            <span className="flex h-1.5 w-1.5 rounded-full bg-teal-400 animate-ping" />
            <span>Desktop-First · Strict Epistemic Provenance · Zero Silent Writes</span>
          </div>

          {/* Primary Headline */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
            Transform Unstructured Insights into{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-indigo-300 to-sky-300">
              Grounded Semantic Graphs
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal max-w-2xl mx-auto">
            Stop losing critical dependencies across flat documents and infinite whiteboards.
            Synthex synthesizes papers, web sources, and assertions into an auditable knowledge graph — with every claim verified against ground truth.
          </p>

          {/* CTA Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm shadow-xl shadow-indigo-600/30 hover:shadow-indigo-500/50 transition-all group"
            >
              <Sparkles size={16} className="text-teal-300" />
              <span>Start Free 3-Day Trial</span>
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/app"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 hover:text-white font-semibold text-sm transition-all shadow-sm"
            >
              <span>Explore Interactive Studio</span>
              <ExternalLink size={14} className="text-slate-400" />
            </Link>
          </div>

          {/* Trial Value Callout */}
          <div className="flex items-center justify-center gap-5 text-xs text-slate-400 pt-1">
            <span className="flex items-center gap-1.5"><Check size={14} className="text-teal-400" /> 100 Free Context Credits</span>
            <span>·</span>
            <span className="flex items-center gap-1.5"><Check size={14} className="text-teal-400" /> No credit card required</span>
            <span>·</span>
            <span className="flex items-center gap-1.5"><Check size={14} className="text-teal-400" /> Instant local SQLite fallback</span>
          </div>
        </div>

        {/* INTERACTIVE MINI-CANVAS SHOWCASE */}
        <div className="mt-14 relative rounded-2xl border border-slate-800 bg-slate-950/70 backdrop-blur-2xl shadow-2xl p-4 sm:p-6 overflow-hidden">
          {/* Top Bar of the Mock Canvas */}
          <div className="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-slate-800/80 gap-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/70 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/70 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/70 inline-block" />
              <span className="ml-2 text-xs font-mono text-slate-400">synthex-workspace // rag-epistemic-survey</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDemoFilter('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${demoFilter === 'all' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-white'}`}
              >
                All Cards
              </button>
              <button
                type="button"
                onClick={() => setDemoFilter('claims')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${demoFilter === 'claims' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-white'}`}
              >
                Claims (2)
              </button>
              <button
                type="button"
                onClick={() => setDemoFilter('sources')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${demoFilter === 'sources' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-white'}`}
              >
                Sources (1)
              </button>
            </div>
          </div>

          {/* Canvas Work Area with Cards and SVG Connectors */}
          <div className="relative min-h-[380px] bg-slate-900/60 rounded-xl border border-slate-800/60 p-4 sm:p-6 overflow-x-auto">
            {/* SVG Connector Overlay */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              <defs>
                <linearGradient id="edgeGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="edgeGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.8" />
                </linearGradient>
              </defs>
              {/* Connector from Concept to Claim 1 */}
              <path
                d="M 260 115 C 300 115, 310 75, 340 75"
                fill="none"
                stroke="url(#edgeGrad1)"
                strokeWidth="2"
                strokeDasharray="4 4"
                className="animate-pulse"
              />
              {/* Connector from Concept to Claim 2 */}
              <path
                d="M 260 145 C 300 145, 305 240, 340 240"
                fill="none"
                stroke="url(#edgeGrad1)"
                strokeWidth="2"
              />
              {/* Connector from Claim 1 to Source */}
              <path
                d="M 570 75 C 600 75, 610 140, 640 140"
                fill="none"
                stroke="url(#edgeGrad2)"
                strokeWidth="2"
                strokeDasharray="6 3"
              />
            </svg>

            {/* Interactive Cards Container */}
            <div className="relative z-10 flex flex-col md:flex-row gap-6 min-w-[700px] justify-between items-start py-4">
              {demoNodes.map(node => {
                if (demoFilter === 'claims' && node.type !== 'claim') return null;
                if (demoFilter === 'sources' && node.type !== 'source') return null;
                const isSelected = selectedDemoNode === node.id;

                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedDemoNode(node.id)}
                    className={`cursor-pointer w-64 p-4 rounded-xl border transition-all duration-200 select-none bg-slate-950/90 shadow-lg ${
                      isSelected
                        ? 'border-indigo-400 ring-2 ring-indigo-500/30 -translate-y-1 shadow-indigo-500/20'
                        : 'border-slate-700/80 hover:border-slate-600 hover:-translate-y-0.5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {node.badge}
                      </span>
                      {node.status === 'supported' && (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                          <CheckCircle2 size={12} /> Supported
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-white leading-snug">{node.title}</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-normal">{node.subtitle}</p>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Click to inspect</span>
                      <ArrowRight size={11} className={isSelected ? 'text-indigo-400' : 'text-slate-600'} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Inspection Ribbon */}
          <div className="mt-4 p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-300 gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-teal-400 shrink-0" />
              <span>
                <strong>Epistemic Guarantee:</strong> Selected card verified against 3 peer-reviewed citations. 0 unchecked assertions.
              </span>
            </div>
            <Link
              href="/app"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 shrink-0"
            >
              Open in full canvas editor <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* LOGO & TRUST PROOF BANNER */}
        <div className="mt-16 pt-10 border-t border-slate-800/70 text-center">
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-6">
            Architected for Rigorous Research & Technical Synthesis
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-4xl mx-auto text-slate-400 text-xs font-medium">
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-950/50 border border-slate-800/50">
              <CheckCircle2 size={15} className="text-teal-400" />
              <span>Grounded Google Search</span>
            </div>
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-950/50 border border-slate-800/50">
              <Cpu size={15} className="text-indigo-400" />
              <span>GPT-6 & Gemini Multi-Hop</span>
            </div>
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-950/50 border border-slate-800/50">
              <Database size={15} className="text-sky-400" />
              <span>Local SQLite + Cloud SQL</span>
            </div>
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-950/50 border border-slate-800/50">
              <Share2 size={15} className="text-amber-400" />
              <span>Obsidian & Logseq Vaults</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: THE FOLDED KNOWLEDGE SHEET METAPHOR */}
      <section id="metaphor" className="py-20 border-t border-slate-800/80 bg-slate-950/40 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="text-xs uppercase font-bold tracking-widest text-teal-400">Design Philosophy</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              The &ldquo;Folded Knowledge Sheet&rdquo; Metaphor
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Why linear note tools and infinite whiteboards fail modern research — and how Synthex restores durable semantic clarity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-5">
                <FileText size={20} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Flat Documents Hide Structure</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Linear docs force complex, multi-variable investigations into an artificial vertical scroll. Critical contradictions and dependency paths disappear into paragraph text.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-5">
                <Layers size={20} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Whiteboards Become Chaotic</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Freeform infinite whiteboards lack semantic types. Without structured relations like <code className="text-amber-300 text-xs font-mono">supports</code> or <code className="text-rose-300 text-xs font-mono">contradicts</code>, boards devolve into unmanageable sticker piles.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-b from-indigo-950/40 to-slate-900/80 border border-indigo-500/40 shadow-xl shadow-indigo-500/10">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-5">
                <Sparkles size={20} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">The Synthex Semantic Sheet</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                A calm, paper-like surface with collapsible sub-canvas clusters. Labeled directional edges preserve causality, while human-in-the-loop review protects graph integrity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: CORE FEATURES & CAPABILITIES */}
      <section id="features" className="py-24 border-t border-slate-800/80 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="text-xs uppercase font-bold tracking-widest text-indigo-400">System Capabilities</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Built for Researchers Who Demand Grounded Truth
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Every feature is designed around rigor: verified web grounding, human sign-off, and portable knowledge.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
                <Compass size={20} />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Recursive Deep Research</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Deconstructs inquiries across analytical axes (foundational theory, empirical breakthrough, counterarguments) using multi-hop web exploration with live streaming steps.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-teal-500/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-4 group-hover:scale-110 transition-transform">
                <ShieldCheck size={20} />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Zero Silent AI Writes</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                AI never injects unchecked facts into your graph. Generated proposals wait in an interactive review drawer where you accept, adjust, or reject every card and edge.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-sky-500/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-4 group-hover:scale-110 transition-transform">
                <BookOpen size={20} />
              </div>
              <h3 className="text-base font-bold text-white mb-2">PDF Citation Deep-Linking</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Upload academic papers to the document vault. Synthex extracts cited claims and links directly to target pages (<code className="text-sky-300 font-mono text-xs">#page=14</code>) with highlighted text excerpts.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-amber-500/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition-transform">
                <Network size={20} />
              </div>
              <h3 className="text-base font-bold text-white mb-2">HiPPO Personalized PageRank</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Graph RAG engine converges personalized random walks across epistemically tagged edges, surfacing contradictory literature and supporting evidence within prompt budgets.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
                <Share2 size={20} />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Portable Markdown & Obsidian Vaults</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Avoid vendor lock-in. Export complete workspaces as Obsidian / Logseq vaults with <code className="text-emerald-300 font-mono text-xs">[[wikilinks]]</code>, Mermaid diagrams, or structured <code className="text-emerald-300 font-mono text-xs">CONTEXT.md</code> briefs.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
                <Database size={20} />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Dual-Mode Architecture</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Runs 100% offline with zero dependencies on local SQLite. In cloud production, automatically scales on Google Cloud Run with PostgreSQL and Google Cloud Storage.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: PRICING MATRIX */}
      <section id="pricing" className="py-24 border-t border-slate-800/80 bg-slate-950/40 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
            <span className="text-xs uppercase font-bold tracking-widest text-teal-400">Transparent Subscriptions</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Predictable Plans for Solo & Team Research
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Start with our 3-day free trial (100 Context Credits, no credit card required), or bring your own API key.
            </p>

            {/* Billing Cycle Toggle */}
            <div className="pt-4 flex items-center justify-center gap-3">
              <span className={`text-xs font-semibold ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-400'}`}>Monthly</span>
              <button
                type="button"
                onClick={() => setBillingCycle(b => (b === 'monthly' ? 'annual' : 'monthly'))}
                className="w-12 h-6 rounded-full bg-slate-800 border border-slate-700 p-0.5 transition-colors relative"
                aria-label="Toggle annual billing"
              >
                <div className={`w-5 h-5 rounded-full bg-indigo-500 transition-transform ${billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
              <span className={`text-xs font-semibold flex items-center gap-1.5 ${billingCycle === 'annual' ? 'text-white' : 'text-slate-400'}`}>
                <span>Annual</span>
                <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-bold">Save 20%</span>
              </span>
            </div>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {/* TIER 1: Free Trial */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-white">3-Day Free Trial</h3>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">Starter</span>
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-white">$0</span>
                  <span className="text-xs text-slate-400"> / 3 days</span>
                </div>
                <p className="text-xs text-slate-400 mb-6">
                  Explore full graph research with 100 seeded Context Credits. No credit card required.
                </p>

                <ul className="space-y-2.5 text-xs text-slate-300 mb-6">
                  <li className="flex items-center gap-2"><Check size={14} className="text-teal-400" /> 100 Context Credits</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-teal-400" /> Unlimited local workspaces</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-teal-400" /> Interactive Graph Canvas</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-teal-400" /> Full Mermaid & Markdown exports</li>
                </ul>
              </div>

              <Link
                href="/sign-up"
                className="w-full py-2.5 text-center text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Start Free Trial
              </Link>
            </div>

            {/* TIER 2: BYOK (Bring Your Own Key) */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-white">BYOK / No-AI</h3>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">Self-Hosted</span>
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-white">
                    {billingCycle === 'annual' ? '$2.40' : '$3.00'}
                  </span>
                  <span className="text-xs text-slate-400"> / month</span>
                </div>
                <p className="text-xs text-slate-400 mb-6">
                  Cloud storage and sync for users who bring their own OpenAI or Gemini API key.
                </p>

                <ul className="space-y-2.5 text-xs text-slate-300 mb-6">
                  <li className="flex items-center gap-2"><Check size={14} className="text-teal-400" /> Bring your own API key</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-teal-400" /> 0 platform AI markup</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-teal-400" /> Cloud SQL sync & backup</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-teal-400" /> GCS document vault & PDF jumps</li>
                </ul>
              </div>

              <Link
                href="/sign-up"
                className="w-full py-2.5 text-center text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Select BYOK
              </Link>
            </div>

            {/* TIER 3: Pro Tier (Most Popular) */}
            <div className="p-6 rounded-2xl bg-gradient-to-b from-indigo-950/50 to-slate-900 border-2 border-indigo-500 shadow-xl shadow-indigo-500/10 flex flex-col justify-between relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-indigo-600 text-[10px] font-bold text-white uppercase tracking-wider shadow-sm">
                Most Popular
              </div>

              <div>
                <div className="flex items-center justify-between mb-3 mt-1">
                  <h3 className="text-base font-bold text-white">Pro Studio</h3>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">1 User</span>
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-white">
                    {billingCycle === 'annual' ? '$7.99' : '$9.99'}
                  </span>
                  <span className="text-xs text-slate-400"> / month</span>
                </div>
                <p className="text-xs text-slate-300 mb-6">
                  Managed multi-hop research with prioritized inference and automatic model fallbacks.
                </p>

                <ul className="space-y-2.5 text-xs text-slate-200 mb-6">
                  <li className="flex items-center gap-2 font-semibold text-teal-300"><Check size={14} /> 1,500 Context Credits / mo</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-teal-400" /> Autonomous Multi-Hop Deep Research</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-teal-400" /> Google Search Grounding & citations</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-teal-400" /> 20 GB GCS Document Vault</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-teal-400" /> Obsidian & Logseq Vault ZIP export</li>
                </ul>
              </div>

              <Link
                href="/sign-up"
                className="w-full py-2.5 text-center text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md shadow-indigo-600/30"
              >
                Get Pro Studio
              </Link>
            </div>

            {/* TIER 4: Team Plan */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-white">Team Plan</h3>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">Multi-Seat</span>
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-white">
                    {billingCycle === 'annual' ? '$23.99' : '$29.99'}
                  </span>
                  <span className="text-xs text-slate-400"> / seat / mo</span>
                </div>
                <p className="text-xs text-slate-400 mb-6">
                  Shared collaborative research canvases with Clerk Organizations role-based access.
                </p>

                <ul className="space-y-2.5 text-xs text-slate-300 mb-6">
                  <li className="flex items-center gap-2 font-semibold text-teal-300"><Check size={14} /> 5,000 Pooled Credits / mo</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-teal-400" /> Clerk Organization RBAC & invites</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-teal-400" /> Collaborative shared graphs</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-teal-400" /> Team-wide review staging queue</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-teal-400" /> Centralized Stripe invoice billing</li>
                </ul>
              </div>

              <Link
                href="/sign-up"
                className="w-full py-2.5 text-center text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Create Team Workspace
              </Link>
            </div>
          </div>

          {/* Context Credits Refill Note */}
          <div className="mt-8 text-center text-xs text-slate-400">
            Need more research runs? Credit Refill Packs are available on demand at <strong className="text-slate-200">$5.00 for 500 Context Credits</strong> anytime without changing subscription plans.
          </div>
        </div>
      </section>

      {/* SECTION: FREQUENTLY ASKED QUESTIONS */}
      <section id="faq" className="py-20 border-t border-slate-800/80 relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14 space-y-3">
            <span className="text-xs uppercase font-bold tracking-widest text-teal-400">Common Questions</span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Everything You Need to Know</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div
                  key={faq.q}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between text-sm font-semibold text-white hover:text-indigo-200 transition-colors"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/60">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINAL HIGH-IMPACT CTA SECTION */}
      <section className="py-24 border-t border-slate-800/80 bg-gradient-to-b from-slate-900 to-slate-950 relative z-10 text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Ready to Build a Grounded Knowledge Graph?
          </h2>
          <p className="text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
            Join researchers and technical architects turning unstructured papers and web inquiries into verified semantic assets.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-xl shadow-indigo-600/30 transition-all"
            >
              <Sparkles size={16} className="text-teal-300" />
              <span>Start 3-Day Free Trial (100 Credits)</span>
            </Link>
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-sm transition-all border border-slate-700"
            >
              <span>Open Local Studio</span>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-12 text-xs text-slate-400 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center text-white">
              <Sparkles size={11} />
            </div>
            <span className="font-bold text-slate-200">Synthex Studio</span>
            <span className="text-slate-600">·</span>
            <span>Desktop-First Epistemic Knowledge Platform</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/app" className="hover:text-slate-200 transition-colors">Workspace</Link>
            <a href="#features" className="hover:text-slate-200 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-slate-200 transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-slate-200 transition-colors">FAQ</a>
            <Link href="/sign-in" className="hover:text-slate-200 transition-colors">Sign In</Link>
          </div>

          <div className="text-slate-400">
            © {new Date().getFullYear()} Synthex. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
