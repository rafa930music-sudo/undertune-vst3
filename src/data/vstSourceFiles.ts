/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Undertune VST3 Complete Code Base
 * Framework: JUCE 7
 * Target: VST3 (Windows x64 / FL Studio compatible)
 */

export interface SourceFile {
  id: string;
  filename: string;
  path: string;
  language: string;
  description: string;
  content: string;
}

export const PLUGIN_PROCESSOR_H = `/*
  ==============================================================================
    Undertune - VST3 Pitch Correction Plugin
    PluginProcessor.h
    Framework: JUCE 7
    Target DAW: FL Studio / Windows x64
  ==============================================================================
*/

#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_dsp/juce_dsp.h>
#include <vector>
#include <atomic>
#include <cmath>

class UndertuneAudioProcessor : public juce::AudioProcessor
{
public:
    //==============================================================================
    UndertuneAudioProcessor();
    ~UndertuneAudioProcessor() override;

    //==============================================================================
    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;

    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;

    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    //==============================================================================
    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override;

    //==============================================================================
    const juce::String getName() const override;

    bool acceptsMidi() const override;
    bool producesMidi() const override;
    bool isMidiEffect() const override;
    double getTailLengthSeconds() const override;

    //==============================================================================
    int getNumPrograms() override;
    int getCurrentProgram() override;
    void setCurrentProgram (int index) override;
    const juce::String getProgramName (int index) override;
    void changeProgramName (int index, const juce::String& newName) override;

    //==============================================================================
    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    // State & Parameters
    juce::AudioProcessorValueTreeState apvts;
    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    // Telemetry getters for GUI (Thread-safe)
    float getDetectedPitchHz() const noexcept { return currentDetectedPitch.load(); }
    float getTargetPitchHz() const noexcept   { return currentTargetPitch.load(); }
    float getCorrectionCents() const noexcept { return currentCorrectionCents.load(); }
    bool  getIsVoiced() const noexcept        { return isVoiced.load(); }

private:
    //==============================================================================
    // DSP Pitch Detection via Autocorrelation
    float detectPitchAutocorrelation (const float* buffer, int numSamples);
    
    // Scale Snapping Logic
    float quantizePitchToScale (float detectedHz, int rootKey, int scaleType, float humanizeAmount);
    
    // Internal Circular Buffer for Pitch Detection
    static constexpr int analysisWindowSize = 2048;
    std::vector<float> analysisRingBuffer;
    int analysisWritePos = 0;

    // Pitch Shifter Engine (Granular Delay with Crossfade)
    struct PitchGrain
    {
        double delayPhase = 0.0;
        float  readPos = 0.0f;
    };
    std::vector<float> delayBuffer;
    int delayWritePos = 0;
    static constexpr int delayBufferSize = 8192;
    double grainPhase1 = 0.0;
    double grainPhase2 = 0.5;
    static constexpr double grainPeriodSamples = 1024.0;

    // Smoothed state variables
    float smoothedPitchShiftRatio = 1.0f;
    float currentPitchHz = 440.0f;

    // Formant filter (Biquad formant shift filter)
    juce::dsp::IIR::Filter<float> formantFilterL;
    juce::dsp::IIR::Filter<float> formantFilterR;

    // Atomic telemetry for GUI
    std::atomic<float> currentDetectedPitch { 0.0f };
    std::atomic<float> currentTargetPitch   { 0.0f };
    std::atomic<float> currentCorrectionCents { 0.0f };
    std::atomic<bool>  isVoiced             { false };

    // Cached sample rate
    double currentSampleRate = 44100.0;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (UndertuneAudioProcessor)
};
`;

export const PLUGIN_PROCESSOR_CPP = `/*
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
`;

