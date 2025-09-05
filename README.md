# myCommander

Twin panel file manager like file browser for VS Code. Well just one panel, but that fits (me).

## Features

* List dirs and files, but not in a tree. The stock VS Code explorer drives me nuts.
* Search for dirs or files by starting to type (works a lot better without a tree)
* Navigate folder with the left/right arrows, enter
* Open a file with the right arrow, F4 or enter, set focus to the editor
* Open a file with F3, keeps the focus on the sidebar
* Ctrl+S or F7: open the find in files sidebar with the current folder
* To add a hotkey to set focus:

  `{"key": "ctrl+o", "command": "workbench.view.extension.my-commander-container"}`

## Extension Settings

* `myCommander.showFileSize`: Whether to show file sizes in the file explorer on the right.
* `myCommander.searchCaseSensitive`: Whether the search in the file explorer is case sensitive.
* `myCommander.searchMode`: The search mode. "filter" will only show matching items. "search" will show all items and select the first match.
* `myCommander.searchMatch`: The search match mode. "startsWith" will match the beginning of the item name. "in" will match anywhere in the item name.

## Release Notes

### 1.0.0

Initial release of ...


Special thanks go to Google Gemini