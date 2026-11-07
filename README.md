# Undertune Cinematic Ultra - Professional Vocal Tuning Workstation (VST3)

Plugin VST3 de afinación vocal cinemática de alta definición (estilo Auto-Tune Pro / Melodyne) creado con el framework **JUCE 7** en C++ para **FL Studio** y DAWs en Windows x64.

## Novedades Cinematic Ultra
- **12 Presets de Estudio Integrados**:
  1. Travis Hard Snap (Instant Hard Tune 0ms)
  2. Cyber Trap Crisp (Modern Auto-Tune)
  3. Billboard Pop Lead (Silky Correction)
  4. Deep Dark Demon (Monster Pitch FX)
  5. Hyperpop Helium (Chipmunk Glitch)
  6. Warm Soul Acoustic (Natural Touch)
  7. Daft Droid Vocoder Snap (0ms Robot)
  8. Parallel Doubler (Vocal Thickener)
  9. Smooth RnB Melisma (Vibrato Safe)
  10. Drill Dark Vocal (Aggressive Drive)
  11. Ambient Air Shimmer (12kHz Sheen)
  12. Studio Master Init (Clean Neutral)
- **9 Controles DSP de Precisión**:
  - **Retune Speed (0 a 100 ms)**
  - **Formant Shift (-12 a +12 semitonos)**
  - **Throat Length (70% a 140% modelo acústico)**
  - **Humanize (0 a 100%)**
  - **Natural Vibrato (0 a 100%)**
  - **Analog Tube Warmth (Saturación armónica de válvulas)**
  - **Air Sheen (Filtro high-shelf 12kHz para brillo vocal)**
  - **Dry/Wet Mix (0 a 100%)**
  - **Output Gain (-12 a +12 dB)**
- **7 Escalas Musicales**: Cromática, Mayor, Menor Natural, Menor Armónica, Dórica, Pentatónica y Blues.
- **HUD Cinemático con trazo de tono en tiempo real, aguja de cents y medidores I/O**.

## Compilación automática en GitHub Actions
1. Sube estos archivos a tu repositorio de GitHub.
2. Ve a la pestaña **Actions**.
3. El flujo `build.yml` compila el plugin en Windows Server y genera **Undertune-VST3-Windows-x64.zip**.
4. Descárgalo desde **Artifacts** y extrae `Undertune.vst3` en:
   `C:\Program Files\Common Files\VST3\`
5. En FL Studio abre **Options > Manage Plugins > Find more plugins** ¡y a producir!