export const PLUGIN_EDITOR_H = `/*
  ==============================================================================
    Undertune - VST3 Pitch Correction Plugin
    PluginEditor.h
    Framework: JUCE 7
    Target DAW: FL Studio / Windows x64
  ==============================================================================
*/

#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_gui_basics/juce_gui_basics.h>
#include "PluginProcessor.h"

class UndertuneAudioProcessorEditor : public juce::AudioProcessorEditor,
                                      public juce::Timer
{
public:
    UndertuneAudioProcessorEditor (UndertuneAudioProcessor&);
    ~UndertuneAudioProcessorEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;
    void timerCallback() override;

private:
    UndertuneAudioProcessor& audioProcessor;

    // Controls
    juce::Slider retuneSpeedSlider;
    juce::Slider formantSlider;
    juce::Slider humanizeSlider;
    juce::ComboBox keyComboBox;
    juce::ComboBox scaleComboBox;
    juce::ToggleButton bypassButton;

    // Attachments
    using SliderAttachment   = juce::AudioProcessorValueTreeState::SliderAttachment;
    using ComboBoxAttachment = juce::AudioProcessorValueTreeState::ComboBoxAttachment;
    using ButtonAttachment   = juce::AudioProcessorValueTreeState::ButtonAttachment;

    std::unique_ptr<SliderAttachment>   retuneSpeedAttachment;
    std::unique_ptr<SliderAttachment>   formantAttachment;
    std::unique_ptr<SliderAttachment>   humanizeAttachment;
    std::unique_ptr<ComboBoxAttachment> keyAttachment;
    std::unique_ptr<ComboBoxAttachment> scaleAttachment;
    std::unique_ptr<ButtonAttachment>   bypassAttachment;

    // Labels
    juce::Label retuneSpeedLabel;
    juce::Label formantLabel;
    juce::Label humanizeLabel;
    juce::Label keyLabel;
    juce::Label scaleLabel;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (UndertuneAudioProcessorEditor)
};
`;

