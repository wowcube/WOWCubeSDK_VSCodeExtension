# WOWCube SDK VisualStudio Code Extension README

This extension is designed for WOWCube cubeapp application developers. It simplifies WOWCube device content management and makes overall process of development of the apps more enjoyable.

## Pre-requisites

 WOWCube Development Kit version 1.0.8 or later must be installed on the computer and can be downloaded from https://wowcube.com/devkit

## Features

* New Cubeapp application wizard
* Cubeapp application compiler and builder
* Automatic install and run on selected WOWCube device
* Automatic install and run on WOWCube Emulator 
* Paired WOWCube device detection
* WOWCube device basic information display
* Installed cubeapp applications management
* Installed cubeapp data management
* Built-in WOWCube Development Kit updater  

## Resource Studio

Use **WOWCube SDK: Open Resource Studio** in the command palette or **Open Resource Studio**
in the Explorer context menu for a project file or folder. The command creates
`wowcubeapp-resources.json` at the selected workspace folder's root if it does not exist.
Opening that JSON file directly uses the Resource Studio custom editor. Use **Edit JSON**
or **Reopen Editor With → Text Editor** to edit the underlying document.

The Workspace layout contains a resource list, visual preview, and property inspector.
Supported resource types are palettes, sprites, and maps:

* Palettes are generated from sprites with `sdk/tools/palette-builder` (`palette-builder.exe`
  on Windows). The tool produces `#RRGGBBAA` colors quantized to RGB565+A5.
  They have editable RGB/RGBA colors and an optional transparent color index.
  They cannot be created as standalone resources.
* Sprites reference source images and shared palettes by stable resource IDs. They have
  an authored-pixel pivot (`null` means center) and an optional collider. The inspector
  provides Full size, Blend, Group, Type and Tags. Number and Frame duration remain hidden
  for static sprites until animation resources are implemented. The inspector and visual
  editor scroll independently and retain their positions across edits. Manage groups,
  types and tags contains creation and deletion; definitions are stored in bundle registries. Deleting
  entries clears affected sprite assignments in one document edit. Entries in use or
  deletions that shift constants require confirmation showing the changed constants.
* Source and indexed previews support zoom up to 128×, Shift + mouse-wheel zoom centered at the
  cursor and click/drag pivot placement.
  Indexed preview assigns source pixels to the nearest generated RGB palette entry,
  then displays that index using the editable palette; it does not modify the source.
  Space + click an image pixel in indexed mode to select its palette entry without moving
  the pivot. Picking respects zoom and scrolling.

When registering a sprite, choose an existing palette, generate a new palette, or select
**RGB565 — no palette**. RGB565 bypasses palette-builder, uses Opaque blend and Plain
encoding by default, and offers optional Floyd–Steinberg dithering. Select Color Key in
Encoding to choose a transparent color using the color picker or #RRGGBB field, with a
threshold from 0 to 255. The RGB565 preview applies the SDK renderer's quantized-channel
comparison: red/blue tolerance is the threshold and green tolerance is twice that.
Plain encoding has no transparency. Switching an existing sprite to RGB565 clears
its palette reference and leaves the palette available for other sprites.

For a new palette, enter its name and color limit (default 256).
The default name is `<resource_name>_palette`, with the resource prefix shortened when
needed to fit the 23-character name limit. Canceling adds nothing.
For later sprites, choose an existing palette or generate a new one. Choosing an existing
palette regenerates it from every assigned sprite, including the new one. Changing a
sprite's source or palette assignment also regenerates its destination palette.
Choose **Generate a new palette…** in an existing sprite's Palette selector to create
and assign `<resource_name>_palette` with a 256-color limit, using just that sprite's source.
If the name already exists, enter a unique name; canceling leaves the assignment unchanged.
Changing a palette's size regenerates it from all assigned source images; individual
colors remain editable without changing the size. Regeneration replaces manual color edits.
The sprite view shows palette swatches and editing controls in two columns below the
preview. Select a swatch and edit its hex RGB/RGBA value or drag the RGBA sliders.
Edits snap to RGB565+A5 precision, matching palette-builder output.
Slider input redraws the indexed sprite immediately; committed edits and completed
rebuilds update the same sprite view. Alpha and Additive previews match source pixels
against the generated RGBA palette and use each edited palette entry's alpha directly;
the optional transparent color index forces that entry transparent.
Generated `mappingColors` are stored separately from the editable `colors`, so manual
color edits preserve pixel indices across redraws and reopening. **Rebuild palette**
regenerates both arrays.

