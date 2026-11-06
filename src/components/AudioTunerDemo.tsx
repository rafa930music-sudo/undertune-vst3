/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Play, 
  Square, 
  RotateCcw, 
  Volume2, 
  Activity, 
  Sliders, 
  Music, 
  Radio 
} from 'lucide-react';
import { 
  NOTE_NAMES, 
  detectPitchAutocorrelation, 
  quantizePitchToScale, 
  MAJOR_INTERVALS, 
  MINOR_INTERVALS 
} from '../utils/audioDspEngine';

export const AudioTunerDemo: React.FC = () => {
  // Parameters
  const [retuneSpeed, setRetuneSpeed] = useState<number>(15); // ms (0 = robot, 100 = natural)
  const [formant, setFormant] = useState<number>(0);         // semitones (-12 to +12)
  const [humanize, setHumanize] = useState<number>(20);       // % (0 to 100)
  const [rootKey, setRootKey] = useState<number>(0);         // 0 = C
  const [scaleType, setScaleType] = useState<number>(1);     // 0 = Chromatic, 1 = Major, 2 = Minor
  const [bypass, setBypass] = useState<boolean>(false);

  // Audio state
  const [isPlayingDemo, setIsPlayingDemo] = useState<boolean>(false);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Telemetry state
  const [detectedHz, setDetectedHz] = useState<number>(0);
  const [targetHz, setTargetHz] = useState<number>(0);
  const [detectedNote, setDetectedNote] = useState<string>('--');
  const [targetNote, setTargetNote] = useState<string>('--');
  const [centsDeviation, setCentsDeviation] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);

  // Refs for Web Audio
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const demoIntervalRef = useRef<number | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pitchHistoryRef = useRef<Array<{ detected: number; target: number }>>([]);

  // Pitch graph rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Grid background
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let y = 20; y < canvas.height; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw Center Tuning Line
      ctx.strokeStyle = '#334155';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const history = pitchHistoryRef.current;
      if (history.length > 1) {
        // Draw Target Pitch Curve (Emerald)
        ctx.beginPath();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.5;
        for (let i = 0; i < history.length; i++) {
          const x = (i / (history.length - 1)) * canvas.width;
          // map 100Hz - 600Hz to canvas height
          const y = canvas.height - ((history[i].target - 120) / 400) * canvas.height;
          const clampedY = Math.max(10, Math.min(canvas.height - 10, y));
          if (i === 0) ctx.moveTo(x, clampedY);
          else ctx.lineTo(x, clampedY);
        }
        ctx.stroke();

        // Draw Raw Detected Pitch Curve (Cyan)
        ctx.beginPath();
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.8;
        for (let i = 0; i < history.length; i++) {
          const x = (i / (history.length - 1)) * canvas.width;
          const y = canvas.height - ((history[i].detected - 120) / 400) * canvas.height;
          const clampedY = Math.max(10, Math.min(canvas.height - 10, y));
          if (i === 0) ctx.moveTo(x, clampedY);
          else ctx.lineTo(x, clampedY);
        }
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  // Stop all audio on unmount
  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, []);

  const getAudioContext = (): AudioContext => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new AudioCtx();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const stopAllAudio = () => {
    if (demoIntervalRef.current) {
      window.clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    if (oscRef.current) {
      try {
        oscRef.current.stop();
        oscRef.current.disconnect();
      } catch {
        // ignore
      }
      oscRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsPlayingDemo(false);
    setIsMicActive(false);
    setDetectedHz(0);
    setTargetHz(0);
    setDetectedNote('--');
    setTargetNote('--');
    setCentsDeviation(0);
    setConfidence(0);
  };

  // Start real-time audio analysis loop
  const startPitchAnalysisLoop = (analyser: AnalyserNode, sampleRate: number) => {
    const buffer = new Float32Array(analyser.fftSize);

    let smoothedPitch = 0;

    const analyze = () => {
      analyser.getFloatTimeDomainData(buffer);
      const res = detectPitchAutocorrelation(buffer, sampleRate);

      if (res.pitch > 0 && res.confidence > 0.5) {
        const { targetHz: calculatedTarget, targetNote: tNote, cents, detectedNote: dNote } = quantizePitchToScale(
          res.pitch,
          rootKey,
          scaleType,
          humanize
        );

        // Retune speed smoothing simulation
        const smoothingFactor = Math.max(0.05, 1 - retuneSpeed / 120);
        smoothedPitch += (calculatedTarget - smoothedPitch) * smoothingFactor;

        setDetectedHz(res.pitch);
        setTargetHz(smoothedPitch);
        setDetectedNote(dNote);
        setTargetNote(tNote);
        setCentsDeviation(cents);
        setConfidence(res.confidence);

        // Update pitch history for canvas
        pitchHistoryRef.current.push({
          detected: res.pitch,
          target: bypass ? res.pitch : smoothedPitch,
        });
        if (pitchHistoryRef.current.length > 80) {
          pitchHistoryRef.current.shift();
        }
      } else {
        setConfidence(0);
      }

      animationFrameRef.current = requestAnimationFrame(analyze);
    };

    analyze();
  };

  // Toggle Live Microphone input
  const toggleMicrophone = async () => {
    if (isMicActive) {
      stopAllAudio();
      return;
    }

    stopAllAudio();
    setAudioError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;

      const ctx = getAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;

      source.connect(analyser);
      analyserRef.current = analyser;

      setIsMicActive(true);
      startPitchAnalysisLoop(analyser, ctx.sampleRate);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo acceder al micrófono.';
      setAudioError(message);
      setIsMicActive(false);
    }
  };

  // Toggle Demo Vocal Pattern
  const toggleDemoAudio = () => {
    if (isPlayingDemo) {
      stopAllAudio();
      return;
    }

    stopAllAudio();
    setAudioError(null);

    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;

    osc.type = 'sawtooth';
    gain.gain.value = 0.12;

    // Filter to simulate vocal formant warmth
    const formantFilter = ctx.createBiquadFilter();
    formantFilter.type = 'lowpass';
    formantFilter.frequency.value = 1400;

    osc.connect(formantFilter);
    formantFilter.connect(gain);
    gain.connect(analyser);
    gain.connect(ctx.destination);

    osc.start();
    oscRef.current = osc;
    gainNodeRef.current = gain;
    analyserRef.current = analyser;

    // Simulation melody: intentionally glides and deviates slightly off-pitch
    // e.g. A3 (220Hz), C#4 (277Hz), E4 (330Hz), G#4 (415Hz) with pitch drifts
    const melody = [
      { base: 220, drift: 12 },  // A3 sharp
      { base: 247, drift: -15 }, // B3 flat
      { base: 277, drift: 24 },  // C#4 sharp
      { base: 330, drift: -18 }, // E4 flat
      { base: 370, drift: 10 },  // F#4 sharp
      { base: 415, drift: -25 }, // G#4 flat
      { base: 440, drift: 16 },  // A4 sharp
    ];

    let noteIdx = 0;
    osc.frequency.setValueAtTime(melody[0].base + melody[0].drift, ctx.currentTime);

    const intervalId = window.setInterval(() => {
      noteIdx = (noteIdx + 1) % melody.length;
      const note = melody[noteIdx];
      const targetFreq = note.base + note.drift;
      // Exponential glide simulating a singer transitioning
      osc.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.08);
    }, 900);

    demoIntervalRef.current = intervalId;
    setIsPlayingDemo(true);
    startPitchAnalysisLoop(analyser, ctx.sampleRate);
  };

  // Reset defaults
  const resetParameters = () => {
    setRetuneSpeed(15);
    setFormant(0);
    setHumanize(20);
    setRootKey(0);
    setScaleType(1);
    setBypass(false);
  };

  // Helper for active notes in scale
  const isNoteInScale = (semitone: number): boolean => {
    if (scaleType === 0) return true; // Chromatic
    const intervals = scaleType === 1 ? MAJOR_INTERVALS : MINOR_INTERVALS;
    const intervalFromRoot = ((semitone - rootKey) % 12 + 12) % 12;
    return intervals.includes(intervalFromRoot);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Top Console Bar */}
      <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span className="font-display font-bold text-sm tracking-wide text-slate-100">
              SIMULADOR DSP DE AUTOTUNE EN VIVO
            </span>
          </div>
          <span className="text-xs text-slate-500 font-mono hidden sm:inline">
            Algoritmo Autocorrelación v7.0
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio controls */}
          <button
            onClick={toggleDemoAudio}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
              isPlayingDemo 
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            {isPlayingDemo ? <Square className="w-3.5 h-3.5 text-rose-400" /> : <Play className="w-3.5 h-3.5 text-cyan-400" />}
            {isPlayingDemo ? 'Detener Demo' : 'Probar Audio Demo'}
          </button>

          <button
            onClick={toggleMicrophone}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
              isMicActive 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            {isMicActive ? <MicOff className="w-3.5 h-3.5 text-emerald-400" /> : <Mic className="w-3.5 h-3.5 text-slate-400" />}
            {isMicActive ? 'Detener Micrófono' : 'Usar Micrófono'}
          </button>

          <button
            onClick={resetParameters}
            title="Restablecer parámetros predeterminados"
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {audioError && (
        <div className="px-5 py-2.5 bg-rose-950/40 border-b border-rose-900/50 text-xs text-rose-300 flex items-center gap-2">
          <span>Error de audio:</span>
          <span>{audioError}</span>
        </div>
      )}

      {/* Main Plugin Interface Canvas & HUD */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Real-time Telemetry & Pitch Meter */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Digital Telemetry Box */}
          <div className="bg-slate-950/90 border border-slate-800 p-4 rounded-lg">
            <div className="grid grid-cols-3 gap-2 text-center pb-3 border-b border-slate-800/80">
              <div>
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">DETECTADO</div>
                <div className="text-xl font-mono font-bold text-cyan-400 mt-1 tabular-nums">
                  {detectedHz > 0 ? `${detectedHz.toFixed(1)}` : '--'}
                  <span className="text-[10px] text-slate-500 font-normal ml-1">Hz</span>
                </div>
                <div className="text-xs font-semibold text-slate-300 mt-0.5 font-mono">
                  {detectedNote}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">OBJETIVO</div>
                <div className="text-xl font-mono font-bold text-emerald-400 mt-1 tabular-nums">
                  {targetHz > 0 ? `${targetHz.toFixed(1)}` : '--'}
                  <span className="text-[10px] text-slate-500 font-normal ml-1">Hz</span>
                </div>
                <div className="text-xs font-semibold text-emerald-300 mt-0.5 font-mono">
                  {targetNote}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">CORRECCIÓN</div>
                <div className={`text-xl font-mono font-bold mt-1 tabular-nums ${
                  Math.abs(centsDeviation) < 5 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {detectedHz > 0 ? (centsDeviation > 0 ? `+${centsDeviation}` : `${centsDeviation}`) : '0'}
                  <span className="text-[10px] text-slate-500 font-normal ml-1">cents</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                  {confidence > 0 ? `${Math.round(confidence * 100)}% conf` : 'silencio'}
                </div>
              </div>
            </div>

            {/* Cents Deviation Meter Bar */}
            <div className="pt-3">
              <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                <span>-50 c (Flat)</span>
                <span className="text-emerald-400 font-semibold">AFINADO 0</span>
                <span>+50 c (Sharp)</span>
              </div>
              <div className="relative h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                {/* Center marker */}
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-600 -translate-x-1/2 z-10" />
                {/* Tuning position pointer */}
                <div 
                  className={`absolute top-0 bottom-0 rounded-full transition-all duration-75 ${
                    bypass 
                      ? 'bg-slate-600' 
                      : Math.abs(centsDeviation) < 5 
                        ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' 
                        : 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                  }`}
                  style={{
                    left: `${Math.max(5, Math.min(95, 50 + centsDeviation))}%`,
                    width: '6px',
                    transform: 'translateX(-50%)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Real-time Pitch Curve Graph */}
          <div className="bg-slate-950/90 border border-slate-800 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                TRAZO DE TONO (TIEMPO REAL)
              </span>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="text-cyan-400 flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-cyan-400 inline-block" /> Voz cruda
                </span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-emerald-400 inline-block" /> Afinada
                </span>
              </div>
            </div>

            <canvas
              ref={canvasRef}
              width={380}
              height={140}
              className="w-full h-32 rounded bg-slate-950 border border-slate-900"
            />
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mt-1.5">
              <span>Bajo (120 Hz)</span>
              <span>Medio (300 Hz)</span>
              <span>Agudo (520 Hz)</span>
            </div>
          </div>

          {/* Scale Note Matrix */}
          <div className="bg-slate-950/90 border border-slate-800 p-3.5 rounded-lg">
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
              NOTAS ACTIVAS EN LA ESCALA SELECCIONADA
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
              {NOTE_NAMES.map((note, idx) => {
                const inScale = isNoteInScale(idx);
                const isRoot = idx === rootKey;
                const isCurrent = detectedNote.startsWith(note);
                return (
                  <div
                    key={note}
                    className={`py-1.5 text-center rounded text-xs font-mono font-medium transition-colors ${
                      isCurrent
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                        : inScale
                          ? isRoot
                            ? 'bg-emerald-950 border border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-800/80 text-slate-200 border border-slate-700/60'
                          : 'bg-slate-900/40 text-slate-600 border border-transparent line-through'
                    }`}
                  >
                    {note}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Column: VST Plugin Controls (FL Studio Style Knobs & Switches) */}
        <div className="lg:col-span-7 bg-slate-950/60 border border-slate-800 p-5 rounded-lg flex flex-col justify-between space-y-6">
          
          {/* Header Controls: Key, Scale, Bypass */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">
                KEY / TONALIDAD
              </label>
              <select
                value={rootKey}
                onChange={(e) => setRootKey(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
              >
                {NOTE_NAMES.map((n, i) => (
                  <option key={n} value={i}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">
                SCALE / ESCALA
              </label>
              <select
                value={scaleType}
                onChange={(e) => setScaleType(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
              >
                <option value={0}>Cromática (12 Notas)</option>
                <option value={1}>Mayor (Major)</option>
                <option value={2}>Menor (Natural Minor)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">
                ESTADO VST
              </label>
              <button
                type="button"
                onClick={() => setBypass(!bypass)}
                className={`w-full py-2 px-3 text-xs font-mono font-bold rounded-lg border transition-colors ${
                  bypass
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                }`}
              >
                {bypass ? 'BYPASS ACTIVO' : 'PROCESANDO AUDIO'}
              </button>
            </div>
          </div>

          {/* Knobs / Faders Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Retune Speed Knob */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-lg flex flex-col items-center text-center">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold mb-1">
                RETUNE SPEED
              </span>
              <span className="text-[11px] text-slate-400 mb-3">
                {retuneSpeed === 0 ? 'Hard Robot (T-Pain)' : retuneSpeed < 30 ? 'Efecto Rápido' : 'Corrección Natural'}
              </span>

              <div className="relative w-28 h-28 flex items-center justify-center my-1">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="#1e293b"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="#06b6d4"
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 - (251.2 * (100 - retuneSpeed)) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-center">
                  <div className="text-lg font-mono font-bold text-slate-100 tabular-nums">
                    {retuneSpeed}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">ms</div>
                </div>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={retuneSpeed}
                onChange={(e) => setRetuneSpeed(Number(e.target.value))}
                className="w-full accent-cyan-400 mt-2 cursor-pointer"
              />
            </div>

            {/* Formant Shift Knob */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-lg flex flex-col items-center text-center">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold mb-1">
                FORMANT SHIFT
              </span>
              <span className="text-[11px] text-slate-400 mb-3">
                {formant < -2 ? 'Grave / Monstruo' : formant > 2 ? 'Agudo / Ardilla' : 'Timbre Natural'}
              </span>

              <div className="relative w-28 h-28 flex items-center justify-center my-1">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="#1e293b"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="#8b5cf6"
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 - (251.2 * (formant + 12)) / 24}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-center">
                  <div className="text-lg font-mono font-bold text-slate-100 tabular-nums">
                    {formant > 0 ? `+${formant}` : formant}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">st</div>
                </div>
              </div>

              <input
                type="range"
                min="-12"
                max="12"
                step="0.5"
                value={formant}
                onChange={(e) => setFormant(Number(e.target.value))}
                className="w-full accent-purple-400 mt-2 cursor-pointer"
              />
            </div>

            {/* Humanize Knob */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-lg flex flex-col items-center text-center">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold mb-1">
                HUMANIZE
              </span>
              <span className="text-[11px] text-slate-400 mb-3">
                {humanize === 0 ? 'Afinación Estricta' : 'Micro-vibrato Libre'}
              </span>

              <div className="relative w-28 h-28 flex items-center justify-center my-1">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="#1e293b"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="#10b981"
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 - (251.2 * humanize) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-center">
                  <div className="text-lg font-mono font-bold text-slate-100 tabular-nums">
                    {humanize}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">%</div>
                </div>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={humanize}
                onChange={(e) => setHumanize(Number(e.target.value))}
                className="w-full accent-emerald-400 mt-2 cursor-pointer"
              />
            </div>

          </div>

          {/* Quick preset selector buttons */}
          <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono text-slate-400">PRESETS DE ESTUDIO:</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => { setRetuneSpeed(0); setHumanize(0); setFormant(0); }}
                className="px-2.5 py-1 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors"
              >
                Hard Tune (Trap/Urban)
              </button>
              <button
                onClick={() => { setRetuneSpeed(22); setHumanize(25); setFormant(0); }}
                className="px-2.5 py-1 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors"
              >
                Pop Vocal (Transparente)
              </button>
              <button
                onClick={() => { setRetuneSpeed(5); setHumanize(5); setFormant(-3.5); }}
                className="px-2.5 py-1 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors"
              >
                Deep Voice (Voz Grave)
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
