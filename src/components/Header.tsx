/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Archive } from 'lucide-react';
import { downloadFullProjectZip } from '../utils/zipExporter';

interface HeaderProps {
  onDownloadZip: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onDownloadZip }) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-50">
      {/* Zone 1: Single text wordmark */}
      <a href="/" className="text-lg font-bold tracking-tight text-slate-100 font-display whitespace-nowrap shrink-0 flex items-center gap-2">
        <span className="text-cyan-400">UNDERTUNE</span>
        <span className="text-xs text-slate-400 font-mono font-normal">VST3 DSP</span>
      </a>

      {/* Zone 2: Concise single-line navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
        <a href="#simulador" className="hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0">
          Simulador DSP
        </a>
        <a href="#codigo" className="hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0">
          Código C++ & CI/CD
        </a>
        <a href="#guia-github" className="hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0">
          Compilación en GitHub
        </a>
        <a href="#fl-studio" className="hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0">
          Instalación FL Studio
        </a>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onDownloadZip}
          className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Descargar ZIP para GitHub</span>
        </button>
      </div>
    </header>
  );
};
