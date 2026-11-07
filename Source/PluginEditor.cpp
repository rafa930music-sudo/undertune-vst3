/*
  ==============================================================================
    Undertune Cinematic Ultra - Professional Vocal Tuning Workstation
    PluginEditor.cpp
    Framework: JUCE 7 | Target DAW: FL Studio (Windows x64)
  ==============================================================================
*/

#include "PluginProcessor.h"
#include "PluginEditor.h"

UndertuneAudioProcessorEditor::UndertuneAudioProcessorEditor (UndertuneAudioProcessor& p)
    : AudioProcessorEditor (&p), audioProcessor (p)
{
    setSize (880, 600);
    pitchHistory.resize (120, 0.0f);
    targetHistory.resize (120, 0.0f);

    auto setupRotary = [this](juce::Slider& slider, juce::Label& label, const juce::String& text, juce::Colour color)
    {
        slider.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
        slider.setTextBoxStyle (juce::Slider::TextBoxBelow, false, 64, 18);
        slider.setColour (juce::Slider::rotarySliderFillColourId, color);
        slider.setColour (juce::Slider::rotarySliderOutlineColourId, juce::Colour (0xff1e293b));
        slider.setColour (juce::Slider::thumbColourId, juce::Colours::white);
        slider.setColour (juce::Slider::textBoxOutlineColourId, juce::Colours::transparentBlack);
        slider.setColour (juce::Slider::textBoxTextColourId, juce::Colour (0xffe2e8f0));
        addAndMakeVisible (slider);

        label.setText (text, juce::dontSendNotification);
        label.setJustificationType (juce::Justification::centred);
        label.setFont (juce::Font ("JetBrains Mono", 10.5f, juce::Font::bold));
        label.setColour (juce::Label::textColourId, juce::Colour (0xff94a3b8));
        addAndMakeVisible (label);
    };

    setupRotary (retuneSpeedSlider, retuneLabel,   "RETUNE SPEED", juce::Colour (0xff06b6d4)); // Cyan
    setupRotary (formantSlider,     formantLabel,  "FORMANT",      juce::Colour (0xffa855f7)); // Purple
    setupRotary (throatSlider,      throatLabel,   "THROAT L.",    juce::Colour (0xffc084fc)); // Light Purple
    setupRotary (humanizeSlider,    humanizeLabel, "HUMANIZE",     juce::Colour (0xff10b981)); // Emerald
    setupRotary (vibratoSlider,     vibratoLabel,  "NAT. VIBRATO", juce::Colour (0xff38bdf8)); // Sky Blue
    setupRotary (warmthSlider,      warmthLabel,   "TUBE WARMTH",  juce::Colour (0xfff97316)); // Amber/Orange
    setupRotary (airSlider,         airLabel,      "AIR SHEEN",    juce::Colour (0xff38bdf8)); // Cyan Air
    setupRotary (mixSlider,         mixLabel,      "DRY/WET MIX",  juce::Colour (0xff14b8a6)); // Teal
    setupRotary (outputGainSlider,  gainLabel,     "OUT GAIN",     juce::Colour (0xfff43f5e)); // Rose

    // Preset selector
    const auto& presets = UndertuneAudioProcessor::getPresetList();
    for (size_t i = 0; i < presets.size(); ++i)
        presetComboBox.addItem (presets[i].name, (int)(i + 1));
    presetComboBox.setSelectedId (audioProcessor.getCurrentProgram() + 1, juce::dontSendNotification);
    presetComboBox.onChange = [this]() {
        int idx = presetComboBox.getSelectedId() - 1;
        if (idx >= 0) audioProcessor.loadPreset (idx);
    };
    presetComboBox.setColour (juce::ComboBox::backgroundColourId, juce::Colour (0xff111827));
    presetComboBox.setColour (juce::ComboBox::textColourId, juce::Colour (0xff38bdf8));
    presetComboBox.setColour (juce::ComboBox::outlineColourId, juce::Colour (0xff0284c7));
    addAndMakeVisible (presetComboBox);

    presetLabel.setText ("CINEMATIC PRESET", juce::dontSendNotification);
    presetLabel.setFont (juce::Font (11.0f, juce::Font::bold));
    presetLabel.setColour (juce::Label::textColourId, juce::Colour (0xff38bdf8));
    addAndMakeVisible (presetLabel);

    // Key ComboBox
    juce::StringArray keys = { "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" };
    for (int i = 0; i < keys.size(); ++i) keyComboBox.addItem (keys[i], i + 1);
    keyComboBox.setColour (juce::ComboBox::backgroundColourId, juce::Colour (0xff1e293b));
    keyComboBox.setColour (juce::ComboBox::textColourId, juce::Colour (0xfff8fafc));
    keyComboBox.setColour (juce::ComboBox::outlineColourId, juce::Colour (0xff334155));
    addAndMakeVisible (keyComboBox);
    keyLabel.setText ("KEY", juce::dontSendNotification);
    keyLabel.setColour (juce::Label::textColourId, juce::Colour (0xff94a3b8));
    addAndMakeVisible (keyLabel);

    // Scale ComboBox
    juce::StringArray scales = { "Chromatic", "Major", "Natural Minor", "Harmonic Minor", "Dorian", "Pentatonic", "Blues" };
    for (int i = 0; i < scales.size(); ++i) scaleComboBox.addItem (scales[i], i + 1);
    scaleComboBox.setColour (juce::ComboBox::backgroundColourId, juce::Colour (0xff1e293b));
    scaleComboBox.setColour (juce::ComboBox::textColourId, juce::Colour (0xfff8fafc));
    scaleComboBox.setColour (juce::ComboBox::outlineColourId, juce::Colour (0xff334155));
    addAndMakeVisible (scaleComboBox);
    scaleLabel.setText ("SCALE", juce::dontSendNotification);
    scaleLabel.setColour (juce::Label::textColourId, juce::Colour (0xff94a3b8));
    addAndMakeVisible (scaleLabel);

    // Vocal Range ComboBox
    juce::StringArray ranges = { "Low (Bass / Baritone)", "Mid (Tenor / Alto)", "High (Soprano)" };
    for (int i = 0; i < ranges.size(); ++i) rangeComboBox.addItem (ranges[i], i + 1);
    rangeComboBox.setColour (juce::ComboBox::backgroundColourId, juce::Colour (0xff1e293b));
    rangeComboBox.setColour (juce::ComboBox::textColourId, juce::Colour (0xfff8fafc));
    rangeComboBox.setColour (juce::ComboBox::outlineColourId, juce::Colour (0xff334155));
    addAndMakeVisible (rangeComboBox);
    rangeLabel.setText ("RANGE", juce::dontSendNotification);
    rangeLabel.setColour (juce::Label::textColourId, juce::Colour (0xff94a3b8));
    addAndMakeVisible (rangeLabel);

    // Bypass
    bypassButton.setButtonText ("BYPASS");
    bypassButton.setColour (juce::ToggleButton::textColourId, juce::Colour (0xfff43f5e));
    addAndMakeVisible (bypassButton);

    // APVTS Attachments
    retuneAttachment   = std::make_unique<SliderAttachment> (audioProcessor.apvts, "retuneSpeed", retuneSpeedSlider);
    formantAttachment  = std::make_unique<SliderAttachment> (audioProcessor.apvts, "formant", formantSlider);
    throatAttachment   = std::make_unique<SliderAttachment> (audioProcessor.apvts, "throat", throatSlider);
    humanizeAttachment = std::make_unique<SliderAttachment> (audioProcessor.apvts, "humanize", humanizeSlider);
    vibratoAttachment  = std::make_unique<SliderAttachment> (audioProcessor.apvts, "naturalVibrato", vibratoSlider);
    warmthAttachment   = std::make_unique<SliderAttachment> (audioProcessor.apvts, "warmth", warmthSlider);
    airAttachment      = std::make_unique<SliderAttachment> (audioProcessor.apvts, "air", airSlider);
    mixAttachment      = std::make_unique<SliderAttachment> (audioProcessor.apvts, "mix", mixSlider);
    gainAttachment     = std::make_unique<SliderAttachment> (audioProcessor.apvts, "outputGain", outputGainSlider);

    keyAttachment   = std::make_unique<ComboBoxAttachment> (audioProcessor.apvts, "key", keyComboBox);
    scaleAttachment = std::make_unique<ComboBoxAttachment> (audioProcessor.apvts, "scale", scaleComboBox);
    rangeAttachment = std::make_unique<ComboBoxAttachment> (audioProcessor.apvts, "vocalRange", rangeComboBox);
    bypassAttachment = std::make_unique<ButtonAttachment> (audioProcessor.apvts, "bypass", bypassButton);

    startTimerHz (30);
}

