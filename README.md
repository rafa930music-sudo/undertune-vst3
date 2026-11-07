# Undertune - Vocal Pitch Corrector (VST3)

Plugin VST3 de afinación vocal en tiempo real (estilo Auto-Tune) creado con el framework **JUCE 7** en C++ para **FL Studio** y DAWs en Windows.

## Características DSP
- **Detección de tono por autocorrelación normalizada**: Algoritmo optimizado para la voz humana (65 Hz - 1050 Hz) con interpolación parabólica para precisión de sub-centésimas.
- **Corrección a escalas**: Cromática, Mayor y Menor natural.
- **Parámetros**:
  - **Retune Speed (0 a 100 ms)**: 0 ms produce el efecto clásico robótico hard-tune (T-Pain / Cher / Travis Scott). Valores mayores ofrecen afinación transparente.
  - **Formant Shift (-12 a +12 st)**: Modifica el timbre vocal (voz más grave/monstruo o voz más aguda/ardilla) manteniendo el tono afinado.
  - **Humanize (0 a 100%)**: Ventana de tolerancia para no aplastar vibratos naturales y micro-expresiones vocales.
  - **Key & Scale**: Tonalidad fundamental (C hasta B) y escala.
  - **Bypass**: Interruptor sin clics.

## Compilación automática en GitHub Actions
Este proyecto **NO requiere instalar Visual Studio, C++ ni JUCE** en tu computadora local:
1. Sube este repositorio a tu cuenta de GitHub.
2. Ve a la pestaña **Actions**.
3. El flujo `build.yml` compilará el plugin en los servidores de GitHub en la nube.
4. Descarga el archivo generado **Undertune-VST3-Windows-x64.zip** en la sección *Artifacts*.
5. Extrae `Undertune.vst3` en:
   `C:\Program Files\Common Files\VST3\`
6. En FL Studio abre **Options > Manage Plugins > Find more plugins** ¡y listo!