The editor allows any integer palette size from 2 to 256. At most 64 palettes are
allowed, including unused palettes; creating a 65th palette is blocked. The tool may produce fewer
entries when the images have
fewer unique colors. The model stores the requested limit in `colorCount` separately from
the generated `colors`. Both the color limit and mapping colors are required.
Generation uses a temporary input list and output JSON, then removes both. Tool errors,
missing source images, or concurrent document edits leave the bundle unchanged. Configure
the SDK path in Development Kit Settings; the tool is resolved from that SDK's tools folder.

Add any number of project folders in **Source files**. Discovery is recursive and does
not register resources automatically. Removing a source folder or a resource leaves
physical files intact. Missing sources are shown without removing their definitions.
Source paths are relative to the JSON file's containing folder; no fixed asset directory
is required. Source browsing is limited to 5000 entries per refresh, skips symbolic
links, and excludes `.git`, `.vscode`, and `node_modules`. Sprite previews support
PNG files up to 240×240 pixels. Non-fullsize sprites over 120 pixels in either dimension
show a warning because the runtime doubles their size.

All definitions live in one versioned JSON document. Document edits participate in
VS Code save, undo, redo, and recovery. **SAVE CHANGES** and the normal Save command
save the bundle. Palette deletion is blocked until dependent sprites are reassigned.
Palette-mode sprites require a palette; RGB565 sprites do not. Bundles now use
`schemaVersion: 2`; version 1 bundles are not migrated or supported. To start again, move
the old bundle aside and use Open Resource Studio to create a new one.
RGB6666, BUMP, DUDV and REFL are hidden model stubs with no selectable controls or
rendering/export support. BG is available through Show advanced blend options.
Unknown resource types and additional
JSON properties are preserved. Resource compilation uses the SDK's `resource-builder` CLI.

Pivot fields use source pixels and snap to half-pixels. Nine pivot presets include
Reset to center. Click/drag places the pivot; Shift allows placement outside the image.
With the canvas focused, arrow keys nudge 0.5 pixels and Shift + arrows nudge 5 pixels.
The inspector displays the derived runtime pivot separately from preview zoom.
Out-of-image pivots remain editable and show V-009. Numeric pivot fields require
half-pixel values; collider fields require finite, nonnegative numbers and the box must
stay within the source image. Dragging and keyboard resizing stop at its edges. Enabling the collider starts
with a box covering the source image. Drag its four blue square corner handles to adjust
it; fields and the overlay update while dragging, with one document edit on release.
Arrow keys adjust a focused handle by 0.5 pixels (Shift: 5). Disabling the collider
resets x, y, width and height to zero. Resource names must use a-z, 0-9
and underscores, be unique, contain at most 23 characters, and avoid reserved names.
New names are normalized from filenames. Validation also enforces registry capacities
(255 groups/types, 32 tags), palette capacity (64 palettes), shared alpha/opaque
compatibility, frame durations, Number limits and valid PNG headers/dimensions.
Encoding-dependent compilation checks are handled by `resource-builder`.

### Building resources

Saving `wowcubeapp-resources.json`, from Resource Studio or the text editor, compiles
changed resources and refreshes the configured IDs header automatically.
Simulator and device builds await resource compilation before compiling app source code.
The **build resources** task runs the same step independently. It saves pending changes
to `wowcubeapp-resources.json` and invokes `sdk/tools/resource-builder`
(`resource-builder.exe` on Windows), passing the workspace's `wowcubeapp-build.json`.
The tool generates packed assets, `index.bin`, and the IDs header in the configured
app folder. Output and warnings appear in **WOWCube SDK** Output.

Resources compile on the first build and whenever the saved resource JSON content differs
from the last successful resource build. Its SHA-256 hash is stored in VS Code workspace
state and persists across restarts. Unchanged JSON skips resource compilation; changing
only a source image or a file timestamp does not trigger it. Projects without a resource
JSON skip this step. Failed resource generation or JSON edits during generation stop the
app build and do not update the successful hash.

### Maps

Open **Maps** and use **Add resource** to create a cube map. The left library lists
registered sprites. Add the same sprite repeatedly to create independent placements.
Drag sprites on the map, or edit their face-relative X/Y pivot coordinates. Placement
is unrestricted, including gaps and areas outside the net. The outliner is ordered
topmost to bottommost; drag rows or use its stacking buttons to change draw order.
The outliner and selected-placement parameters have separate scrollable panes.
Each placement has a lock toggle: locked sprites remain visible but cannot be selected,
moved, edited, reordered, or deleted until unlocked. Locks are saved as editor view
state for each map and do not change the resource JSON or exported runtime flags.

