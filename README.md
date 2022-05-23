# WOWCube SDK VisualStudio Code Extension README

This extension is designed for WOWCube cubeapp application developers. It simplifies WOWCube device content management and makes overall process of development of the apps more enjoyable.

## Features

* New Cubeapp application wizard
* Cubeapp application compiler and builder
* Automatic install and run on selected WOWCube device
* Automatic install and run on WOWCube Emulator 
* Paired WOWCube device detection
* WOWCube device basic information display
* Installed cubeapp applications management 

## Requirements

 WOWCube Development Kit version 2.5.0 alpha5 or later must be installed on the computer.

## Extension Settings

This extension contributes the next settings:

* `wowsdk.conf.wizard`: a folder that has been used for new project generation last time
* `wowsdk.conf.wowsdkpath`: a path to installed WOWCube SDK
* `wowsdk.conf.wowsdkversion"`: a version of WOWCube SDK that will be used
* `wwowsdk.conf.currentdevice`: selected WOWCube device
* `wowsdk.conf.detecteddevices`: a list of paired WOWCube devices


## Third-party Components

This extension uses syntax colorization for both the output/debug/extensions pane and *.log files.

**Note: If you are using other extensions that colorize the output panel, it could override and disable colorization!**

https://code.visualstudio.com/docs/customization/colorizer


## Known Issues

Although the extension can be used on Linux, it provides limited functionality and DOES NOT support any bluetooth-related features. 

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

### 1.2.0
* Introduced new "Run Cubeapp" feature

### 1.2.2
* Fix for 'No task to run on cube' issue
* Bluetooth loader response parsing is slightly improved

### 1.3.0
* Added WOWCube SDK version selection support
* Improved support for custom pathes defined in wowcube-build file

### 1.4.0
* Added support for versioned examples and documentation 
* Added support for new SDK folders structure
* Minor bugfixes and improvements

### 1.5.0
* WOWCube Development Kit support
* Minor bugfixes and improvements

### 1.5.2
* Improved document scrolling

### 1.5.3
* Bugfixes

### 1.6.0
* New WOWCube Development Kit bluetooth bridging app support

### 1.7.0
* Added Ad-Hoc cubeapp file sharing 

### 1.8.0
* Improved fetching for device general information 

### 1.9.0
* Improved management and handling of versions of WOWCubeSDK 

### 1.10.0
* Added visual editor for cubeapp project file 

### 1.11.0
* Improved new project templates support for different versions of WOWCubeSDK 

### 1.12.0
* Bugfix 