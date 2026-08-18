import React, { useState } from 'react';
import { ARCHITECTURE_SECTIONS, ArchitectureSection } from '../data/architectureContent';
import { Cpu, Copy, Check, FileText, Download, Code, Layers, Database, ShieldAlert, Sparkles, Search } from 'lucide-react';

export const ArchitectureViewer: React.FC = () => {
  const [selectedSectionId, setSelectedSectionId] = useState<string>(ARCHITECTURE_SECTIONS[0].id);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [filterQuery, setFilterQuery] = useState<string>('');

  const activeSection = ARCHITECTURE_SECTIONS.find(s => s.id === selectedSectionId) || ARCHITECTURE_SECTIONS[0];

  const filteredSections = ARCHITECTURE_SECTIONS.filter(s =>
    s.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
    s.subtitle.toLowerCase().includes(filterQuery.toLowerCase()) ||
    s.summary.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadFullDoc = () => {
    let fullDoc = `# ESPECIFICACIÓN DE ARQUITECTURA DE SOFTWARE Y PRODUCT MANAGEMENT\n# Plataforma de Inversión Conservadora & Paper Trading (Custodia)\n\n`;
    ARCHITECTURE_SECTIONS.forEach(sec => {
      fullDoc += `\n## ${sec.number}. ${sec.title} - ${sec.subtitle}\n\n${sec.summary}\n\n${sec.contentMarkdown}\n\n`;
      if (sec.codeSnippet) {
        fullDoc += `\`\`\`${sec.codeSnippet.language}\n// ${sec.codeSnippet.filename}\n${sec.codeSnippet.code}\n\`\`\`\n\n`;
      }
    });

    const blob = new Blob([fullDoc], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Custodia_Arquitectura_Software_PM.md';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Header with Frosted Glass */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-1">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>Entregable Arquitecto & Product Manager</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Especificación Técnica & Blueprint (10 Puntos)
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Documentación exhaustiva para el desarrollo de la plataforma: diagramas C4, esquemas DDL PostgreSQL, motor de riesgo, flujos UX, pruebas de estrés y cumplimiento MiFID II.
            </p>
          </div>

          <button
            onClick={handleDownloadFullDoc}
            className="px-4 py-2.5 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-950/50 flex items-center justify-center gap-2 cursor-pointer self-stretch sm:self-auto border border-indigo-400/40 min-h-[42px]"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Documento (.MD)</span>
          </button>
        </div>

        {/* Search bar */}
        <div className="mt-4 pt-3 sm:pt-4 border-t border-white/10 relative z-10">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar en los 10 entregables de arquitectura..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full glass-input rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-400/60 min-h-[38px]"
            />
          </div>
        </div>
      </div>

      {/* Grid: 10 Sections Menu + Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        
        {/* Left Navigation (1 to 10) with horizontal scroll on mobile */}
        <div className="lg:col-span-4 space-y-1.5 sm:space-y-2 max-h-[220px] lg:max-h-none overflow-y-auto pr-1">
          {filteredSections.map(sec => (
            <button
              key={sec.id}
              onClick={() => setSelectedSectionId(sec.id)}
              className={`w-full text-left p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all cursor-pointer ${
                sec.id === selectedSectionId
                  ? 'glass-card border-indigo-400/60 text-white shadow-md ring-1 ring-indigo-400/40'
                  : 'bg-white/[0.03] border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center gap-2.5 sm:gap-3">
                <span className="w-6 h-6 rounded-lg glass text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 border border-white/10 font-mono">
                  {sec.number}
                </span>
                <div className="overflow-hidden">
                  <div className="font-bold text-xs truncate text-white">{sec.title}</div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400 truncate">{sec.subtitle}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Right Section Content */}
        <div className="lg:col-span-8 glass-card rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-6">
          
          {/* Section Header */}
          <div className="pb-3 sm:pb-4 border-b border-white/10 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
                <span>Entregable {activeSection.number} de 10</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mt-1 leading-snug">{activeSection.title}</h3>
              <p className="text-xs text-slate-300 mt-0.5">{activeSection.subtitle}</p>
            </div>
            <span className="px-2.5 py-1 rounded-full glass text-slate-300 text-[10px] font-mono border border-white/10 shrink-0">
              ID: {activeSection.id}
            </span>
          </div>

          {/* Key Takeaways Grid */}
          <div className="glass-panel rounded-xl sm:rounded-2xl p-3.5 sm:p-4">
            <h4 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Puntos Clave del Módulo:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
              {activeSection.keyTakeaways.map((point, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></div>
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Main Markdown Content */}
          <div className="prose prose-invert prose-xs text-slate-200 text-xs leading-relaxed max-w-none space-y-4">
            <div className="whitespace-pre-wrap font-sans">
              {activeSection.contentMarkdown}
            </div>
          </div>

          {/* Code Snippet Box if available */}
          {activeSection.codeSnippet && (
            <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-slate-950/70 overflow-hidden backdrop-blur-xl">
              <div className="px-3.5 py-2.5 bg-white/[0.04] border-b border-white/10 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2 font-mono text-slate-300 text-[11px] sm:text-xs truncate mr-2">
                  <Code className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="truncate">{activeSection.codeSnippet.filename}</span>
                </div>
                <button
                  onClick={() => handleCopyCode(activeSection.codeSnippet!.code)}
                  className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white px-2.5 py-1 rounded-xl glass hover:bg-white/15 transition-colors cursor-pointer border border-white/10 shrink-0 min-h-[32px]"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
              <pre className="p-3.5 sm:p-4 text-[11px] sm:text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
                <code>{activeSection.codeSnippet.code}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
