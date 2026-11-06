/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FolderGit2, 
  PlayCircle, 
  DownloadCloud, 
  CheckCircle2, 
  ExternalLink, 
  Layers, 
  Cpu, 
  FileCheck 
} from 'lucide-react';

export const GitHubWorkflowGuide: React.FC = () => {
  const [activeTab, setActiveTab] = useState<number>(1);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      <div className="p-5 bg-slate-950 border-b border-slate-800">
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <FolderGit2 className="w-5 h-5 text-cyan-400" />
          Guía Rápida: De GitHub a FL Studio (Sin Instalar Compiladores)
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Todo el proceso se compila en los servidores de GitHub en Windows (windows-latest) mediante GitHub Actions.
        </p>
      </div>

      {/* Steps Progress Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 bg-slate-950/60 border-b border-slate-800">
        <button
          onClick={() => setActiveTab(1)}
          className={`p-3.5 text-left border-r border-slate-800/80 transition-colors ${
            activeTab === 1 
              ? 'bg-slate-900/90 text-cyan-400 border-b-2 border-b-cyan-400' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500">PASO 1</div>
          <div className="text-xs font-semibold mt-0.5">Crear Repo en GitHub</div>
        </button>

        <button
          onClick={() => setActiveTab(2)}
          className={`p-3.5 text-left border-r border-slate-800/80 transition-colors ${
            activeTab === 2 
              ? 'bg-slate-900/90 text-cyan-400 border-b-2 border-b-cyan-400' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500">PASO 2</div>
          <div className="text-xs font-semibold mt-0.5">Subir los Archivos</div>
        </button>

        <button
          onClick={() => setActiveTab(3)}
          className={`p-3.5 text-left border-r border-slate-800/80 transition-colors ${
            activeTab === 3 
              ? 'bg-slate-900/90 text-cyan-400 border-b-2 border-b-cyan-400' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500">PASO 3</div>
          <div className="text-xs font-semibold mt-0.5">Pestaña "Actions"</div>
        </button>

        <button
          onClick={() => setActiveTab(4)}
          className={`p-3.5 text-left transition-colors ${
            activeTab === 4 
              ? 'bg-slate-900/90 text-cyan-400 border-b-2 border-b-cyan-400' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500">PASO 4</div>
          <div className="text-xs font-semibold mt-0.5">Instalar en FL Studio</div>
        </button>
      </div>

      {/* Step Content */}
      <div className="p-6">
        {activeTab === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-mono">1</span>
              Crear un nuevo repositorio en GitHub
            </h3>
            <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside leading-relaxed">
              <li>Inicia sesión en tu cuenta de <a href="https://github.com" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">GitHub.com</a>.</li>
              <li>Haz clic en el botón verde <strong className="text-slate-100">"New"</strong> o en el símbolo <strong className="text-slate-100">+</strong> (arriba a la derecha) &gt; <strong className="text-slate-100">New repository</strong>.</li>
              <li>Asígnale un nombre, por ejemplo: <code className="bg-slate-950 px-2 py-0.5 rounded text-cyan-300 font-mono">undertune-vst3</code>.</li>
              <li>Puedes elegirlo <strong className="text-slate-100">Public</strong> o <strong className="text-slate-100">Private</strong> (GitHub Actions es gratuito en ambos).</li>
              <li>No marques "Initialize with README" (lo subiremos en el siguiente paso).</li>
              <li>Haz clic en <strong className="text-slate-100">"Create repository"</strong>.</li>
            </ol>
          </div>
        )}

        {activeTab === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-mono">2</span>
              Subir los archivos respetando la estructura de carpetas
            </h3>
            <p className="text-xs text-slate-300">
              Puedes descargar el ZIP completo con el botón <strong className="text-cyan-400">"Descargar Repositorio Completo (.ZIP)"</strong> de esta aplicación, descomprimirlo y subirlo a GitHub. La estructura debe quedar exactamente así:
            </p>

            <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-slate-300 border border-slate-800">
              <div className="text-cyan-400 font-bold mb-1">📁 undertune-vst3/</div>
              <div className="ml-4 text-slate-400">├── 📁 .github/</div>
              <div className="ml-8 text-slate-400">└── 📁 workflows/</div>
              <div className="ml-12 text-emerald-400">└── build.yml <span className="text-slate-500">(Workflow de GitHub Actions)</span></div>
              <div className="ml-4 text-slate-400">├── 📁 Source/</div>
              <div className="ml-8 text-cyan-300">├── PluginProcessor.h <span className="text-slate-500">(Lógica DSP y parámetros)</span></div>
              <div className="ml-8 text-cyan-300">├── PluginProcessor.cpp <span className="text-slate-500">(Autocorrelación y afinador)</span></div>
              <div className="ml-8 text-slate-300">├── PluginEditor.h <span className="text-slate-500">(Interfaz gráfica)</span></div>
              <div className="ml-8 text-slate-300">└── PluginEditor.cpp <span className="text-slate-500">(Perillas y telemetría)</span></div>
              <div className="ml-4 text-emerald-400">├── CMakeLists.txt <span className="text-slate-500">(Descarga JUCE 7 y configura VST3)</span></div>
              <div className="ml-4 text-slate-400">├── .gitignore</div>
              <div className="ml-4 text-slate-400">└── README.md</div>
            </div>

            <div className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded border border-slate-800">
              💡 <strong className="text-slate-200">Tip si usas la web de GitHub:</strong> Si subes archivos manualmente desde el navegador, puedes escribir <code className="text-cyan-300 font-mono">Source/PluginProcessor.h</code> en la caja de nombre de archivo y GitHub creará la carpeta automáticamente.
            </div>
          </div>
        )}

        {activeTab === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-mono">3</span>
              Compilación automática en la pestaña "Actions" y descarga del Artifact
            </h3>
            
            <ol className="space-y-3 text-xs text-slate-300 list-decimal list-inside leading-relaxed">
              <li>
                En tu repositorio de GitHub, haz clic en la pestaña superior <strong className="text-slate-100">"Actions"</strong>.
              </li>
              <li>
                Verás un flujo llamado <strong className="text-cyan-400">"Build Undertune VST3"</strong> ejecutándose con un círculo amarillo giratorio.
                <div className="mt-1 ml-5 text-slate-400">
                  GitHub levantará una máquina virtual con Windows, ejecutará CMake, descargará JUCE 7 y compilará el plugin en modo <em>Release x64</em>. Suele demorar unos 4 a 6 minutos.
                </div>
              </li>
              <li>
                Cuando aparezca el <strong className="text-emerald-400">check verde ✓</strong>, haz clic sobre el nombre del workflow run (por ejemplo: <em>"Build Undertune VST3"</em>).
              </li>
              <li>
                Baja hasta el final de la página a la sección <strong className="text-slate-100">"Artifacts"</strong>.
              </li>
              <li>
                Haz clic en <strong className="text-cyan-400 font-mono">Undertune-VST3-Windows-x64</strong> para descargar el archivo ZIP con el plugin compilado.
              </li>
            </ol>
          </div>
        )}

        {activeTab === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-mono">4</span>
              Instalación y Uso en FL Studio (Windows)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
                <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  1. Copiar a la carpeta VST3 estándar
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Descomprime el ZIP descargado. Encontrarás la carpeta llamada <code className="text-cyan-300 font-mono">Undertune.vst3</code>. Cópiala en:
                </p>
                <div className="bg-slate-900 p-2 rounded text-cyan-300 font-mono text-[11px] select-all border border-slate-800">
                  C:\Program Files\Common Files\VST3\
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
                <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  2. Escanear en FL Studio
                </div>
                <p className="text-slate-300 leading-relaxed">
                  En FL Studio ve a <strong className="text-slate-100">Options &gt; Manage Plugins</strong>.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  Haz clic en <strong className="text-cyan-400">"Find more plugins"</strong>. Undertune aparecerá en color naranja/amarillo.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  ¡Ábrelo en cualquier canal del Mixer y afina tus voces en tiempo real!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
