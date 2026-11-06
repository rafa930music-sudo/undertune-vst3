/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Header } from './components/Header';
import { AudioTunerDemo } from './components/AudioTunerDemo';
import { CodeExplorer } from './components/CodeExplorer';
import { GitHubWorkflowGuide } from './components/GitHubWorkflowGuide';
import { FlStudioGuide } from './components/FlStudioGuide';
import { downloadFullProjectZip } from './utils/zipExporter';
import { Archive, Cpu, SlidersHorizontal, CloudCheck, Music4 } from 'lucide-react';

export default function App() {
  const [downloading, setDownloading] = useState(false);

  const handleDownloadZip = async () => {
    try {
      setDownloading(true);
      await downloadFullProjectZip();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Bar Header */}
      <Header onDownloadZip={handleDownloadZip} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        
        {/* Hero Section */}
        <section className="space-y-4 pt-2">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-widest">
            <span>JUCE 7 C++</span>
            <span aria-hidden="true">·</span>
            <span>VST3 x64</span>
            <span aria-hidden="true">·</span>
            <span>GITHUB ACTIONS CI/CD</span>
            <span aria-hidden="true">·</span>
            <span>FL STUDIO READY</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight font-display text-slate-50 text-balance max-w-3xl">
            Undertune: Afinación Vocal VST3 en Tiempo Real
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
            Arquitectura de audio digital completa con detección de tono por autocorrelación, corrección a escalas Cromática, Mayor y Menor, perillas de Retune Speed, Formant y Humanize, y un flujo de trabajo en la nube para compilar tu binario VST3 sin instalar Visual Studio ni herramientas C++ en tu computadora.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleDownloadZip}
              disabled={downloading}
              className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow-lg shadow-cyan-400/10 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Archive className="w-4 h-4" />
              <span>{downloading ? 'Generando ZIP...' : 'Descargar Proyecto Completo (.ZIP para GitHub)'}</span>
            </button>

            <a
              href="#codigo"
              className="px-4 py-2.5 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
            >
              Ver Archivos C++ y CMake
            </a>

            <a
              href="#guia-github"
              className="px-4 py-2.5 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
            >
              Paso a Paso en GitHub
            </a>
          </div>
        </section>

        {/* Section 1: Live DSP Simulator */}
        <section id="simulador" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                MÓDULO INTERACTIVO
              </span>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Prueba con tu voz o con la melodía de prueba
            </span>
          </div>

          <AudioTunerDemo />
        </section>

        {/* Section 2: Code Explorer */}
        <section id="codigo" className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              CÓDIGO FUENTE & AUTOMATIZACIÓN
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Estructura lista para clonar o subir
            </span>
          </div>

          <CodeExplorer />
        </section>

        {/* Section 3: GitHub CI/CD Actions Guide */}
        <section id="guia-github" className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              GUÍA DE COMPILACIÓN EN LA NUBE
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Zero-install: todo ocurre en los servidores de GitHub
            </span>
          </div>

          <GitHubWorkflowGuide />
        </section>

        {/* Section 4: FL Studio Setup Guide */}
        <section className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              INTEGRACIÓN EN EL DAW
            </span>
            <span className="text-xs text-slate-500 font-mono">
              FL Studio 20 / 21 / 2024 en Windows x64
            </span>
          </div>

          <FlStudioGuide />
        </section>

      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 px-6 mt-16">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            Undertune VST3 Audio Plugin Engine · Construido con JUCE 7 y GitHub Actions
          </div>
          <div className="flex items-center gap-4">
            <a href="#simulador" className="hover:text-slate-300 transition-colors">Simulador</a>
            <a href="#codigo" className="hover:text-slate-300 transition-colors">Código C++</a>
            <a href="#guia-github" className="hover:text-slate-300 transition-colors">Guía GitHub</a>
            <a href="#fl-studio" className="hover:text-slate-300 transition-colors">FL Studio</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
