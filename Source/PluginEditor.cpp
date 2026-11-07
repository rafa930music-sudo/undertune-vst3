/*
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
