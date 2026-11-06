/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sliders, Volume2, Sparkles, AlertCircle, Headphones } from 'lucide-react';

export const FlStudioGuide: React.FC = () => {
  return (
    <div id="fl-studio" className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl p-6 space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <Headphones className="w-5 h-5 text-cyan-400" />
          Configuración Profesional en FL Studio para Grabar Voces
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Buenas prácticas de latencia, ruteo en el Mixer y automatización de tono.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Latency Settings */}
        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
          <div className="text-xs font-mono font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5" />
            1. Formato VST3 vs VST2 en Windows
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            A diferencia de los viejos VST2 que eran simples archivos <code className="text-rose-400 font-mono text-[11px]">.dll</code>, el estándar moderno <strong>VST3 de Steinberg</strong> se entrega como un archivo o paquete <code className="text-emerald-400 font-mono text-[11px]">Undertune.vst3</code>.
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            GitHub Actions lo comprime en un <code className="text-cyan-300 font-mono text-[11px]">.zip</code> únicamente para que tu navegador lo descargue rápido. Al descomprimirlo, tienes el <strong className="text-slate-200">.vst3 real</strong>.
          </p>
        </div>

        {/* Mixer Routing */}
        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
          <div className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5" />
            2. Cadena de Inserción en el Mixer
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            El orden de plugins en el slot del canal de voz es fundamental:
          </p>
          <div className="bg-slate-900 p-2.5 rounded font-mono text-[11px] text-slate-300 space-y-1 border border-slate-800">
            <div>Slot 1: Noise Gate / Filtro Paso Alto (80Hz)</div>
            <div className="text-cyan-400 font-bold">Slot 2: Undertune VST3 (Afinación primaria)</div>
            <div>Slot 3: Compresor (Vocal Leveling)</div>
            <div>Slot 4: De-Esser (Control de sibilancias)</div>
            <div>Slot 5: Reverb / Delay (Envío a bus)</div>
          </div>
        </div>

        {/* Automation in FL Studio */}
        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
          <div className="text-xs font-mono font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            3. Automatización de Tonalidad
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Si tu canción modula o cambia de acorde entre estrofa y estribillo:
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            En FL Studio, haz clic derecho sobre cualquier control de Undertune (o en <span className="text-slate-200">Tools &gt; Last tweaked</span>) y elige <strong className="text-slate-200">"Create automation clip"</strong> para variar el Retune Speed o la Escala en el Playlist.
          </p>
        </div>
      </div>
    </div>
  );
};
