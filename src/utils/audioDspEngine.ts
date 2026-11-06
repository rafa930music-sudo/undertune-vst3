/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
export const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

export interface TunerState {
  detectedPitch: number; // Hz
  targetPitch: number;   // Hz
  targetNoteName: string;
  detectedNoteName: string;
  correctionCents: number; // -50 to +50 cents
  isVoiced: boolean;
  confidence: number;
}

/**
 * Autocorrelation pitch detection algorithm matching JUCE C++ implementation
 */
export function detectPitchAutocorrelation(buffer: Float32Array, sampleRate: number): { pitch: number; confidence: number } {
  const minLag = Math.floor(sampleRate / 1050); // ~1050 Hz max vocal
  const maxLag = Math.floor(sampleRate / 65);   // ~65 Hz min vocal

  if (maxLag >= buffer.length) {
    return { pitch: 0, confidence: 0 };
  }

  // Calculate zero-lag energy
  let energyZero = 0;
  for (let i = 0; i < buffer.length - maxLag; i++) {
    energyZero += buffer[i] * buffer[i];
  }

  // Silence / noise floor check
  if (energyZero < 0.0005) {
    return { pitch: 0, confidence: 0 };
  }

  let bestLag = -1;
  let maxCorr = -1;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let sumSquare = 0;

    for (let i = 0; i < buffer.length - maxLag; i++) {
      const a = buffer[i];
      const b = buffer[i + lag];
      sum += a * b;
      sumSquare += b * b;
    }

    const norm = Math.sqrt(energyZero * sumSquare) + 1e-9;
    const normalizedCorr = sum / norm;

    if (normalizedCorr > maxCorr) {
      maxCorr = normalizedCorr;
      bestLag = lag;
    }
  }

  // Confidence threshold
  if (maxCorr < 0.55 || bestLag <= minLag || bestLag >= maxLag) {
    return { pitch: 0, confidence: maxCorr };
  }

  // Parabolic interpolation for sub-sample accuracy
  let y1 = 0;
  let y2 = maxCorr;
  let y3 = 0;
  const lagPrev = bestLag - 1;
  const lagNext = bestLag + 1;

  for (let i = 0; i < buffer.length - maxLag; i++) {
    y1 += buffer[i] * buffer[i + lagPrev];
    y3 += buffer[i] * buffer[i + lagNext];
  }

  const delta = (y1 - y3) / (2 * (y1 - 2 * y2 + y3) + 1e-9);
  const clampedDelta = Math.max(-0.5, Math.min(0.5, delta));
  const refinedLag = bestLag + clampedDelta;

  if (refinedLag <= 0) return { pitch: 0, confidence: 0 };

  const fundamentalHz = sampleRate / refinedLag;
  return { pitch: fundamentalHz, confidence: maxCorr };
}

/**
 * Quantizes detected Hz to closest note in specified key and scale
 */
export function quantizePitchToScale(
  detectedHz: number,
  rootKey: number, // 0 = C, 1 = C#, ... 11 = B
  scaleType: number, // 0 = Chromatic, 1 = Major, 2 = Minor
  humanizePercent: number // 0 to 100
): { targetHz: number; targetNote: string; cents: number; detectedNote: string } {
  if (detectedHz < 20 || detectedHz > 3000) {
    return { targetHz: detectedHz, targetNote: '--', cents: 0, detectedNote: '--' };
  }

  // Convert Hz to fractional MIDI note
  const midiFraction = 69 + 12 * Math.log2(detectedHz / 440);
  const roundedMidi = Math.round(midiFraction);

  const semitoneInOctave = ((roundedMidi % 12) + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;
  const detectedNote = `${NOTE_NAMES[semitoneInOctave]}${octave}`;

  let targetMidi = roundedMidi;

  if (scaleType !== 0) {
    // 1 = Major, 2 = Minor
    const allowedIntervals = scaleType === 1 ? MAJOR_INTERVALS : MINOR_INTERVALS;

    let minDistance = 999;
    for (let offset = -2; offset <= 2; offset++) {
      const candidateMidi = roundedMidi + offset;
      const intervalFromRoot = (((candidateMidi - rootKey) % 12) + 12) % 12;

      if (allowedIntervals.includes(intervalFromRoot)) {
        const dist = Math.abs(midiFraction - candidateMidi);
        if (dist < minDistance) {
          minDistance = dist;
          targetMidi = candidateMidi;
        }
      }
    }
  }

  // Humanize tolerance deadzone
  let pullTarget = targetMidi;
  if (humanizePercent > 0) {
    const deviation = midiFraction - pullTarget;
    const deadzone = 0.35 * (humanizePercent / 100);
    if (Math.abs(deviation) < deadzone) {
      pullTarget = midiFraction;
    }
  }

  const targetHz = 440 * Math.pow(2, (pullTarget - 69) / 12);
  const targetNoteInOctave = ((targetMidi % 12) + 12) % 12;
  const targetOctave = Math.floor(targetMidi / 12) - 1;
  const targetNote = `${NOTE_NAMES[targetNoteInOctave]}${targetOctave}`;

  const cents = Math.round(1200 * Math.log2(targetHz / detectedHz));

  return { targetHz, targetNote, cents, detectedNote };
}
