import { useEffect, useRef, useState } from 'react';
import {
  Sparkles, FileUp, ScanSearch, Network, Bot, Cpu, Shield,
  Users, GitMerge, LayoutDashboard, Rocket, ArrowRight, ArrowDown
} from 'lucide-react';

const FLOW_STEPS = [
  {
    id: 1,
    title: 'Upload your requirements',
    body: 'Drop a PRD as PDF, Word, or plain text. The app extracts the full document so every requirement is available to the agents.',
    icon: FileUp,
    accent: 'from-sky-400 to-primary',
  },
  {
    id: 2,
    title: 'Parse into epics',
    body: 'AI scans the document, groups related requirements, and builds a structured epic backlog with risks called out early.',
    icon: ScanSearch,
    accent: 'from-primary to-sky-400',
  },
  {
    id: 3,
    title: 'Four agents refine stories',
    body: 'Architect, PM, Engineer, and QA agents run in sequence — mapping architecture, drafting stories, reviewing estimates, then hardening acceptance criteria.',
    icon: Bot,
    accent: 'from-violet-400 to-primary',
  },
  {
    id: 4,
    title: 'Plan the sprint',
    body: 'Stories are assigned to your team, dependencies are mapped, and work is sequenced into a sprint-ready plan you can review before sync.',
    icon: LayoutDashboard,
    accent: 'from-secondary to-emerald-400',
  },
  {
    id: 5,
    title: 'Push to Jira',
    body: 'One click creates epics and stories in your selected Jira project and sprint — ready for the team board.',
    icon: Rocket,
    accent: 'from-emerald-400 to-secondary',
  },
];

const AGENTS = [
  {
    name: 'Architect',
    role: 'Solutions Architect',
    detail: 'Builds a knowledge graph of services, APIs, databases, and relationships from the PRD.',
    icon: Network,
    color: 'text-violet-400',
    ring: 'ring-violet-500/40',
    bg: 'bg-violet-500/10',
  },
  {
    name: 'PM',
    role: 'Product Manager',
    detail: 'Turns epics into draft user stories with clear titles, descriptions, and labels.',
    icon: Bot,
    color: 'text-sky-400',
    ring: 'ring-sky-500/40',
    bg: 'bg-sky-500/10',
  },
  {
    name: 'Engineer',
    role: 'Lead Engineer',
    detail: 'Reviews complexity, story points, and technical feasibility against the architecture map.',
    icon: Cpu,
    color: 'text-amber-400',
    ring: 'ring-amber-500/40',
    bg: 'bg-amber-500/10',
  },
  {
    name: 'QA',
    role: 'QA Engineer',
    detail: 'Finalizes acceptance criteria and risk flags so stories are testable before they hit Jira.',
    icon: Shield,
    color: 'text-emerald-400',
    ring: 'ring-emerald-500/40',
    bg: 'bg-emerald-500/10',
  },
];