export const PLUGIN_EDITOR_CPP = `/*
  ==============================================================================
    Undertune - VST3 Pitch Correction Plugin
    PluginEditor.cpp
    Framework: JUCE 7
    Target DAW: FL Studio / Windows x64
  ==============================================================================
*/

#include "PluginProcessor.h"
#include "PluginEditor.h"

UndertuneAudioProcessorEditor::UndertuneAudioProcessorEditor (UndertuneAudioProcessor& p)
    : AudioProcessorEditor (&p), audioProcessor (p)
{
    setSize (640, 420);

    // Style helper for rotary sliders
    auto setupRotary = [this](juce::Slider& slider, juce::Label& label, const juce::String& text)
    {
        slider.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
        slider.setTextBoxStyle (juce::Slider::TextBoxBelow, false, 70, 20);
        slider.setColour (juce::Slider::rotarySliderFillColourId, juce::Colour (0xff06b6d4)); // Cyan
        slider.setColour (juce::Slider::thumbColourId, juce::Colours::white);
        slider.setColour (juce::Slider::textBoxOutlineColourId, juce::Colours::transparentBlack);
        slider.setColour (juce::Slider::textBoxTextColourId, juce::Colour (0xfff1f5f9));
        addAndMakeVisible (slider);

        label.setText (text, juce::dontSendNotification);
        label.setJustificationType (juce::Justification::centred);
        label.setColour (juce::Label::textColourId, juce::Colour (0xff94a3b8));
        addAndMakeVisible (label);
    };

    setupRotary (retuneSpeedSlider, retuneSpeedLabel, "RETUNE SPEED");
    setupRotary (formantSlider, formantLabel, "FORMANT SHIFT");
    setupRotary (humanizeSlider, humanizeLabel, "HUMANIZE");

    // Key ComboBox
    juce::StringArray keys = { "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" };
    for (int i = 0; i < keys.size(); ++i) keyComboBox.addItem (keys[i], i + 1);
    keyComboBox.setColour (juce::ComboBox::backgroundColourId, juce::Colour (0xff1e293b));
    keyComboBox.setColour (juce::ComboBox::textColourId, juce::Colour (0xfff8fafc));
    keyComboBox.setColour (juce::ComboBox::outlineColourId, juce::Colour (0xff334155));
    addAndMakeVisible (keyComboBox);

    keyLabel.setText ("KEY / TONALIDAD", juce::dontSendNotification);
    keyLabel.setColour (juce::Label::textColourId, juce::Colour (0xff94a3b8));
    addAndMakeVisible (keyLabel);

    // Scale ComboBox
    juce::StringArray scales = { "Chromatic", "Major", "Minor" };
    for (int i = 0; i < scales.size(); ++i) scaleComboBox.addItem (scales[i], i + 1);
    scaleComboBox.setColour (juce::ComboBox::backgroundColourId, juce::Colour (0xff1e293b));
    scaleComboBox.setColour (juce::ComboBox::textColourId, juce::Colour (0xfff8fafc));
    scaleComboBox.setColour (juce::ComboBox::outlineColourId, juce::Colour (0xff334155));
    addAndMakeVisible (scaleComboBox);

    scaleLabel.setText ("SCALE / ESCALA", juce::dontSendNotification);
    scaleLabel.setColour (juce::Label::textColourId, juce::Colour (0xff94a3b8));
    addAndMakeVisible (scaleLabel);

    // Bypass Button
    bypassButton.setButtonText ("BYPASS");
    bypassButton.setColour (juce::ToggleButton::textColourId, juce::Colour (0xfff43f5e));
    addAndMakeVisible (bypassButton);

    // APVTS Attachments
    retuneSpeedAttachment = std::make_unique<SliderAttachment> (audioProcessor.apvts, "retuneSpeed", retuneSpeedSlider);
    formantAttachment     = std::make_unique<SliderAttachment> (audioProcessor.apvts, "formant", formantSlider);
    humanizeAttachment    = std::make_unique<SliderAttachment> (audioProcessor.apvts, "humanize", humanizeSlider);
    keyAttachment         = std::make_unique<ComboBoxAttachment> (audioProcessor.apvts, "key", keyComboBox);
    scaleAttachment       = std::make_unique<ComboBoxAttachment> (audioProcessor.apvts, "scale", scaleComboBox);
    bypassAttachment      = std::make_unique<ButtonAttachment> (audioProcessor.apvts, "bypass", bypassButton);

    // Timer for 30 FPS display refreshes
    startTimerHz (30);
}

UndertuneAudioProcessorEditor::~UndertuneAudioProcessorEditor()
{
    stopTimer();
}

void UndertuneAudioProcessorEditor::paint (juce::Graphics& g)
{
    // Background gradient
    g.fillAll (juce::Colour (0xff090d16));

    // Header bar
    g.setColour (juce::Colour (0xff0f172a));
    g.fillRect (0, 0, getWidth(), 64);

    g.setColour (juce::Colour (0xff1e293b));
    g.drawHorizontalLine (64, 0.0f, (float)getWidth());

    // Title Wordmark
    g.setFont (juce::Font (24.0f, juce::Font::bold));
    g.setColour (juce::Colour (0xfff8fafc));
    g.drawText ("UNDERTUNE", 24, 16, 200, 32, juce::Justification::left);

    g.setFont (juce::Font (12.0f, juce::Font::plain));
    g.setColour (juce::Colour (0xff06b6d4));
    g.drawText ("VOCAL TUNER VST3", 168, 22, 140, 24, juce::Justification::left);

    // Real-Time Pitch Telemetry Display
    auto bounds = getLocalBounds().reduced (24);
    auto displayArea = juce::Rectangle<int> (24, 80, getWidth() - 48, 86);

    g.setColour (juce::Colour (0xff0f172a));
    g.fillRoundedRectangle (displayArea.toFloat(), 8.0f);
    g.setColour (juce::Colour (0xff1e293b));
    g.drawRoundedRectangle (displayArea.toFloat(), 8.0f, 1.0f);

    float detectedPitch = audioProcessor.getDetectedPitchHz();
    float targetPitch   = audioProcessor.getTargetPitchHz();
    float correction    = audioProcessor.getCorrectionCents();
    bool  isVoiced      = audioProcessor.getIsVoiced();

    // Display values
    g.setFont (juce::Font ("JetBrains Mono", 12.0f, juce::Font::plain));
    g.setColour (juce::Colour (0xff64748b));
    g.drawText ("PITCH DETECTED", 44, 94, 150, 20, juce::Justification::left);
    g.drawText ("TARGET FREQ", 240, 94, 150, 20, juce::Justification::left);
    g.drawText ("CORRECTION CENTS", 440, 94, 150, 20, juce::Justification::left);

    g.setFont (juce::Font ("JetBrains Mono", 20.0f, juce::Font::bold));
    g.setColour (isVoiced ? juce::Colour (0xff38bdf8) : juce::Colour (0xff475569));
    g.drawText (isVoiced ? juce::String (detectedPitch, 1) + " Hz" : "-- Hz", 44, 118, 150, 32, juce::Justification::left);

    g.setColour (isVoiced ? juce::Colour (0xff10b981) : juce::Colour (0xff475569));
    g.drawText (isVoiced ? juce::String (targetPitch, 1) + " Hz" : "-- Hz", 240, 118, 150, 32, juce::Justification::left);

    g.setColour (std::abs(correction) < 5.0f ? juce::Colour (0xff10b981) : juce::Colour (0xfff59e0b));
    g.drawText (isVoiced ? ((correction > 0 ? "+" : "") + juce::String (correction, 1) + " c") : "0.0 c", 440, 118, 150, 32, juce::Justification::left);
}

void UndertuneAudioProcessorEditor::resized()
{
    // Key & Scale top right controls
    keyComboBox.setBounds (getWidth() - 310, 18, 90, 28);
    scaleComboBox.setBounds (getWidth() - 210, 18, 110, 28);
    bypassButton.setBounds (getWidth() - 90, 18, 70, 28);

    // Rotary Knobs in Bottom Half
    int knobY = 200;
    int knobSize = 130;
    int gap = (getWidth() - (3 * knobSize)) / 4;

    retuneSpeedSlider.setBounds (gap, knobY, knobSize, knobSize);
    retuneSpeedLabel.setBounds (gap, knobY + knobSize + 4, knobSize, 20);

    formantSlider.setBounds (gap * 2 + knobSize, knobY, knobSize, knobSize);
    formantLabel.setBounds (gap * 2 + knobSize, knobY + knobSize + 4, knobSize, 20);

    humanizeSlider.setBounds (gap * 3 + knobSize * 2, knobY, knobSize, knobSize);
    humanizeLabel.setBounds (gap * 3 + knobSize * 2, knobY + knobSize + 4, knobSize, 20);
}

void UndertuneAudioProcessorEditor::timerCallback()
{
    repaint (24, 80, getWidth() - 48, 86);
}
`;

