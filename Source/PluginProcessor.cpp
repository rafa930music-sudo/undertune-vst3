/*
  ==============================================================================
    Undertune Cinematic Ultra - Professional Vocal Tuning Workstation
    PluginProcessor.cpp
    Framework: JUCE 7 | Target DAW: FL Studio (Windows x64)
  ==============================================================================
*/

#include "PluginProcessor.h"
#include "PluginEditor.h"

const std::vector<UndertuneAudioProcessor::PresetInfo>& UndertuneAudioProcessor::getPresetList()
{
    static const std::vector<PresetInfo> presets = {
        { "01. Travis Hard Snap (Instant Hard Tune)",   0.0f,  0.0f, 100.0f,  0.0f,  0.0f, 25.0f, 2.0f, 100.0f, 0, 1 },
        { "02. Cyber Trap Crisp (Modern Auto-Tune)",    3.0f,  0.6f, 102.0f, 10.0f, 15.0f, 30.0f, 3.5f, 100.0f, 0, 2 },
        { "03. Billboard Pop Lead (Silky Correction)", 22.0f,  0.0f, 100.0f, 25.0f, 40.0f, 10.0f, 2.0f, 100.0f, 0, 1 },
        { "04. Deep Dark Demon (Monster Pitch FX)",     5.0f, -5.0f, 120.0f, 10.0f, 10.0f, 45.0f, 0.0f, 100.0f, 0, 0 },
        { "05. Hyperpop Helium (Chipmunk Glitch)",      2.0f,  5.5f,  82.0f,  5.0f,  8.0f, 20.0f, 5.0f, 100.0f, 0, 0 },
        { "06. Warm Soul Acoustic (Natural Touch)",    36.0f,  0.0f, 100.0f, 55.0f, 65.0f, 20.0f, 1.5f, 100.0f, 0, 2 },
        { "07. Daft Droid Vocoder Snap (0ms Robot)",    0.0f, -1.8f,  95.0f,  0.0f,  0.0f, 60.0f, 4.0f, 100.0f, 0, 0 },
        { "08. Parallel Doubler (Vocal Thickener)",    16.0f,  0.2f, 100.0f, 20.0f, 35.0f, 15.0f, 2.0f,  50.0f, 0, 1 },
        { "09. Smooth RnB Melisma (Vibrato Safe)",     30.0f,  0.0f, 100.0f, 45.0f, 85.0f, 15.0f, 3.0f, 100.0f, 0, 2 },
        { "10. Drill Dark Vocal (Aggressive Drive)",    4.0f, -1.2f, 105.0f,  8.0f, 12.0f, 50.0f, 1.0f, 100.0f, 0, 2 },
        { "11. Ambient Air Shimmer (12kHz Sheen)",     25.0f,  1.0f,  96.0f, 30.0f, 50.0f,  5.0f, 6.0f,  85.0f, 0, 1 },
        { "12. Studio Master Init (Clean Neutral)",    18.0f,  0.0f, 100.0f, 20.0f, 30.0f,  0.0f, 0.0f, 100.0f, 0, 0 }
    };
    return presets;
}

UndertuneAudioProcessor::UndertuneAudioProcessor()
#ifndef JucePlugin_PreferredChannelConfigurations
     : AudioProcessor (BusesProperties()
                     #if ! JucePlugin_IsMidiEffect
                      #if ! JucePlugin_IsSynth
                       .withInput  ("Input",  juce::AudioChannelSet::stereo(), true)
                      #endif
                       .withOutput ("Output", juce::AudioChannelSet::stereo(), true)
                     #endif
                       ),
       apvts (*this, nullptr, "Parameters", createParameterLayout())
#endif
{
    analysisRingBuffer.resize (analysisWindowSize, 0.0f);
    delayBuffer.resize (delayBufferSize, 0.0f);
}

UndertuneAudioProcessor::~UndertuneAudioProcessor() {}