export default function LandingPage({ onGetStarted }) {
  const [visibleStep, setVisibleStep] = useState(0);
  const stepsRef = useRef(null);

  useEffect(() => {
    const timers = FLOW_STEPS.map((_, i) =>
      setTimeout(() => setVisibleStep(i + 1), 280 + i * 160)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="relative -mx-6 -mt-10">
      {/* Atmosphere */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.22),transparent_65%)]" />
        <div className="absolute top-[40%] right-0 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.12),transparent_70%)]" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.5) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      {/* Hero */}
      <section className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-center px-6 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-700">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-secondary">
              Agiler AI
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-bold text-white leading-[1.1] tracking-tight">
              The Autonomous AI Agent
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                for Agile Software Delivery
              </span>
            </h1>
            <p className="text-xl text-slate-300 font-medium max-w-lg">
              From requirements to sprint-ready Jira.
            </p>
            <p className="text-lg text-slate-400 max-w-lg leading-relaxed">
              Upload a PRD. Multi-agent AI analyzes it, drafts user stories, plans the sprint,
              and syncs everything to Jira — step by step.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={onGetStarted}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-white px-7 py-3.5 rounded-xl font-semibold text-base hover:shadow-[0_0_36px_rgba(99,102,241,0.35)] transition-all"
              >
                Get started
                <ArrowRight className="w-5 h-5" />
              </button>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 px-3 py-3 text-sm font-medium transition-colors"
              >
                See how it works
                <ArrowDown className="w-4 h-4" />
              </a>
            </div>
          </div>

          <PipelineVisual />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative px-6 py-20 border-t border-slate-800/80" ref={stepsRef}>
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-14 space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              How a requirement becomes a Jira story
            </h2>
            <p className="text-slate-400 text-lg">
              Five stages — from raw document to tickets on your board.
            </p>
          </div>

          <ol className="relative space-y-0">
            {FLOW_STEPS.map((step, index) => {
              const Icon = step.icon;
              const shown = visibleStep > index;
              return (
                <li
                  key={step.id}
                  className={`relative grid grid-cols-[auto_1fr] gap-5 sm:gap-8 py-8 border-b border-slate-800/60 last:border-0 transition-all duration-700 ${
                    shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.accent} flex items-center justify-center shadow-lg`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    {index < FLOW_STEPS.length - 1 && (
                      <div className="w-px flex-1 min-h-[2rem] mt-3 bg-gradient-to-b from-slate-600 to-transparent" />
                    )}
                  </div>
                  <div className="pt-1.5 pb-2">
                    <div className="flex items-baseline gap-3 mb-2">
                      <span className="text-xs font-mono text-slate-500">0{step.id}</span>
                      <h3 className="text-xl font-semibold text-white">{step.title}</h3>
                    </div>
                    <p className="text-slate-400 leading-relaxed max-w-2xl">{step.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Agent pipeline detail */}
      <section className="relative px-6 py-20 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-12 space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Inside the multi-agent pipeline
            </h2>
            <p className="text-slate-400 text-lg">
              Each agent has one job. Together they turn parsed epics into board-ready stories.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {AGENTS.map((agent, i) => {
              const Icon = agent.icon;
              return (
                <div
                  key={agent.name}
                  className={`relative rounded-2xl border border-slate-700/80 ${agent.bg} p-5 ring-1 ${agent.ring} animate-in fade-in slide-in-from-bottom-3 duration-700`}
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  {i < AGENTS.length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 -right-3 w-5 h-px bg-slate-600 z-10" />
                  )}
                  <div className={`w-10 h-10 rounded-lg bg-slate-900/60 flex items-center justify-center mb-4 ${agent.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className={`text-sm font-semibold ${agent.color}`}>{agent.name} Agent</p>
                  <p className="text-xs text-slate-500 mb-3">{agent.role}</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{agent.detail}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-10 flex flex-wrap gap-6 text-sm text-slate-400">
            <span className="inline-flex items-center gap-2">
              <Users className="w-4 h-4 text-secondary" />
              Team assignment by skill & seniority
            </span>
            <span className="inline-flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-secondary" />
              Dependency detection across stories
            </span>
            <span className="inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-secondary" />
              Live agent logs while stories generate
            </span>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative px-6 py-20 border-t border-slate-800/80">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Ready to generate your next sprint?
          </h2>
          <p className="text-slate-400 text-lg">
            Connect your Jira project, upload a PRD, and let the agents build the backlog.
          </p>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-white px-8 py-4 rounded-xl font-semibold text-lg hover:shadow-[0_0_40px_rgba(99,102,241,0.4)] transition-all"
          >
            <Sparkles className="w-5 h-5" />
            Start with your PRD
          </button>
        </div>
      </section>
    </div>
  );
}

function PipelineVisual() {
  const nodes = [
    { label: 'PRD', sub: 'Upload', icon: FileUp },
    { label: 'Epics', sub: 'Parsed', icon: ScanSearch },
    { label: 'Agents', sub: '4 roles', icon: Bot },
    { label: 'Jira', sub: 'Synced', icon: Rocket },
  ];

  return (
    <div className="relative animate-in fade-in slide-in-from-right-4 duration-1000 delay-150">
      <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-primary/20 via-transparent to-secondary/20 blur-2xl" />
      <div className="relative rounded-[1.75rem] border border-slate-700/80 bg-surface/80 backdrop-blur-sm p-6 sm:p-8 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.08),transparent_50%)]" />

        <p className="relative text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-6">
          End-to-end flow
        </p>

        <div className="relative space-y-3">
          {nodes.map((node, i) => {
            const Icon = node.icon;
            return (
              <div key={node.label} className="relative">
                <div
                  className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3.5 transition-transform duration-500 hover:translate-x-1"
                  style={{
                    animation: `landingPulse 3.2s ease-in-out ${i * 0.35}s infinite`,
                  }}
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/30 to-secondary/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{node.label}</p>
                    <p className="text-xs text-slate-500">{node.sub}</p>
                  </div>
                  <span className="ml-auto text-[10px] font-mono text-slate-600">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                {i < nodes.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ArrowDown className="w-3.5 h-3.5 text-slate-600 animate-bounce" style={{ animationDuration: '2s', animationDelay: `${i * 0.2}s` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes landingPulse {
          0%, 100% { border-color: rgb(51 65 85); }
          50% { border-color: rgba(99, 102, 241, 0.45); }
        }
      `}</style>
    </div>
  );
}
