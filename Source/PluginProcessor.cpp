/*
  ==============================================================================
    Undertune - VST3 Pitch Correction Plugin
    PluginProcessor.cpp
    Framework: JUCE 7
    Target DAW: FL Studio / Windows x64
  ==============================================================================
*/

#include "PluginProcessor.h"
#include "PluginEditor.h"

//==============================================================================
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

UndertuneAudioProcessor::~UndertuneAudioProcessor()
{
}

//==============================================================================
juce::AudioProcessorValueTreeState::ParameterLayout UndertuneAudioProcessor::createParameterLayout()
{
    std::vector<std::unique_ptr<juce::RangedAudioParameter>> params;

    // Retune Speed: 0 ms (hard T-Pain robot tune) to 100 ms (natural vocal correction)
    params.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID ("retuneSpeed", 1),
        "Retune Speed",
        juce::NormalisableRange<float> (0.0f, 100.0f, 0.1f, 0.6f),
        20.0f,
        juce::String(),
        juce::AudioProcessorParameter::genericParameter,
        [](float val, int) { return juce::String (val, 1) + " ms"; }));

    // Formant: -12.0 to +12.0 Semitones
    params.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID ("formant", 1),
        "Formant Shift",
        juce::NormalisableRange<float> (-12.0f, 12.0f, 0.1f),
        0.0f,
        juce::String(),
        juce::AudioProcessorParameter::genericParameter,
        [](float val, int) { return (val > 0.0f ? "+" : "") + juce::String (val, 1) + " st"; }));

    // Humanize: 0% to 100% (allows natural micro-vibrato without hard snapping)
    params.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID ("humanize", 1),
        "Humanize",
        juce::NormalisableRange<float> (0.0f, 100.0f, 1.0f),
        15.0f,
        juce::String(),
        juce::AudioProcessorParameter::genericParameter,
        [](float val, int) { return juce::String ((int)val) + " %"; }));

    // Key: C, C#, D, D#, E, F, F#, G, G#, A, A#, B (0 to 11)
    juce::StringArray keys = { "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" };
    params.push_back (std::make_unique<juce::AudioParameterChoice> (
        juce::ParameterID ("key", 1),
        "Key",
        keys,
        0));

    // Scale: Chromatic, Major, Minor
    juce::StringArray scales = { "Chromatic", "Major", "Minor" };
    params.push_back (std::make_unique<juce::AudioParameterChoice> (
        juce::ParameterID ("scale", 1),
        "Scale",
        scales,
        0));

    // Bypass: On / Off
    params.push_back (std::make_unique<juce::AudioParameterBool> (
        juce::ParameterID ("bypass", 1),
        "Bypass",
        false));

    return { params.begin(), params.end() };
}

//==============================================================================
const juce::String UndertuneAudioProcessor::getName() const
{
    return JucePlugin_Name;
}

bool UndertuneAudioProcessor::acceptsMidi() const { return false; }
bool UndertuneAudioProcessor::producesMidi() const { return false; }
bool UndertuneAudioProcessor::isMidiEffect() const { return false; }
double UndertuneAudioProcessor::getTailLengthSeconds() const { return 0.0; }

int UndertuneAudioProcessor::getNumPrograms() { return 1; }
int UndertuneAudioProcessor::getCurrentProgram() { return 0; }
void UndertuneAudioProcessor::setCurrentProgram (int) {}
const juce::String UndertuneAudioProcessor::getProgramName (int) { return {}; }
void UndertuneAudioProcessor::changeProgramName (int, const juce::String&) {}

//==============================================================================
void UndertuneAudioProcessor::prepareToPlay (double sampleRate, int /*samplesPerBlock*/)
{
    currentSampleRate = sampleRate;
    std::fill (analysisRingBuffer.begin(), analysisRingBuffer.end(), 0.0f);
    std::fill (delayBuffer.begin(), delayBuffer.end(), 0.0f);
    analysisWritePos = 0;
    delayWritePos = 0;
    grainPhase1 = 0.0;
    grainPhase2 = 0.5;
    smoothedPitchShiftRatio = 1.0f;
    currentPitchHz = 440.0f;

    // Setup Formant Filters (initial pass-through)
    auto filterCoeffs = juce::dsp::IIR::Coefficients<float>::makeAllPass (sampleRate, 1000.0f);
    formantFilterL.coefficients = filterCoeffs;
    formantFilterR.coefficients = filterCoeffs;
    formantFilterL.reset();
    formantFilterR.reset();
}