UndertuneAudioProcessorEditor::~UndertuneAudioProcessorEditor() { stopTimer(); }

void UndertuneAudioProcessorEditor::paint (juce::Graphics& g)
{
    // Background Dark Obsidian
    g.fillAll (juce::Colour (0xff070a10));

    // Top Header Banner
    g.setColour (juce::Colour (0xff0d131f));
    g.fillRect (0, 0, getWidth(), 64);
    g.setColour (juce::Colour (0xff1e293b));
    g.drawHorizontalLine (64, 0.0f, (float)getWidth());

    // Logo & Branding
    g.setFont (juce::Font ("Plus Jakarta Sans", 22.0f, juce::Font::bold));
    g.setColour (juce::Colour (0xfff8fafc));
    g.drawText ("UNDERTUNE", 24, 14, 180, 26, juce::Justification::left);

    g.setFont (juce::Font ("JetBrains Mono", 11.0f, juce::Font::bold));
    g.setColour (juce::Colour (0xff06b6d4));
    g.drawText ("CINEMATIC ULTRA", 175, 18, 160, 20, juce::Justification::left);

    // Center HUD Scope Box
    juce::Rectangle<int> hudBounds (24, 76, getWidth() - 48, 170);
    g.setColour (juce::Colour (0xff0a0f1d));
    g.fillRoundedRectangle (hudBounds.toFloat(), 10.0f);
    g.setColour (juce::Colour (0xff1e293b));
    g.drawRoundedRectangle (hudBounds.toFloat(), 10.0f, 1.0f);

    float detPitch = audioProcessor.getDetectedPitchHz();
    float tgtPitch = audioProcessor.getTargetPitchHz();
    float cents    = audioProcessor.getCorrectionCents();
    bool  voiced   = audioProcessor.getIsVoiced();
    float inDb     = audioProcessor.getInputLevelDb();
    float outDb    = audioProcessor.getOutputLevelDb();

    // Readout Titles
    g.setFont (juce::Font ("JetBrains Mono", 10.5f, juce::Font::plain));
    g.setColour (juce::Colour (0xff64748b));
    g.drawText ("RAW DETECTED", 44, 90, 140, 18, juce::Justification::left);
    g.drawText ("TUNED TARGET", 220, 90, 150, 18, juce::Justification::left);
    g.drawText ("DEVIATION CENTS", 400, 90, 150, 18, juce::Justification::left);
    g.drawText ("I/O LEVELS", 620, 90, 150, 18, juce::Justification::left);

    g.setFont (juce::Font ("JetBrains Mono", 24.0f, juce::Font::bold));
    g.setColour (voiced ? juce::Colour (0xff38bdf8) : juce::Colour (0xff475569));
    g.drawText (voiced ? juce::String (detPitch, 1) + " Hz" : "-- Hz", 44, 110, 160, 30, juce::Justification::left);

    g.setColour (voiced ? juce::Colour (0xff10b981) : juce::Colour (0xff475569));
    g.drawText (voiced ? juce::String (tgtPitch, 1) + " Hz" : "-- Hz", 220, 110, 160, 30, juce::Justification::left);

    g.setColour (std::abs (cents) < 5.0f ? juce::Colour (0xff10b981) : juce::Colour (0xfff59e0b));
    g.drawText (voiced ? ((cents > 0 ? "+" : "") + juce::String (cents, 1) + " c") : "0.0 c", 400, 110, 160, 30, juce::Justification::left);

    g.setFont (juce::Font ("JetBrains Mono", 12.0f, juce::Font::plain));
    g.setColour (juce::Colour (0xff94a3b8));
    g.drawText ("IN:  " + juce::String (inDb, 1) + " dB", 620, 110, 140, 16, juce::Justification::left);
    g.drawText ("OUT: " + juce::String (outDb, 1) + " dB", 620, 126, 140, 16, juce::Justification::left);

    // Cents Meter
    int barX = 44;
    int barY = 150;
    int barW = 520;
    int barH = 8;
    g.setColour (juce::Colour (0xff0f172a));
    g.fillRoundedRectangle ((float)barX, (float)barY, (float)barW, (float)barH, 4.0f);
    g.setColour (juce::Colour (0xff334155));
    g.drawVerticalLine (barX + barW / 2, (float)barY - 2, (float)(barY + barH + 2));

    if (voiced)
    {
        float norm = juce::jlimit (-50.0f, 50.0f, cents);
        int needleX = barX + (int)((norm + 50.0f) / 100.0f * barW);
        g.setColour (std::abs(cents) < 5.0f ? juce::Colour (0xff10b981) : juce::Colour (0xff06b6d4));
        g.fillRoundedRectangle ((float)needleX - 4.0f, (float)barY - 2, 8.0f, (float)barH + 4.0f, 3.0f);
    }

    // Real-time Pitch Canvas Stream
    int waveX = 44;
    int waveY = 172;
    int waveW = getWidth() - 88;
    int waveH = 58;
    g.setColour (juce::Colour (0xff070b13));
    g.fillRect (waveX, waveY, waveW, waveH);
    g.setColour (juce::Colour (0xff1e293b));
    g.drawRect (waveX, waveY, waveW, waveH);

    juce::Path pDetected, pTarget;
    float step = (float)waveW / (float)(pitchHistory.size() - 1);
    for (size_t i = 0; i < pitchHistory.size(); ++i)
    {
        float x = (float)waveX + (float)i * step;
        float yDet = (float)(waveY + waveH) - juce::jlimit (2.0f, (float)waveH - 2.0f, (pitchHistory[i] - 100.0f) / 450.0f * (float)waveH);
        float yTgt = (float)(waveY + waveH) - juce::jlimit (2.0f, (float)waveH - 2.0f, (targetHistory[i] - 100.0f) / 450.0f * (float)waveH);

        if (i == 0) { pDetected.startNewSubPath (x, yDet); pTarget.startNewSubPath (x, yTgt); }
        else { pDetected.lineTo (x, yDet); pTarget.lineTo (x, yTgt); }
    }
    g.setColour (juce::Colour (0xff06b6d4).withAlpha (0.7f));
    g.strokePath (pDetected, juce::PathStrokeType (1.5f));
    g.setColour (juce::Colour (0xff10b981).withAlpha (0.95f));
    g.strokePath (pTarget, juce::PathStrokeType (2.0f));
}

