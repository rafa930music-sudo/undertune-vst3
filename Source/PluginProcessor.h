/*
  ==============================================================================
    Undertune Cinematic Ultra - Professional Vocal Tuning Workstation
    PluginProcessor.h
    Framework: JUCE 7 | Target DAW: FL Studio (Windows x64)
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
    UndertuneAudioProcessor();
    ~UndertuneAudioProcessor() override;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override;

    const juce::String getName() const override;
    bool acceptsMidi() const override;
    bool producesMidi() const override;
    bool isMidiEffect() const override;
    double getTailLengthSeconds() const override;

    // Presets Management
    int getNumPrograms() override;
    int getCurrentProgram() override;
    void setCurrentProgram (int index) override;
    const juce::String getProgramName (int index) override;
    void changeProgramName (int index, const juce::String& newName) override;
    void loadPreset (int index);

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    juce::AudioProcessorValueTreeState apvts;
    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    // High-Resolution Visual Telemetry
    float getDetectedPitchHz() const noexcept    { return currentDetectedPitch.load(); }
    float getTargetPitchHz() const noexcept      { return currentTargetPitch.load(); }
    float getCorrectionCents() const noexcept    { return currentCorrectionCents.load(); }
    float getInputLevelDb() const noexcept       { return inputLevelDb.load(); }
    float getOutputLevelDb() const noexcept      { return outputLevelDb.load(); }
    float getSaturationDriveMeter() const noexcept { return saturationMeter.load(); }
    bool  getIsVoiced() const noexcept           { return isVoiced.load(); }

    struct PresetInfo {
        const char* name;
        float speed;
        float formant;
        float throat;
        float humanize;
        float vibrato;
        float warmth;
        float air;
        float mix;
        int key;
        int scale;
    };
    static const std::vector<PresetInfo>& getPresetList();

private:
    float detectPitchAutocorrelation (const float* buffer, int numSamples, int rangeMode, float sensitivity);
    float quantizePitchToScale (float detectedHz, int rootKey, int scaleType, float humanizeAmount, float vibratoPreserve);

    static constexpr int analysisWindowSize = 2048;
    std::vector<float> analysisRingBuffer;
    int analysisWritePos = 0;

    std::vector<float> delayBuffer;
    int delayWritePos = 0;
    static constexpr int delayBufferSize = 8192;
    double grainPhase1 = 0.0;
    double grainPhase2 = 0.5;
    static constexpr double grainPeriodSamples = 1024.0;

    float smoothedPitchShiftRatio = 1.0f;
    double currentSampleRate = 44100.0;
    int currentProgramIndex = 0;

    // Formant EQ & Vocal Air Filters
    juce::dsp::IIR::Filter<float> formantFilterL1, formantFilterL2;
    juce::dsp::IIR::Filter<float> formantFilterR1, formantFilterR2;
    juce::dsp::IIR::Filter<float> airFilterL, airFilterR;

    // Telemetry atomics
    std::atomic<float> currentDetectedPitch { 0.0f };
    std::atomic<float> currentTargetPitch   { 0.0f };
    std::atomic<float> currentCorrectionCents { 0.0f };
    std::atomic<float> inputLevelDb         { -60.0f };
    std::atomic<float> outputLevelDb        { -60.0f };
    std::atomic<float> saturationMeter      { 0.0f };
    std::atomic<bool>  isVoiced             { false };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (UndertuneAudioProcessor)
};