void UndertuneAudioProcessor::releaseResources()
{
}

bool UndertuneAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono()
     && layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;

    if (layouts.getMainOutputChannelSet() != layouts.getMainInputChannelSet())
        return false;

    return true;
}

//==============================================================================
// Pitch Detection via Autocorrelation
//==============================================================================
float UndertuneAudioProcessor::detectPitchAutocorrelation (const float* buffer, int numSamples)
{
    // Search limits corresponding to human vocal pitch range: 65 Hz to 1050 Hz
    const int minLag = (int)(currentSampleRate / 1050.0);
    const int maxLag = (int)(currentSampleRate / 65.0);

    if (maxLag >= numSamples)
        return 0.0f;

    // Compute Zero-lag Energy
    double energyZero = 0.0;
    for (int i = 0; i < numSamples - maxLag; ++i)
        energyZero += buffer[i] * buffer[i];

    if (energyZero < 0.0001) // Below noise floor / silence
        return 0.0f;

    int bestLag = -1;
    double maxAutocorr = -1.0;

    // Normalized Autocorrelation search
    for (int lag = minLag; lag <= maxLag; ++lag)
    {
        double sum = 0.0;
        double sumSquare = 0.0;

        for (int i = 0; i < numSamples - maxLag; ++i)
        {
            sum += (double)buffer[i] * (double)buffer[i + lag];
            sumSquare += (double)buffer[i + lag] * (double)buffer[i + lag];
        }

        double normFactor = std::sqrt (energyZero * sumSquare) + 1e-9;
        double normalizedCorrelation = sum / normFactor;

        if (normalizedCorrelation > maxAutocorr)
        {
            maxAutocorr = normalizedCorrelation;
            bestLag = lag;
        }
    }

    // Voicing threshold: Voiced speech has strong autocorrelation (> 0.6)
    if (maxAutocorr < 0.60 || bestLag <= minLag || bestLag >= maxLag)
        return 0.0f;

    // Parabolic Sub-sample Interpolation for precise pitch determination
    double y1 = 0.0, y2 = maxAutocorr, y3 = 0.0;
    int lagPrev = bestLag - 1;
    int lagNext = bestLag + 1;

    for (int i = 0; i < numSamples - maxLag; ++i)
    {
        y1 += (double)buffer[i] * (double)buffer[i + lagPrev];
        y3 += (double)buffer[i] * (double)buffer[i + lagNext];
    }

    double delta = (y1 - y3) / (2.0 * (y1 - 2.0 * y2 + y3) + 1e-9);
    double refinedLag = (double)bestLag + juce::jlimit (-0.5, 0.5, delta);

    if (refinedLag <= 0.0)
        return 0.0f;

    return (float)(currentSampleRate / refinedLag);
}

//==============================================================================
// Scale Quantization (Chromatic, Major, Minor)
//==============================================================================
float UndertuneAudioProcessor::quantizePitchToScale (float detectedHz, int rootKey, int scaleType, float humanizeAmount)
{
    if (detectedHz < 20.0f || detectedHz > 3000.0f)
        return detectedHz;

    // Convert frequency to fractional MIDI note
    float midiNote = 69.0f + 12.0f * std::log2 (detectedHz / 440.0f);
    int roundedNote = (int)std::round (midiNote);
    int noteInOctave = ((roundedNote % 12) + 12) % 12;

    // Determine scale masks (1 = note allowed, 0 = note excluded)
    // Scale intervals relative to Root:
    // Major: 0, 2, 4, 5, 7, 9, 11
    // Minor: 0, 2, 3, 5, 7, 8, 10
    static const int majorScale[12] = { 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1 };
    static const int minorScale[12] = { 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0 };

    int targetMidiNote = roundedNote;

    if (scaleType != 0) // Not Chromatic
    {
        const int* scaleMask = (scaleType == 1) ? majorScale : minorScale;

        // Search closest in-scale note within +/- 2 semitones
        float minDistance = 999.0f;
        for (int offset = -2; offset <= 2; ++offset)
        {
            int candidateNote = roundedNote + offset;
            int candidateInOctave = (((candidateNote - rootKey) % 12) + 12) % 12;

            if (scaleMask[candidateInOctave])
            {
                float dist = std::abs (midiNote - (float)candidateNote);
                if (dist < minDistance)
                {
                    minDistance = dist;
                    targetMidiNote = candidateNote;
                }
            }
        }
    }

    // Humanize: Add slight dead-zone or soften pull to exact pitch
    float pullTarget = (float)targetMidiNote;
    if (humanizeAmount > 0.0f)
    {
        float dev = midiNote - pullTarget; // Distance in semitones
        float deadzone = 0.35f * (humanizeAmount / 100.0f); // Up to 35 cents margin
        if (std::abs (dev) < deadzone)
        {
            // Preserve small natural inflection
            pullTarget = midiNote;
        }
    }

    // Convert target MIDI note back to Hz
    return 440.0f * std::pow (2.0f, (pullTarget - 69.0f) / 12.0f);
}

