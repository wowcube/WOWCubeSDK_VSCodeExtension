# WOWCube SDK VisualStudio Code Extension README

This extension is designed for WOWCube cubelet application developers. It simplifies WOWCube device content management and makes overall process of development of the apps more enjoyable.

## Features

* New Cubelet application wizard
* Cubelet application compiler and builder
* Automatic install and run on selected WOWCube device
* Automatic install and run on WOWCube Emulator 
* Paired WOWCube device detection
* WOWCube device basic information display
* Installed cubelet applications management 

## Requirements

 WOWCube SDK version 2.3.4-alpha5 or later must be installed on the computer.

## Extension Settings

This extension contributes the next settings:

* `wowsdk.conf.wizard`: a folder that has been used for new project generation last time
* `wowsdk.conf.wowsdkpath`: a path to installed WOWCube SDK
* `wwowsdk.conf.currentdevice`: selected WOWCube device
* `wowsdk.conf.detecteddevices`: a list of paired WOWCube devices


## Third-party Components

This extension uses syntax colorization for both the output/debug/extensions pane and *.log files.

**Note: If you are using other extensions that colorize the output panel, it could override and disable colorization!**

https://code.visualstudio.com/docs/customization/colorizer


## Known Issues

This version of extension is NOT FOR PUBLIC release and must only be used for a purpose of internal testing.

## Release Notes

### 0.9.0

* Release candidate for internal testing

### 0.9.1

* Second release candidate for internal testing
* Improved syncronization of views
* Minor UI changed

### 0.9.2
### 0.9.3
### 0.9.4
* Minor UI changed

### 0.9.5
* Added output and log colorization
* Fixed virtual terminal - related bug

### 0.9.7
* Changes to support WOWCube SDK 2.3.4-alpha5
* Fixed filenames inconsistency for case-sensitive file systems
* Fixed backslash character support in path names
* Improved handling of new project creation failure
* Minor UI improvements and bugfixes
* Minor changes for better compatibility with Linux

### 0.9.8
* Fixed for WOWCube emulator executable path on Linux

### 0.9.9
* Fixed for inclusion of local .inc files on Windows

### 1.0.0
* Production build

### 1.1.0
* Introduced new "Upload CUB File to Device" feature
* Added WOWCube SDK path validation
* Minor UI tweaks and fixes