Net geometry, Background, and Side markers are below the map. Screen size, inner gap,
face-edge gap, frame, and padding are independent. Positions are stored as a face ID
and engine coordinates, so geometry changes preserve device-space placement. At the
default screen size 120, FULLSIZE sprites use 50% of their source dimensions and other
sprites use 100%, including the corresponding pivot offset. Geometry controls also
scale these sizes appropriately when screen size changes. The six stored `~side0`
through `~side5` entries stay at their face centers even when their dots are hidden.
Background images are project-relative files selected through a native file picker.

The map uses the same Fit / 0.5×–128× zoom, Shift-wheel zoom (including horizontal
wheel events), ordinary scrolling, and vertical resize behavior as the sprite preview.
Map view settings and scroll positions are retained independently of sprite previews.
Placement edits keep the map canvas and converted textures alive. Texture loads are
shared through a bounded cache keyed by source revision and rendering settings; drag
redraws are coalesced per animation frame and skip offscreen sprites.
Sprite/palette edits are reflected when the map is redrawn; deleting a referenced
sprite is blocked until its map placements are removed or reassigned.

Map authoring is implemented here. The currently installed `resource-builder` exports
sprites and palettes only and reports maps as skipped; exporting map records requires
a map-capable compiler using the contract in `resource-json-model.txt`.

### Adding resource types

Register a model descriptor in `src/ResourceBundle.ts` using `ResourceTypes.register`.
It provides the type name, label, defaults (`create`), validation, and references
(`getReferences`, used to protect deletions). Then register its webview descriptor in
`media/resourcetypes.js` using `ResourceStudioTypes.register`: section, label, icon,
summary, inspector, preview, change handler, and optional preview mounting/cleanup,
creation fields, and creation validation. The editor derives its sections and type
picker from these registries. Extend `schemas/wowcubeapp-resources.schema.json` to provide
raw JSON completion and validation for the new type.
Set `canCreate:false` on model/UI descriptors for types created indirectly. Resource types
that use shared palettes provide `getPaletteSource(resource)` in the model descriptor to
participate in automatic palette generation.

Run `npm run test:resources` for model, webview handler, and provider tests without
starting an Extension Host. Press F5 to launch the extension for a full UI check.
`src/test/mapBrowser.test.js` additionally exercises the real editor in Chromium when
Playwright is available; set `WOWCUBE_BROWSER` to a Chromium executable if necessary.

## Extension Settings

This extension contributes the next settings:

* `wowsdk.conf.wizard`: a folder that has been used for new project generation last time
* `wowsdk.conf.wowsdkpath`: a path to installed WOWCube SDK
* `wowsdk.conf.wowsdkversion"`: a version of WOWCube SDK that will be used
* `wwowsdk.conf.currentdevice`: selected WOWCube device
* `wowsdk.conf.detecteddevices`: a list of paired WOWCube devices
* `wowsdk.conf.loggingmode`: current mode of retrieval of application logs over bluetooth connection
* `wowsdk.conf.autocheckforupdates`: a flag that indicates whether auto-check for updates is turned on or off


## Third-party Components

This extension uses syntax colorization for both the output/debug/extensions pane and *.log files.

**Note: If you are using other extensions that colorize the output panel, it could override and disable colorization!**

https://code.visualstudio.com/docs/customization/colorizer


## Known Issues

Although the extension can be used on Linux, it provides limited functionality and DOES NOT support any bluetooth-related features. 

## Release Notes

### 2.5.5
* Fixed the inability to use nested folders in С++ project structure

### 2.5.4
* Improved file validation for Ad-Hoc sharing
* Improved management of cubeapps

### 2.5.4
* Improved file validation for Ad-Hoc sharing
* Improved management of cubeapps

### 2.5.3
* Minor UI tweaks

### 2.5.2
* Minor UI tweaks

### 2.5.1
* Improved support for unicode character-containing project names

### 2.5.0
* Added generation of icons with an abbreviated project name when creating a new cubeapp

### 2.4.7
* Fix for incorrect documents database indexing after changing the SDK version

### 2.4.6
* Bugfix

### 2.4.5
* Support for WOWCube SDK 6.2

### 2.4.4
* Support for WOWCube SDK 6.1
* Experimental support for building Rust projects with WASI
* Minor UI tweaks

### 2.4.3
* Bugfix

### 2.4.2
* Minor UI tweaks
* Experimental support for building C++ project with WASI 

### 2.4.1
* Experimental support for building C++ project with WASI 

### 2.4.0
* Search over documentation and examples
* Some UI improvements

### 2.3.1
* Experimental support for Rust language (Windows and Mac)

### 2.3.0
* Experimental support for Rust language (Windows only)

### 2.2.5
* Fix for incorrect logging mode selection

### 2.2.4
* Minor UI tweaks

### 2.2.3
* Fix for incorrect installing of C++ Compiler support package on certain verions of Windows

### 2.2.1
* Improved compilation errors handling for Pawn