export const CMAKELISTS_TXT = `cmake_minimum_required(VERSION 3.22)

# ==============================================================================
# Undertune - VST3 Pitch Correction Audio Plugin
# CMake configuration with automatic JUCE 7 FetchContent download
# Target: Windows x64 VST3 (FL Studio compatible)
# ==============================================================================

project(Undertune VERSION 1.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Enable FetchContent to download JUCE 7 automatically in CI/CD without local install
include(FetchContent)

message(STATUS "Downloading official JUCE 7 from GitHub...")
FetchContent_Declare(
    JUCE
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG        7.0.12
    GIT_SHALLOW    TRUE
)

FetchContent_MakeAvailable(JUCE)

# Define the audio plugin target
juce_add_plugin(Undertune
    COMPANY_NAME "Undertune Audio"
    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT FALSE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS FALSE
    COPY_PLUGIN_AFTER_BUILD FALSE
    PLUGIN_MANUFACTURER_CODE Unde
    PLUGIN_CODE Utun
    FORMATS VST3
    PRODUCT_NAME "Undertune"
)

# Source files
target_sources(Undertune
    PRIVATE
        Source/PluginProcessor.cpp
        Source/PluginProcessor.h
        Source/PluginEditor.cpp
        Source/PluginEditor.h
)

# Compile options & definitions
target_compile_definitions(Undertune
    PUBLIC
        JUCE_WEB_BROWSER=0
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0
)

# Link JUCE DSP and Audio modules
target_link_libraries(Undertune
    PRIVATE
        juce::juce_audio_utils
        juce::juce_dsp
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)
`;

