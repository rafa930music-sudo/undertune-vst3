/*
  ==============================================================================
    Undertune Cinematic Ultra - Professional Vocal Tuning Workstation
    PluginEditor.h
    Framework: JUCE 7 | Target DAW: FL Studio (Windows x64)
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
    juce::Slider throatSlider;
    juce::Slider humanizeSlider;
    juce::Slider vibratoSlider;
    juce::Slider warmthSlider;
    juce::Slider airSlider;
    juce::Slider mixSlider;
    juce::Slider outputGainSlider;

    juce::ComboBox presetComboBox;
    juce::ComboBox keyComboBox;
    juce::ComboBox scaleComboBox;
    juce::ComboBox rangeComboBox;
    juce::ToggleButton bypassButton;

    // Labels
    juce::Label retuneLabel, formantLabel, throatLabel, humanizeLabel;
    juce::Label vibratoLabel, warmthLabel, airLabel, mixLabel, gainLabel;
    juce::Label presetLabel, keyLabel, scaleLabel, rangeLabel;

    using SliderAttachment   = juce::AudioProcessorValueTreeState::SliderAttachment;
    using ComboBoxAttachment = juce::AudioProcessorValueTreeState::ComboBoxAttachment;
    using ButtonAttachment   = juce::AudioProcessorValueTreeState::ButtonAttachment;

    std::unique_ptr<SliderAttachment> retuneAttachment;
    std::unique_ptr<SliderAttachment> formantAttachment;
    std::unique_ptr<SliderAttachment> throatAttachment;
    std::unique_ptr<SliderAttachment> humanizeAttachment;
    std::unique_ptr<SliderAttachment> vibratoAttachment;
    std::unique_ptr<SliderAttachment> warmthAttachment;
    std::unique_ptr<SliderAttachment> airAttachment;
    std::unique_ptr<SliderAttachment> mixAttachment;
    std::unique_ptr<SliderAttachment> gainAttachment;

    std::unique_ptr<ComboBoxAttachment> keyAttachment;
    std::unique_ptr<ComboBoxAttachment> scaleAttachment;
    std::unique_ptr<ComboBoxAttachment> rangeAttachment;
    std::unique_ptr<ButtonAttachment>   bypassAttachment;

    std::vector<float> pitchHistory;
    std::vector<float> targetHistory;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (UndertuneAudioProcessorEditor)
};