juce::AudioProcessorValueTreeState::ParameterLayout UndertuneAudioProcessor::createParameterLayout()
{
    std::vector<std::unique_ptr<juce::RangedAudioParameter>> params;

    // 1. Retune Speed (0.0 to 100.0 ms)
    params.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID ("retuneSpeed", 1), "Retune Speed",
        juce::NormalisableRange<float> (0.0f, 100.0f, 0.1f, 0.45f), 15.0f,
        juce::String(), juce::AudioProcessorParameter::genericParameter,
        [](float val, int) { return juce::String (val, 1) + " ms"; }));

    // 2. Formant Shift (-12.0 to +12.0 st)
    params.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID ("formant", 1), "Formant Shift",
        juce::NormalisableRange<float> (-12.0f, 12.0f, 0.1f), 0.0f,
        juce::String(), juce::AudioProcessorParameter::genericParameter,
        [](float val, int) { return (val > 0.0f ? "+" : "") + juce::String (val, 1) + " st"; }));

    // 3. Throat Length (70% to 140% acoustic vocal tract model)
    params.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID ("throat", 1), "Throat Length",
        juce::NormalisableRange<float> (70.0f, 140.0f, 1.0f), 100.0f,
        juce::String(), juce::AudioProcessorParameter::genericParameter,
        [](float val, int) { return juce::String ((int)val) + " %"; }));

    // 4. Humanize (0% to 100%)
    params.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID ("humanize", 1), "Humanize",
        juce::NormalisableRange<float> (0.0f, 100.0f, 1.0f), 20.0f,
        juce::String(), juce::AudioProcessorParameter::genericParameter,
        [](float val, int) { return juce::String ((int)val) + " %"; }));

    // 5. Natural Vibrato (0% to 100%)
    params.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID ("naturalVibrato", 1), "Natural Vibrato",
        juce::NormalisableRange<float> (0.0f, 100.0f, 1.0f), 30.0f,
        juce::String(), juce::AudioProcessorParameter::genericParameter,
        [](float val, int) { return juce::String ((int)val) + " %"; }));

    // 6. Analog Tube Warmth (0% to 100% saturation)
    params.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID ("warmth", 1), "Tube Warmth",
        juce::NormalisableRange<float> (0.0f, 100.0f, 1.0f), 15.0f,
        juce::String(), juce::AudioProcessorParameter::genericParameter,
        [](float val, int) { return juce::String ((int)val) + " %"; }));

    // 7. Air Sheen (0 dB to +8 dB high-shelf at 12kHz)
    params.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID ("air", 1), "Air Sheen",
        juce::NormalisableRange<float> (0.0f, 8.0f, 0.1f), 1.5f,
        juce::String(), juce::AudioProcessorParameter::genericParameter,
        [](float val, int) { return "+" + juce::String (val, 1) + " dB"; }));

    // 8. Dry/Wet Mix (0% to 100%)
    params.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID ("mix", 1), "Dry/Wet Mix",
        juce::NormalisableRange<float> (0.0f, 100.0f, 1.0f), 100.0f,
        juce::String(), juce::AudioProcessorParameter::genericParameter,
        [](float val, int) { return juce::String ((int)val) + " %"; }));

    // 9. Output Gain (-12 dB to +12 dB)
    params.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID ("outputGain", 1), "Output Gain",
        juce::NormalisableRange<float> (-12.0f, 12.0f, 0.1f), 0.0f,
        juce::String(), juce::AudioProcessorParameter::genericParameter,
        [](float val, int) { return (val > 0.0f ? "+" : "") + juce::String (val, 1) + " dB"; }));

    // 10. Key
    juce::StringArray keys = { "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" };
    params.push_back (std::make_unique<juce::AudioParameterChoice> (juce::ParameterID ("key", 1), "Key", keys, 0));

    // 11. Scale (7 Modern Musical Scales)
    juce::StringArray scales = { "Chromatic", "Major", "Natural Minor", "Harmonic Minor", "Dorian", "Pentatonic", "Blues" };
    params.push_back (std::make_unique<juce::AudioParameterChoice> (juce::ParameterID ("scale", 1), "Scale", scales, 0));

    // 12. Vocal Range
    juce::StringArray ranges = { "Low (Bass / Baritone)", "Mid (Tenor / Alto)", "High (Soprano)" };
    params.push_back (std::make_unique<juce::AudioParameterChoice> (juce::ParameterID ("vocalRange", 1), "Vocal Range", ranges, 1));

    // 13. Bypass
    params.push_back (std::make_unique<juce::AudioParameterBool> (juce::ParameterID ("bypass", 1), "Bypass", false));

    return { params.begin(), params.end() };
}

int UndertuneAudioProcessor::getNumPrograms() { return (int)getPresetList().size(); }
int UndertuneAudioProcessor::getCurrentProgram() { return currentProgramIndex; }
void UndertuneAudioProcessor::setCurrentProgram (int index) { loadPreset (index); }
const juce::String UndertuneAudioProcessor::getProgramName (int index)
{
    const auto& list = getPresetList();
    if (juce::isPositiveAndBelow (index, (int)list.size()))
        return list[(size_t)index].name;
    return {};
}
void UndertuneAudioProcessor::changeProgramName (int, const juce::String&) {}