export const BUILD_YML = `name: Build Undertune VST3

on:
  push:
    branches: [ "main", "master" ]
  pull_request:
    branches: [ "main", "master" ]
  workflow_dispatch: # Permite ejecutar la compilación manualmente con 1 clic en GitHub

jobs:
  build-windows-vst3:
    name: Build VST3 (Windows x64)
    runs-on: windows-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup CMake and MSVC
        uses: lukka/get-cmake@latest

      - name: Configure CMake
        run: >
          cmake -B build
          -G "Visual Studio 17 2022"
          -A x64
          -DCMAKE_BUILD_TYPE=Release

      - name: Build Undertune VST3
        run: >
          cmake --build build
          --config Release
          --target Undertune_VST3
          --parallel

      - name: Archive VST3 Plugin
        shell: pwsh
        run: |
          # Buscar la carpeta generada del VST3
          $vst3Path = Get-ChildItem -Path build -Recurse -Directory -Filter "Undertune.vst3" | Select-Object -First 1 -ExpandProperty FullName
          Write-Host "VST3 encontrado en: $vst3Path"
          
          # Crear directorio de entrega y comprimir
          New-Item -ItemType Directory -Force -Path dist
          Compress-Archive -Path $vst3Path -DestinationPath "dist/Undertune-VST3-Windows-x64.zip" -Force
          Write-Host "Archivo zip creado en dist/Undertune-VST3-Windows-x64.zip"

      - name: Upload VST3 Artifact
        uses: actions/upload-artifact@v4
        with:
          name: Undertune-VST3-Windows-x64
          path: dist/Undertune-VST3-Windows-x64.zip
          retention-days: 90
`;

export const GITIGNORE_CONTENT = `# CMake build directories
build/
bin/
dist/
*.dir/

# Visual Studio / MSVC artifacts
.vs/
*.sln
*.vcxproj*
*.user
*.suo

# Operating System
.DS_Store
Thumbs.db
`;

export const README_MD = `# Undertune - Vocal Pitch Corrector (VST3)

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
3. El flujo \`build.yml\` compilará el plugin en los servidores de GitHub en la nube.
4. Descarga el archivo generado **Undertune-VST3-Windows-x64.zip** en la sección *Artifacts*.
5. Extrae \`Undertune.vst3\` en:
   \`C:\\Program Files\\Common Files\\VST3\\\`
6. En FL Studio abre **Options > Manage Plugins > Find more plugins** ¡y listo!
`;

export const ALL_SOURCE_FILES: SourceFile[] = [
  {
    id: "processor_h",
    filename: "PluginProcessor.h",
    path: "Source/PluginProcessor.h",
    language: "cpp",
    description: "Declaración de la clase del procesador DSP, buffers de análisis y parámetros APVTS.",
    content: PLUGIN_PROCESSOR_H
  },
  {
    id: "processor_cpp",
    filename: "PluginProcessor.cpp",
    path: "Source/PluginProcessor.cpp",
    language: "cpp",
    description: "Implementación del algoritmo de autocorrelación, cuantización por escala, retune smoothing y pitch shifter.",
    content: PLUGIN_PROCESSOR_CPP
  },
  {
    id: "cmakelists",
    filename: "CMakeLists.txt",
    path: "CMakeLists.txt",
    language: "cmake",
    description: "Configuración de CMake 3.22+ con descarga automática de JUCE 7 vía FetchContent.",
    content: CMAKELISTS_TXT
  },
  {
    id: "build_yml",
    filename: "build.yml",
    path: ".github/workflows/build.yml",
    language: "yaml",
    description: "Flujo CI/CD de GitHub Actions en Windows que compila el VST3 y genera el Artifact ZIP descargable.",
    content: BUILD_YML
  },
  {
    id: "editor_h",
    filename: "PluginEditor.h",
    path: "Source/PluginEditor.h",
    language: "cpp",
    description: "Interfaz gráfica con perillas rotatorias, selector de tonalidad y visor de telemetría de tono.",
    content: PLUGIN_EDITOR_H
  },
  {
    id: "editor_cpp",
    filename: "PluginEditor.cpp",
    path: "Source/PluginEditor.cpp",
    language: "cpp",
    description: "Implementación visual moderna en JUCE con renderizado de frecuencia en tiempo real.",
    content: PLUGIN_EDITOR_CPP
  },
  {
    id: "gitignore",
    filename: ".gitignore",
    path: ".gitignore",
    language: "gitignore",
    description: "Ignora carpetas de compilación build/ y temporales de CMake.",
    content: GITIGNORE_CONTENT
  },
  {
    id: "readme",
    filename: "README.md",
    path: "README.md",
    language: "markdown",
    description: "Documentación rápida y pasos de instalación para FL Studio.",
    content: README_MD
  }
];