### 2.2.0
* SDK Version 6.0 support
* Minor bug fixes and improvements 

### 2.1.11
* Improved console output

### 2.1.10
* Improved handling of initial configuration of the extension
* Fix for incorrect rendering of additional C++ project include directories

### 2.1.9
* Fix for extension startup issues

### 2.1.8
* Option for toggling automatic checks for available updates

### 2.1.7
* Improved validation of cubeapp version value

### 2.1.6
* Fixed CPP documentation navigation bug
* Support for long cubapp names 

### 2.1.5
* Minor changes in order to support SDK Version 5.1

### 2.1.4
* Removed debug information from pawn cublets built for WOWCube emulator
* Ad-hoc descriptions are now saved to project file

### 2.1.3
* Ability to receive logs from all modules

### 2.1.2
* GFX + splash screen project template is added

### 2.1.1
* WOWCube store domain name tweak 

### 2.1.0
* Ability to receive real-time application logs from cubeapps running on WOWCube device via bluetooth 

### 2.0.7
### 2.0.6
* Minor UI tweaks

### 2.0.5
* Minor bugfix

### 2.0.4
* GFX Engine sample projects
* Minor tweaks

### 2.0.3
* GFX Engine

### 2.0.2
* Improved terminal output

### 2.0.1
* OSX bugfix

### 2.0.0
* C++ compiler support for building cubeapp applications
* External tools management
* Minor bugfix

### 1.20.2
* Regression bugfix

### 1.20.1
* Minor bugfix for correct badge assignment

### 1.20.0
* Minor UI tweaks

### 1.19.0
* Ability to clear cubeapp local data
* Support for embedded images in example projects documentation
* Imporved handling of sound assets
* Minor bugfixes

### 1.18.2
* Minor bugfix

### 1.18.1
* Minor change in updater output

### 1.18.0
* Support for icon background image file setting
* Support for Cubeapp application badge setting
* Improved compatibility with earlier formats of project file
* Improved handling of Cubeapp project file settings

### 1.17.2
* Improved handling of Cubeapp project file settings

### 1.17.1
* Windows compatibility fix

### 1.17.0
* Improved handling of Cubeapp project file settings

### 1.16.0
* Improved support for WOWCube Development Kit updates checker

### 1.15.0
* Improved support for WOWCube Development Kit updates checker
* The size of a cubeapp is not limited anymore
* Compilation of cubeapps for running on emulator is now done with full debug information and dynamic checking

### 1.14.0
* Added user interface for project assets management
* Added support for WOWCube Development Kit updates checker

### 1.13.0
* Added 'SDK Files' section to Documentation & Code Examples
* Pawn project folder names are changed

### 1.12.0
* Bugfix 

### 1.11.0
* Improved new project templates support for different versions of WOWCubeSDK 

### 1.10.0
* Added visual editor for cubeapp project file 

### 1.9.0
* Improved management and handling of versions of WOWCubeSD

### 1.8.0
* Improved fetching for device general information 

### 1.7.0
* Added Ad-Hoc cubeapp file sharing 

### 1.6.0
* New WOWCube Development Kit bluetooth bridging app support

### 1.5.3
* Bugfixes

### 1.5.2
* Improved document scrolling

### 1.5.0
* WOWCube Development Kit support
* Minor bugfixes and improvements

### 1.4.0
* Added support for versioned examples and documentation 
* Added support for new SDK folders structure
* Minor bugfixes and improvements

### 1.3.0
* Added WOWCube SDK version selection support
* Improved support for custom pathes defined in wowcube-build file

### 1.2.2
* Fix for 'No task to run on cube' issue
* Bluetooth loader response parsing is slightly improved

### 1.2.0
* Introduced new "Run Cubeapp" feature

### 1.1.0
* Introduced new "Upload CUB File to Device" feature
* Added WOWCube SDK path validation
* Minor UI tweaks and fixes

### 1.0.0
* Production build

### 0.9.9
* Fixed for inclusion of local .inc files on Windows

### 0.9.8
* Fixed for WOWCube emulator executable path on Linux

### 0.9.7
* Changes to support WOWCube SDK 2.3.4-alpha5
* Fixed filenames inconsistency for case-sensitive file systems
* Fixed backslash character support in path names
* Improved handling of new project creation failure
* Minor UI improvements and bugfixes
* Minor changes for better compatibility with Linux

### 0.9.5
* Added output and log colorization
* Fixed virtual terminal - related bug

### 0.9.4
### 0.9.3
### 0.9.2
* Minor UI changed

### 0.9.1
* Second release candidate for internal testing
* Improved syncronization of views
* Minor UI changed

### 0.9.0
* Release candidate for internal testing