void UndertuneAudioProcessor::loadPreset (int index)
{
    const auto& list = getPresetList();
    if (! juce::isPositiveAndBelow (index, (int)list.size())) return;
    currentProgramIndex = index;
    const auto& p = list[(size_t)index];

    if (auto* param = apvts.getParameter ("retuneSpeed"))   param->setValueNotifyingHost (param->convertTo0to1 (p.speed));
    if (auto* param = apvts.getParameter ("formant"))       param->setValueNotifyingHost (param->convertTo0to1 (p.formant));
    if (auto* param = apvts.getParameter ("throat"))        param->setValueNotifyingHost (param->convertTo0to1 (p.throat));
    if (auto* param = apvts.getParameter ("humanize"))      param->setValueNotifyingHost (param->convertTo0to1 (p.humanize));
    if (auto* param = apvts.getParameter ("naturalVibrato")) param->setValueNotifyingHost (param->convertTo0to1 (p.vibrato));
    if (auto* param = apvts.getParameter ("warmth"))        param->setValueNotifyingHost (param->convertTo0to1 (p.warmth));
    if (auto* param = apvts.getParameter ("air"))           param->setValueNotifyingHost (param->convertTo0to1 (p.air));
    if (auto* param = apvts.getParameter ("mix"))           param->setValueNotifyingHost (param->convertTo0to1 (p.mix));
    if (auto* param = apvts.getParameter ("key"))           param->setValueNotifyingHost (param->convertTo0to1 ((float)p.key));
    if (auto* param = apvts.getParameter ("scale"))         param->setValueNotifyingHost (param->convertTo0to1 ((float)p.scale));
}

const juce::String UndertuneAudioProcessor::getName() const { return JucePlugin_Name; }
bool UndertuneAudioProcessor::acceptsMidi() const { return false; }
bool UndertuneAudioProcessor::producesMidi() const { return false; }
bool UndertuneAudioProcessor::isMidiEffect() const { return false; }
double UndertuneAudioProcessor::getTailLengthSeconds() const { return 0.0; }

void UndertuneAudioProcessor::prepareToPlay (double sampleRate, int)
{
    currentSampleRate = sampleRate;
    std::fill (analysisRingBuffer.begin(), analysisRingBuffer.end(), 0.0f);
    std::fill (delayBuffer.begin(), delayBuffer.end(), 0.0f);
    analysisWritePos = 0;
    delayWritePos = 0;
    grainPhase1 = 0.0;
    grainPhase2 = 0.5;
    smoothedPitchShiftRatio = 1.0f;

    auto defaultCoeffs = juce::dsp::IIR::Coefficients<float>::makeAllPass (sampleRate, 1000.0f);
    formantFilterL1.coefficients = defaultCoeffs;
    formantFilterL2.coefficients = defaultCoeffs;
    formantFilterR1.coefficients = defaultCoeffs;
    formantFilterR2.coefficients = defaultCoeffs;

    auto airCoeffs = juce::dsp::IIR::Coefficients<float>::makeHighShelf (sampleRate, 11500.0f, 0.707f, 1.0f);
    airFilterL.coefficients = airCoeffs;
    airFilterR.coefficients = airCoeffs;
}

void UndertuneAudioProcessor::releaseResources() {}

bool UndertuneAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono()
     && layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;
    return layouts.getMainOutputChannelSet() == layouts.getMainInputChannelSet();
}

