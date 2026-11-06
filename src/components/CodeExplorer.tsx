/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  Download, 
  FileCode, 
  Archive, 
  Terminal, 
  FolderGit2, 
  FileText 
} from 'lucide-react';
import { ALL_SOURCE_FILES, SourceFile } from '../data/vstSourceFiles';
import { downloadSingleFile, downloadFullProjectZip } from '../utils/zipExporter';

export const CodeExplorer: React.FC = () => {
  const [selectedFileId, setSelectedFileId] = useState<string>('processor_h');
  const [copied, setCopied] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  const activeFile = ALL_SOURCE_FILES.find((f) => f.id === selectedFileId) || ALL_SOURCE_FILES[0];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      await downloadFullProjectZip();
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Top action bar */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <FileCode className="w-5 h-5 text-cyan-400" />
            Código Fuente C++ (JUCE 7) y Automatización CI/CD
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Archivos listos para compilar en GitHub Actions sin instalar compiladores locales.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg border border-slate-700 flex items-center gap-2 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
            {copied ? '¡Copiado!' : `Copiar ${activeFile.filename}`}
          </button>

          <button
            onClick={() => downloadSingleFile(activeFile.filename, activeFile.content)}
            className="px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg border border-slate-700 flex items-center gap-2 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            Descargar archivo
          </button>

          <button
            onClick={handleDownloadZip}
            disabled={isZipping}
            className="px-4 py-2 text-xs font-medium bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg shadow-lg shadow-cyan-500/10 flex items-center gap-2 transition-colors"
          >
            <Archive className="w-4 h-4" />
            {isZipping ? 'Comprimiendo...' : 'Descargar Repositorio Completo (.ZIP)'}
          </button>
        </div>
      </div>

      {/* File Navigation Tabs */}
      <div className="bg-slate-950/60 border-b border-slate-800 px-4 flex items-center gap-1 overflow-x-auto py-2">
        {ALL_SOURCE_FILES.map((file) => {
          const isActive = file.id === selectedFileId;
          const isCoreRequired = ['processor_h', 'processor_cpp', 'cmakelists', 'build_yml'].includes(file.id);
          return (
            <button
              key={file.id}
              onClick={() => { setSelectedFileId(file.id); setCopied(false); }}
              className={`px-3 py-1.5 text-xs font-mono rounded-md whitespace-nowrap flex items-center gap-2 transition-all ${
                isActive
                  ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <span>{file.filename}</span>
              {isCoreRequired && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" title="Requerido" />
              )}
            </button>
          );
        })}
      </div>

      {/* File metadata info banner */}
      <div className="px-5 py-2.5 bg-slate-950/40 border-b border-slate-800/70 flex flex-wrap items-center justify-between text-xs text-slate-400 font-mono gap-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Ruta en GitHub:</span>
          <span className="text-cyan-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            {activeFile.path}
          </span>
        </div>
        <div className="text-slate-400 text-[11px]">
          {activeFile.description}
        </div>
      </div>

      {/* Code Display Area with Line Numbers */}
      <div className="relative bg-slate-950 max-h-[540px] overflow-auto p-4 font-mono text-xs text-slate-200 leading-relaxed selection:bg-cyan-500/30">
        <pre className="overflow-x-auto whitespace-pre font-mono">
          <code>{activeFile.content}</code>
        </pre>
      </div>
    </div>
  );
};
