/*
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