float UndertuneAudioProcessor::detectPitchAutocorrelation (const float* buffer, int numSamples, int rangeMode, float sensitivity)
{
    double minF = (rangeMode == 0) ? 65.0 : (rangeMode == 2 ? 150.0 : 90.0);
    double maxF = (rangeMode == 0) ? 450.0 : (rangeMode == 2 ? 1150.0 : 800.0);

    const int minLag = (int)(currentSampleRate / maxF);
    const int maxLag = (int)(currentSampleRate / minF);
    if (maxLag >= numSamples) return 0.0f;

    double energyZero = 0.0;
    for (int i = 0; i < numSamples - maxLag; ++i)
        energyZero += buffer[i] * buffer[i];

    if (energyZero < 0.0001) return 0.0f;

    int bestLag = -1;
    double maxAutocorr = -1.0;

    for (int lag = minLag; lag <= maxLag; ++lag)
    {
        double sum = 0.0;
        double sumSquare = 0.0;
        for (int i = 0; i < numSamples - maxLag; ++i)
        {
            sum += (double)buffer[i] * (double)buffer[i + lag];
            sumSquare += (double)buffer[i + lag] * (double)buffer[i + lag];
        }

        double norm = std::sqrt (energyZero * sumSquare) + 1e-9;
        double corr = sum / norm;
        if (corr > maxAutocorr)
        {
            maxAutocorr = corr;
            bestLag = lag;
        }
    }

    if (maxAutocorr < 0.58 || bestLag <= minLag || bestLag >= maxLag)
        return 0.0f;

    // Sub-sample Parabolic refinement
    double y1 = 0.0, y2 = maxAutocorr, y3 = 0.0;
    for (int i = 0; i < numSamples - maxLag; ++i)
    {
        y1 += (double)buffer[i] * (double)buffer[i + bestLag - 1];
        y3 += (double)buffer[i] * (double)buffer[i + bestLag + 1];
    }
    double delta = (y1 - y3) / (2.0 * (y1 - 2.0 * y2 + y3) + 1e-9);
    double refinedLag = (double)bestLag + juce::jlimit (-0.5, 0.5, delta);

    return (refinedLag > 0.0) ? (float)(currentSampleRate / refinedLag) : 0.0f;
}

float UndertuneAudioProcessor::quantizePitchToScale (float detectedHz, int rootKey, int scaleType, float humanizeAmount, float vibratoPreserve)
{
    if (detectedHz < 20.0f || detectedHz > 3000.0f) return detectedHz;

    float midiNote = 69.0f + 12.0f * std::log2 (detectedHz / 440.0f);
    int roundedNote = (int)std::round (midiNote);

    static const int majorScale[12]      = { 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1 };
    static const int naturalMinor[12]    = { 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0 };
    static const int harmonicMinor[12]   = { 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1 };
    static const int dorianScale[12]     = { 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0 };
    static const int pentatonicScale[12] = { 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0 };
    static const int bluesScale[12]      = { 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 1, 0 };

    int targetMidiNote = roundedNote;

    if (scaleType != 0)
    {
        const int* scaleMask = majorScale;
        if (scaleType == 2) scaleMask = naturalMinor;
        else if (scaleType == 3) scaleMask = harmonicMinor;
        else if (scaleType == 4) scaleMask = dorianScale;
        else if (scaleType == 5) scaleMask = pentatonicScale;
        else if (scaleType == 6) scaleMask = bluesScale;

        float minDistance = 999.0f;
        for (int offset = -2; offset <= 2; ++offset)
        {
            int candidate = roundedNote + offset;
            int inOctave = (((candidate - rootKey) % 12) + 12) % 12;
            if (scaleMask[inOctave])
            {
                float dist = std::abs (midiNote - (float)candidate);
                if (dist < minDistance)
                {
                    minDistance = dist;
                    targetMidiNote = candidate;
                }
            }
        }
    }

    float pullTarget = (float)targetMidiNote;
    float deviation = midiNote - pullTarget;
    float deadzone = 0.25f * (humanizeAmount / 100.0f) + 0.22f * (vibratoPreserve / 100.0f);
    if (std::abs (deviation) < deadzone)
        pullTarget = midiNote;

    return 440.0f * std::pow (2.0f, (pullTarget - 69.0f) / 12.0f);
}

void UndertuneAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;
    const int totalNumInputChannels  = getTotalNumInputChannels();
    const int totalNumOutputChannels = getTotalNumOutputChannels();

    for (int i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear (i, 0, buffer.getNumSamples());

    const int numSamples = buffer.getNumSamples();
    if (numSamples == 0) return;

    const bool  isBypassed   = apvts.getRawParameterValue ("bypass")->load() > 0.5f;
    const float retuneSpeed  = apvts.getRawParameterValue ("retuneSpeed")->load();
    const float formantShift = apvts.getRawParameterValue ("formant")->load();
    const float throatLength = apvts.getRawParameterValue ("throat")->load();
    const float humanizeVal  = apvts.getRawParameterValue ("humanize")->load();
    const float vibratoVal   = apvts.getRawParameterValue ("naturalVibrato")->load();
    const float warmthVal    = apvts.getRawParameterValue ("warmth")->load();
    const float airGainDb    = apvts.getRawParameterValue ("air")->load();
    const float mixPercent   = apvts.getRawParameterValue ("mix")->load();
    const float outGainDb    = apvts.getRawParameterValue ("outputGain")->load();
    const int   rootKey      = (int)apvts.getRawParameterValue ("key")->load();
    const int   scaleType    = (int)apvts.getRawParameterValue ("scale")->load();
    const int   vocalRange   = (int)apvts.getRawParameterValue ("vocalRange")->load();

    const float* channelL = buffer.getReadPointer (0);
    const float* channelR = (totalNumInputChannels > 1) ? buffer.getReadPointer (1) : channelL;

    float inPeak = 0.0f;
    for (int i = 0; i < numSamples; ++i)
    {
        float p = std::max (std::abs (channelL[i]), std::abs (channelR[i]));
        if (p > inPeak) inPeak = p;
    }
    inputLevelDb.store (juce::Decibels::gainToDecibels (inPeak, -60.0f));

    if (isBypassed)
    {
        currentCorrectionCents.store (0.0f);
        outputLevelDb.store (inputLevelDb.load());
        return;
    }

    for (int i = 0; i < numSamples; ++i)
    {
        analysisRingBuffer[analysisWritePos] = 0.5f * (channelL[i] + channelR[i]);
        analysisWritePos = (analysisWritePos + 1) % analysisWindowSize;
    }

    std::vector<float> linearBuffer (analysisWindowSize);
    for (int i = 0; i < analysisWindowSize; ++i)
        linearBuffer[i] = analysisRingBuffer[(analysisWritePos + i) % analysisWindowSize];

    float detectedPitch = detectPitchAutocorrelation (linearBuffer.data(), analysisWindowSize, vocalRange, 65.0f);
    bool voiced = (detectedPitch > 40.0f);
    isVoiced.store (voiced);

    float desiredShiftRatio = 1.0f;
    if (voiced)
    {
        currentDetectedPitch.store (detectedPitch);
        float targetPitch = quantizePitchToScale (detectedPitch, rootKey, scaleType, humanizeVal, vibratoVal);
        currentTargetPitch.store (targetPitch);

        desiredShiftRatio = juce::jlimit (0.5f, 2.0f, targetPitch / detectedPitch);
        currentCorrectionCents.store (1200.0f * std::log2 (desiredShiftRatio));
    }
    else
    {
        currentCorrectionCents.store (0.0f);
    }

    float timeConstantSec = (retuneSpeed * 0.001f);
    float alpha = (timeConstantSec <= 0.0003f) ? 1.0f : (1.0f - std::exp (-1.0f * (float)numSamples / (timeConstantSec * (float)currentSampleRate)));
    alpha = juce::jlimit (0.0008f, 1.0f, alpha);
    smoothedPitchShiftRatio += alpha * (desiredShiftRatio - smoothedPitchShiftRatio);

    double rateDelta = (double)(smoothedPitchShiftRatio - 1.0f);
    float* outL = buffer.getWritePointer (0);
    float* outR = (totalNumOutputChannels > 1) ? buffer.getWritePointer (1) : nullptr;

    float wetGain = mixPercent * 0.01f;
    float dryGain = 1.0f - wetGain;
    float linearOutGain = juce::Decibels::decibelsToGain (outGainDb);

    for (int i = 0; i < numSamples; ++i)
    {
        float inL = channelL[i];
        float inR = channelR[i];
        delayBuffer[delayWritePos] = 0.5f * (inL + inR);

        grainPhase1 += rateDelta / grainPeriodSamples;
        grainPhase2 += rateDelta / grainPeriodSamples;

        while (grainPhase1 >= 1.0) grainPhase1 -= 1.0;
        while (grainPhase1 <  0.0) grainPhase1 += 1.0;
        while (grainPhase2 >= 1.0) grainPhase2 -= 1.0;
        while (grainPhase2 <  0.0) grainPhase2 += 1.0;

        double w1 = 0.5 * (1.0 - std::cos (2.0 * juce::MathConstants<double>::pi * grainPhase1));
        double w2 = 0.5 * (1.0 - std::cos (2.0 * juce::MathConstants<double>::pi * grainPhase2));

        double r1 = (double)delayWritePos - (grainPhase1 * grainPeriodSamples);
        if (r1 < 0.0) r1 += delayBufferSize;
        double r2 = (double)delayWritePos - (grainPhase2 * grainPeriodSamples);
        if (r2 < 0.0) r2 += delayBufferSize;

        int i1 = (int)r1 % delayBufferSize;
        int i2 = (int)r2 % delayBufferSize;
        float s1 = delayBuffer[i1] * (1.0f - (float)(r1 - i1)) + delayBuffer[(i1 + 1) % delayBufferSize] * (float)(r1 - i1);
        float s2 = delayBuffer[i2] * (1.0f - (float)(r2 - i2)) + delayBuffer[(i2 + 1) % delayBufferSize] * (float)(r2 - i2);

        float pitched = (float)(s1 * w1 + s2 * w2);

        if (voiced)
        {
            outL[i] = (pitched * wetGain + inL * dryGain) * linearOutGain;
            if (outR) outR[i] = (pitched * wetGain + inR * dryGain) * linearOutGain;
        }
        else
        {
            outL[i] = inL * linearOutGain;
            if (outR) outR[i] = inR * linearOutGain;
        }

        delayWritePos = (delayWritePos + 1) % delayBufferSize;
    }

    // Formant + Throat Length Modeling
    float combinedFormantShift = formantShift + 12.0f * (1.0f - (throatLength / 100.0f));
    if (std::abs (combinedFormantShift) > 0.05f)
    {
        float formantMult = std::pow (2.0f, combinedFormantShift / 12.0f);
        float center1 = juce::jlimit (250.0f, 4200.0f, 950.0f * formantMult);
        float center2 = juce::jlimit (600.0f, 9000.0f, 2800.0f * formantMult);
        float gainF = (combinedFormantShift > 0.0f) ? 1.35f : 0.75f;

        auto c1 = juce::dsp::IIR::Coefficients<float>::makePeakFilter (currentSampleRate, center1, 1.25f, gainF);
        auto c2 = juce::dsp::IIR::Coefficients<float>::makePeakFilter (currentSampleRate, center2, 1.50f, gainF);

        formantFilterL1.coefficients = c1;
        formantFilterL2.coefficients = c2;
        formantFilterR1.coefficients = c1;
        formantFilterR2.coefficients = c2;

        for (int i = 0; i < numSamples; ++i)
        {
            outL[i] = formantFilterL2.processSample (formantFilterL1.processSample (outL[i]));
            if (outR) outR[i] = formantFilterR2.processSample (formantFilterR1.processSample (outR[i]));
        }
    }

    // Air Sheen High-Shelf Filter
    if (airGainDb > 0.1f)
    {
        float linearAir = juce::Decibels::decibelsToGain (airGainDb);
        auto airCoeffs = juce::dsp::IIR::Coefficients<float>::makeHighShelf (currentSampleRate, 11500.0f, 0.707f, linearAir);
        airFilterL.coefficients = airCoeffs;
        airFilterR.coefficients = airCoeffs;
        for (int i = 0; i < numSamples; ++i)
        {
            outL[i] = airFilterL.processSample (outL[i]);
            if (outR) outR[i] = airFilterR.processSample (outR[i]);
        }
    }

    // Analog Tube Warmth Soft-Saturation
    if (warmthVal > 1.0f)
    {
        float drive = 1.0f + (warmthVal * 0.025f);
        for (int i = 0; i < numSamples; ++i)
        {
            outL[i] = std::tanh (outL[i] * drive) / drive;
            if (outR) outR[i] = std::tanh (outR[i] * drive) / drive;
        }
        saturationMeter.store (warmthVal);
    }
    else
    {
        saturationMeter.store (0.0f);
    }

    float outPeak = 0.0f;
    for (int i = 0; i < numSamples; ++i)
    {
        float p = std::max (std::abs (outL[i]), outR ? std::abs (outR[i]) : 0.0f);
        if (p > outPeak) outPeak = p;
    }
    outputLevelDb.store (juce::Decibels::gainToDecibels (outPeak, -60.0f));
}

bool UndertuneAudioProcessor::hasEditor() const { return true; }
juce::AudioProcessorEditor* UndertuneAudioProcessor::createEditor()
{
    return new UndertuneAudioProcessorEditor (*this);
}

void UndertuneAudioProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    std::unique_ptr<juce::XmlElement> xml (state.createXml());
    copyXmlToBinary (*xml, destData);
}

void UndertuneAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    std::unique_ptr<juce::XmlElement> xmlState (getXmlFromBinary (data, sizeInBytes));
    if (xmlState.get() != nullptr && xmlState->hasTagName (apvts.state.getType()))
        apvts.replaceState (juce::ValueTree::fromXml (*xmlState));
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new UndertuneAudioProcessor();
}
