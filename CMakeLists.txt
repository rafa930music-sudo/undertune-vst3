cmake_minimum_required(VERSION 3.22)

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
