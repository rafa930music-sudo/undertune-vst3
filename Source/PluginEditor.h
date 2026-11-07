/*
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