//==============================================================================
void UndertuneAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& /*midiMessages*/)
{
    juce::ScopedNoDenormals noDenormals;
    const int totalNumInputChannels  = getTotalNumInputChannels();
    const int totalNumOutputChannels = getTotalNumOutputChannels();

    for (int i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear (i, 0, buffer.getNumSamples());

    const int numSamples = buffer.getNumSamples();
    if (numSamples == 0) return;

    // Read Parameters
    const bool  isBypassed   = apvts.getRawParameterValue ("bypass")->load() > 0.5f;
    const float retuneSpeed  = apvts.getRawParameterValue ("retuneSpeed")->load();
    const float formantShift = apvts.getRawParameterValue ("formant")->load();
    const float humanizeVal  = apvts.getRawParameterValue ("humanize")->load();
    const int   rootKey      = (int)apvts.getRawParameterValue ("key")->load();
    const int   scaleType    = (int)apvts.getRawParameterValue ("scale")->load();

    if (isBypassed)
    {
        currentCorrectionCents.store (0.0f);
        return;
    }

    // Feed Mono mix to Pitch Detection Ring Buffer
    const float* channelL = buffer.getReadPointer (0);
    const float* channelR = (totalNumInputChannels > 1) ? buffer.getReadPointer (1) : channelL;

    for (int i = 0; i < numSamples; ++i)
    {
        float monoSample = 0.5f * (channelL[i] + channelR[i]);
        analysisRingBuffer[analysisWritePos] = monoSample;
        analysisWritePos = (analysisWritePos + 1) % analysisWindowSize;
    }

    // Extract linearized window for pitch autocorrelation
    std::vector<float> linearBuffer (analysisWindowSize);
    for (int i = 0; i < analysisWindowSize; ++i)
    {
        int srcIdx = (analysisWritePos + i) % analysisWindowSize;
        linearBuffer[i] = analysisRingBuffer[srcIdx];
    }

    // Detect Pitch
    float detectedPitch = detectPitchAutocorrelation (linearBuffer.data(), analysisWindowSize);
    bool voiced = (detectedPitch > 50.0f);
    isVoiced.store (voiced);

    float targetPitch = detectedPitch;
    float desiredShiftRatio = 1.0f;

    if (voiced)
    {
        currentDetectedPitch.store (detectedPitch);
        targetPitch = quantizePitchToScale (detectedPitch, rootKey, scaleType, humanizeVal);
        currentTargetPitch.store (targetPitch);

        // Desired ratio: target / detected
        desiredShiftRatio = targetPitch / detectedPitch;
        desiredShiftRatio = juce::jlimit (0.5f, 2.0f, desiredShiftRatio); // +/- 1 octave max correction

        float cents = 1200.0f * std::log2 (desiredShiftRatio);
        currentCorrectionCents.store (cents);
    }
    else
    {
        desiredShiftRatio = 1.0f;
        currentCorrectionCents.store (0.0f);
    }

    // Retune Speed Smoothing:
    // retuneSpeed = 0 ms -> instant hard auto-tune (alpha = 1.0)
    // retuneSpeed = 100 ms -> slow gentle pitch transition
    float timeConstantSec = (retuneSpeed * 0.001f);
    float alpha = (timeConstantSec <= 0.0005f) ? 1.0f : (1.0f - std::exp (-1.0f * (float)numSamples / (timeConstantSec * (float)currentSampleRate)));
    alpha = juce::jlimit (0.001f, 1.0f, alpha);

    smoothedPitchShiftRatio += alpha * (desiredShiftRatio - smoothedPitchShiftRatio);

    // Apply Real-time Granular Delay Pitch Shifter
    double rateDelta = (double)(smoothedPitchShiftRatio - 1.0f);

    float* outL = buffer.getWritePointer (0);
    float* outR = (totalNumOutputChannels > 1) ? buffer.getWritePointer (1) : nullptr;

    for (int i = 0; i < numSamples; ++i)
    {
        float inSampleL = channelL[i];
        float inSampleR = channelR[i];

        // Store into delay buffer
        delayBuffer[delayWritePos] = 0.5f * (inSampleL + inSampleR);

        // Advance grains
        grainPhase1 += rateDelta / grainPeriodSamples;
        grainPhase2 += rateDelta / grainPeriodSamples;

        while (grainPhase1 >= 1.0) grainPhase1 -= 1.0;
        while (grainPhase1 <  0.0) grainPhase1 += 1.0;
        while (grainPhase2 >= 1.0) grainPhase2 -= 1.0;
        while (grainPhase2 <  0.0) grainPhase2 += 1.0;

        // Triangular / Hann window crossfading between 2 grains
        double w1 = 0.5 * (1.0 - std::cos (2.0 * juce::MathConstants<double>::pi * grainPhase1));
        double w2 = 0.5 * (1.0 - std::cos (2.0 * juce::MathConstants<double>::pi * grainPhase2));

        double delay1 = grainPhase1 * grainPeriodSamples;
        double delay2 = grainPhase2 * grainPeriodSamples;

        double readPos1 = (double)delayWritePos - delay1;
        if (readPos1 < 0.0) readPos1 += delayBufferSize;

        double readPos2 = (double)delayWritePos - delay2;
        if (readPos2 < 0.0) readPos2 += delayBufferSize;

        // Linear interpolation readout
        int idx1A = (int)readPos1 % delayBufferSize;
        int idx1B = (idx1A + 1) % delayBufferSize;
        float frac1 = (float)(readPos1 - (int)readPos1);
        float s1 = delayBuffer[idx1A] * (1.0f - frac1) + delayBuffer[idx1B] * frac1;

        int idx2A = (int)readPos2 % delayBufferSize;
        int idx2B = (idx2A + 1) % delayBufferSize;
        float frac2 = (float)(readPos2 - (int)readPos2);
        float s2 = delayBuffer[idx2A] * (1.0f - frac2) + delayBuffer[idx2B] * frac2;

        float pitchedMono = (float)(s1 * w1 + s2 * w2);

        // Mix back: replace or blend with dry signal depending on voicing
        if (voiced)
        {
            outL[i] = pitchedMono;
            if (outR) outR[i] = pitchedMono;
        }
        else
        {
            outL[i] = inSampleL;
            if (outR) outR[i] = inSampleR;
        }

        delayWritePos = (delayWritePos + 1) % delayBufferSize;
    }

    // Apply Formant Filtering (Biquad spectral shifting)
    if (std::abs (formantShift) > 0.05f)
    {
        // Shift formant center frequency up or down based on semitones
        float formantMultiplier = std::pow (2.0f, formantShift / 12.0f);
        float centerFreq = juce::jlimit (200.0f, 8000.0f, 1500.0f * formantMultiplier);
        float gainFactor = (formantShift > 0.0f) ? 1.25f : 0.85f;

        auto newCoeffs = juce::dsp::IIR::Coefficients<float>::makePeakFilter (
            currentSampleRate,
            centerFreq,
            1.414f,
            gainFactor);

        formantFilterL.coefficients = newCoeffs;
        formantFilterR.coefficients = newCoeffs;

        for (int i = 0; i < numSamples; ++i)
        {
            outL[i] = formantFilterL.processSample (outL[i]);
            if (outR)
                outR[i] = formantFilterR.processSample (outR[i]);
        }
    }
}

//==============================================================================
bool UndertuneAudioProcessor::hasEditor() const
{
    return true;
}

juce::AudioProcessorEditor* UndertuneAudioProcessor::createEditor()
{
    return new UndertuneAudioProcessorEditor (*this);
}

//==============================================================================
void UndertuneAudioProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    std::unique_ptr<juce::XmlElement> xml (state.createXml());
    copyXmlToBinary (*xml, destData);
}

void UndertuneAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    std::unique_ptr<juce::XmlElement> xmlState (getXmlFromBinary (data, sizeInBytes));
    if (xmlState.get() != nullptr)
        if (xmlState->hasTagName (apvts.state.getType()))
            apvts.replaceState (juce::ValueTree::fromXml (*xmlState));
}

//==============================================================================
// This creates new instances of the plugin..
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new UndertuneAudioProcessor();
}