void UndertuneAudioProcessorEditor::resized()
{
    presetComboBox.setBounds (getWidth() - 480, 18, 200, 28);
    keyComboBox.setBounds    (getWidth() - 270, 18, 60, 28);
    scaleComboBox.setBounds  (getWidth() - 200, 18, 115, 28);
    bypassButton.setBounds   (getWidth() - 75,  18, 65, 28);

    // 9 Precision Knobs layout across 2 rows
    int row1Y = 270;
    int knobSize = 90;
    int gap1 = (getWidth() - 48 - (5 * knobSize)) / 4;

    retuneSpeedSlider.setBounds (24 + 0 * (knobSize + gap1), row1Y, knobSize, knobSize);
    retuneLabel.setBounds       (24 + 0 * (knobSize + gap1) - 5, row1Y + knobSize + 2, knobSize + 10, 18);

    formantSlider.setBounds     (24 + 1 * (knobSize + gap1), row1Y, knobSize, knobSize);
    formantLabel.setBounds     (24 + 1 * (knobSize + gap1) - 5, row1Y + knobSize + 2, knobSize + 10, 18);

    throatSlider.setBounds      (24 + 2 * (knobSize + gap1), row1Y, knobSize, knobSize);
    throatLabel.setBounds      (24 + 2 * (knobSize + gap1) - 5, row1Y + knobSize + 2, knobSize + 10, 18);

    humanizeSlider.setBounds    (24 + 3 * (knobSize + gap1), row1Y, knobSize, knobSize);
    humanizeLabel.setBounds    (24 + 3 * (knobSize + gap1) - 5, row1Y + knobSize + 2, knobSize + 10, 18);

    vibratoSlider.setBounds     (24 + 4 * (knobSize + gap1), row1Y, knobSize, knobSize);
    vibratoLabel.setBounds     (24 + 4 * (knobSize + gap1) - 5, row1Y + knobSize + 2, knobSize + 10, 18);

    int row2Y = 415;
    int gap2 = (getWidth() - 48 - (4 * knobSize)) / 3;

    warmthSlider.setBounds     (24 + 0 * (knobSize + gap2), row2Y, knobSize, knobSize);
    warmthLabel.setBounds      (24 + 0 * (knobSize + gap2) - 5, row2Y + knobSize + 2, knobSize + 10, 18);

    airSlider.setBounds        (24 + 1 * (knobSize + gap2), row2Y, knobSize, knobSize);
    airLabel.setBounds         (24 + 1 * (knobSize + gap2) - 5, row2Y + knobSize + 2, knobSize + 10, 18);

    mixSlider.setBounds        (24 + 2 * (knobSize + gap2), row2Y, knobSize, knobSize);
    mixLabel.setBounds         (24 + 2 * (knobSize + gap2) - 5, row2Y + knobSize + 2, knobSize + 10, 18);

    outputGainSlider.setBounds (24 + 3 * (knobSize + gap2), row2Y, knobSize, knobSize);
    gainLabel.setBounds        (24 + 3 * (knobSize + gap2) - 5, row2Y + knobSize + 2, knobSize + 10, 18);

    rangeComboBox.setBounds (24, getHeight() - 40, 200, 26);
    rangeLabel.setBounds    (230, getHeight() - 40, 100, 26);
}

void UndertuneAudioProcessorEditor::timerCallback()
{
    float d = audioProcessor.getDetectedPitchHz();
    float t = audioProcessor.getTargetPitchHz();

    pitchHistory.erase (pitchHistory.begin());
    pitchHistory.push_back (d > 0.0f ? d : 220.0f);

    targetHistory.erase (targetHistory.begin());
    targetHistory.push_back (t > 0.0f ? t : 220.0f);

    repaint();
}
