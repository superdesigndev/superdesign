Try [MCP servers](https://code.visualstudio.com/mcp) to extend agent mode in VS Code!

Dismiss this update

[Edit](https://vscode.dev/github/microsoft/vscode-docs/blob/main/api/references/commands.md "Edit this document in vscode.dev")

# Built-in Commands

This document lists a subset of Visual Studio Code commands that you might use with `vscode.commands.executeCommand` API.

Read the [Commands guide](https://code.visualstudio.com/api/extension-guides/command) for how to use the commands API.

The following is a sample of how to open a new folder in VS Code:

```
let uri = Uri.file('/some/path/to/folder');
let success = await commands.executeCommand('vscode.openFolder', uri);
Copy
```

> **Note**: You can review the full set of VS Code commands via the Keyboard Shortcuts editor **File** \> **Preferences** \> **Keyboard Shortcuts**. The Keyboard Shortcuts editor lists all commands built into VS Code or contributed by extensions, along with their keybindings and visibility when clauses.

## [Commands](https://code.visualstudio.com/api/references/commands\#commands)

`vscode.executeDataToNotebook` \- Invoke notebook serializer

- _notebookType_ \- A notebook type
- _data_ \- Bytes to convert to data
- _(returns)_ \- Notebook Data

`vscode.executeNotebookToData` \- Invoke notebook serializer

- _notebookType_ \- A notebook type
- _NotebookData_ \- Notebook data to convert to bytes
- _(returns)_ \- Bytes

`notebook.selectKernel` \- Trigger kernel picker for specified notebook editor widget

- _options_ \- Select kernel options
- _(returns)_ \- no result

`interactive.open` \- Open interactive window and return notebook editor and input URI

- _showOptions_ \- Show Options
- _resource_ \- Interactive resource Uri
- _controllerId_ \- Notebook controller Id
- _title_ \- Interactive editor title
- _(returns)_ \- Notebook and input URI

`vscode.editorChat.start` \- Invoke a new editor chat session

- _Run arguments_ -
- _(returns)_ \- no result

`vscode.executeDocumentHighlights` \- Execute document highlight provider.

- _uri_ \- Uri of a text document
- _position_ \- A position in a text document
- _(returns)_ \- A promise that resolves to an array of DocumentHighlight-instances.

`vscode.executeDocumentSymbolProvider` \- Execute document symbol provider.

- _uri_ \- Uri of a text document
- _(returns)_ \- A promise that resolves to an array of SymbolInformation and DocumentSymbol instances.

`vscode.executeFormatDocumentProvider` \- Execute document format provider.

- _uri_ \- Uri of a text document
- _options_ \- Formatting options
- _(returns)_ \- A promise that resolves to an array of TextEdits.

`vscode.executeFormatRangeProvider` \- Execute range format provider.

- _uri_ \- Uri of a text document
- _range_ \- A range in a text document
- _options_ \- Formatting options
- _(returns)_ \- A promise that resolves to an array of TextEdits.

`vscode.executeFormatOnTypeProvider` \- Execute format on type provider.

- _uri_ \- Uri of a text document
- _position_ \- A position in a text document
- _ch_ \- Trigger character
- _options_ \- Formatting options
- _(returns)_ \- A promise that resolves to an array of TextEdits.

`vscode.executeDefinitionProvider` \- Execute all definition providers.

- _uri_ \- Uri of a text document
- _position_ \- A position in a text document
- _(returns)_ \- A promise that resolves to an array of Location or LocationLink instances.

`vscode.executeTypeDefinitionProvider` \- Execute all type definition providers.

- _uri_ \- Uri of a text document
- _position_ \- A position in a text document
- _(returns)_ \- A promise that resolves to an array of Location or LocationLink instances.

`vscode.executeDeclarationProvider` \- Execute all declaration providers.

- _uri_ \- Uri of a text document
- _position_ \- A position in a text document
- _(returns)_ \- A promise that resolves to an array of Location or LocationLink instances.

`vscode.executeImplementationProvider` \- Execute all implementation providers.

- _uri_ \- Uri of a text document
- _position_ \- A position in a text document
- _(returns)_ \- A promise that resolves to an array of Location or LocationLink instances.

`vscode.executeReferenceProvider` \- Execute all reference providers.

- _uri_ \- Uri of a text document
- _position_ \- A position in a text document
- _(returns)_ \- A promise that resolves to an array of Location-instances.

`vscode.executeHoverProvider` \- Execute all hover providers.

- _uri_ \- Uri of a text document
- _position_ \- A position in a text document
- _(returns)_ \- A promise that resolves to an array of Hover-instances.

`vscode.executeSelectionRangeProvider` \- Execute selection range provider.

- _uri_ \- Uri of a text document
- _position_ \- A position in a text document
- _(returns)_ \- A promise that resolves to an array of ranges.

`vscode.executeWorkspaceSymbolProvider` \- Execute all workspace symbol providers.

- _query_ \- Search string
- _(returns)_ \- A promise that resolves to an array of SymbolInformation-instances.

`vscode.prepareCallHierarchy` \- Prepare call hierarchy at a position inside a document

- _uri_ \- Uri of a text document
- _position_ \- A position in a text document
- _(returns)_ \- A promise that resolves to an array of CallHierarchyItem-instances

`vscode.provideIncomingCalls` \- Compute incoming calls for an item

- _item_ \- A call hierarchy item
- _(returns)_ \- A promise that resolves to an array of CallHierarchyIncomingCall-instances

`vscode.provideOutgoingCalls` \- Compute outgoing calls for an item

- _item_ \- A call hierarchy item
- _(returns)_ \- A promise that resolves to an array of CallHierarchyOutgoingCall-instances

`vscode.prepareRename` \- Execute the prepareRename of rename provider.

- _uri_ \- Uri of a text document
- _position_ \- A position in a text document
- _(returns)_ \- A promise that resolves to a range and placeholder text.

`vscode.executeDocumentRenameProvider` \- Execute rename provider.

- _uri_ \- Uri of a text document
- _position_ \- A position in a text document
- _newName_ \- The new symbol name
- _(returns)_ \- A promise that resolves to a WorkspaceEdit.

`vscode.executeLinkProvider` \- Execute document link provider.

- _uri_ \- Uri of a text document
- _linkResolveCount_ \- (optional) Number of links that should be resolved, only when links are unresolved.
- _(returns)_ \- A promise that resolves to an array of DocumentLink-instances.

`vscode.provideDocumentSemanticTokensLegend` \- Provide semantic tokens legend for a document

- _uri_ \- Uri of a text document
- _(returns)_ \- A promise that resolves to SemanticTokensLegend.

`vscode.provideDocumentSemanticTokens` \- Provide semantic tokens for a document

- _uri_ \- Uri of a text document
- _(returns)_ \- A promise that resolves to SemanticTokens.

`vscode.provideDocumentRangeSemanticTokensLegend` \- Provide semantic tokens legend for a document range

- _uri_ \- Uri of a text document
- _range_ \- (optional) A range in a text document
- _(returns)_ \- A promise that resolves to SemanticTokensLegend.

`vscode.provideDocumentRangeSemanticTokens` \- Provide semantic tokens for a document range

- _uri_ \- Uri of a text document
- _range_ \- A range in a text document
- _(returns)_ \- A promise that resolves to SemanticTokens.

`vscode.executeCompletionItemProvider` \- Execute completion item provider.

- _uri_ \- Uri of a text document
- _position_ \- A position in a text document
- _triggerCharacter_ \- (optional) Trigger completion when the user types the character, like `,` or `(`
- _itemResolveCount_ \- (optional) Number of completions to resolve (too large numbers slow down completions)
- _(returns)_ \- A promise that resolves to a CompletionList-instance.

`vscode.executeSignatureHelpProvider` \- Execute signature help provider.

- _uri_ \- Uri of a text document
- _position_ \- A position in a text document
- _triggerCharacter_ \- (optional) Trigger signature help when the user types the character, like `,` or `(`
- _(returns)_ \- A promise that resolves to SignatureHelp.

`vscode.executeCodeLensProvider` \- Execute code lens provider.

- _uri_ \- Uri of a text document
- _itemResolveCount_ \- (optional) Number of lenses that should be resolved and returned. Will only return resolved lenses, will impact performance
- _(returns)_ \- A promise that resolves to an array of CodeLens-instances.

`vscode.executeCodeActionProvider` \- Execute code action provider.

- _uri_ \- Uri of a text document
- _rangeOrSelection_ \- Range in a text document. Some refactoring provider requires Selection object.
- _kind_ \- (optional) Code action kind to return code actions for
- _itemResolveCount_ \- (optional) Number of code actions to resolve (too large numbers slow down code actions)
- _(returns)_ \- A promise that resolves to an array of Command-instances.

`vscode.executeDocumentColorProvider` \- Execute document color provider.

- _uri_ \- Uri of a text document
- _(returns)_ \- A promise that resolves to an array of ColorInformation objects.

`vscode.executeColorPresentationProvider` \- Execute color presentation provider.

- _color_ \- The color to show and insert
- _context_ \- Context object with uri and range
- _(returns)_ \- A promise that resolves to an array of ColorPresentation objects.

`vscode.executeInlayHintProvider` \- Execute inlay hints provider

- _uri_ \- Uri of a text document
- _range_ \- A range in a text document
- _(returns)_ \- A promise that resolves to an array of Inlay objects

`vscode.executeFoldingRangeProvider` \- Execute folding range provider

- _uri_ \- Uri of a text document
- _(returns)_ \- A promise that resolves to an array of FoldingRange objects

`vscode.resolveNotebookContentProviders` \- Resolve Notebook Content Providers

- _(returns)_ \- A promise that resolves to an array of NotebookContentProvider static info objects.

`vscode.executeInlineValueProvider` \- Execute inline value provider

- _uri_ \- Uri of a text document
- _range_ \- A range in a text document
- _context_ \- An InlineValueContext
- _(returns)_ \- A promise that resolves to an array of InlineValue objects

`vscode.open` \- Opens the provided resource in the editor. Can be a text or binary file, or an http(s) URL. If you need more control over the options for opening a text file, use `vscode.window.showTextDocument` instead.

- _uri_ \- Uri of a text or binary file, or an http(s) URL
- _columnOrOptions_ \- (optional) Either the column in which to open, or editor options, see `vscode.TextDocumentShowOptions`
- _label_ \- Editor label (optional)
- _(returns)_ \- no result

`vscode.openWith` \- Opens the provided resource with a specific editor.

- _resource_ \- Resource to open
- _viewId_ \- Custom editor view id or 'default' to use VS Code's default editor
- _columnOrOptions_ \- (optional) Either the column in which to open or editor options, see vscode.TextDocumentShowOptions
- _(returns)_ \- no result

`vscode.diff` \- Opens the provided resources in the diff editor to compare their contents.

- _left_ \- Left-hand side resource of the diff editor
- _right_ \- Right-hand side resource of the diff editor
- _title_ \- Human readable title for the diff editor
- _options_ \- (optional) Either the column in which to open, or editor options (see vscode.TextDocumentShowOptions)

`vscode.changes` \- Opens a list of resources in the changes editor to compare their contents.

- _title_ \- Human readable title for the changes editor
- _resourceList_ \- List of resources to compare

`vscode.prepareTypeHierarchy` \- Prepare type hierarchy at a position inside a document

- _uri_ \- Uri of a text document
- _position_ \- A position in a text document
- _(returns)_ \- A promise that resolves to an array of TypeHierarchyItem-instances

`vscode.provideSupertypes` \- Compute supertypes for an item

- _item_ \- A type hierarchy item
- _(returns)_ \- A promise that resolves to an array of TypeHierarchyItem-instances

`vscode.provideSubtypes` \- Compute subtypes for an item

- _item_ \- A type hierarchy item
- _(returns)_ \- A promise that resolves to an array of TypeHierarchyItem-instances

`vscode.revealTestInExplorer` \- Reveals a test instance in the explorer

- _testItem_ \- A VS Code TestItem.
- _(returns)_ \- no result

`setContext` \- Set a custom context key value that can be used in when clauses.

- _name_ \- The context key name
- _value_ \- The context key value
- _(returns)_ \- no result

`vscode.executeMappedEditsProvider` \- Execute Mapped Edits Provider

- _uri_ \- Uri of a text document
- _string\_array_ \- Array of string,
- _MappedEditsContext_ \- Mapped Edits Context
- _(returns)_ \- A promise that resolves to a workspace edit or null

`cursorMove` \- Move cursor to a logical position in the view

- _Cursor move argument object_ \- Property-value pairs that can be passed through this argument:

  - 'to': A mandatory logical position value providing where to move the cursor.

    ```
    'left', 'right', 'up', 'down', 'prevBlankLine', 'nextBlankLine',
    'wrappedLineStart', 'wrappedLineEnd', 'wrappedLineColumnCenter'
    'wrappedLineFirstNonWhitespaceCharacter', 'wrappedLineLastNonWhitespaceCharacter'
    'viewPortTop', 'viewPortCenter', 'viewPortBottom', 'viewPortIfOutside'
    Copy
    ```

  - 'by': Unit to move. Default is computed based on 'to' value.

    ```
    'line', 'wrappedLine', 'character', 'halfLine'
    Copy
    ```

  - 'value': Number of units to move. Default is '1'.
  - 'select': If 'true' makes the selection. Default is 'false'.

`editorScroll` \- Scroll editor in the given direction

- _Editor scroll argument object_ \- Property-value pairs that can be passed through this argument:

  - 'to': A mandatory direction value.

    ```
    'up', 'down'
    Copy
    ```

  - 'by': Unit to move. Default is computed based on 'to' value.

    ```
    'line', 'wrappedLine', 'page', 'halfPage', 'editor'
    Copy
    ```

  - 'value': Number of units to move. Default is '1'.
  - 'revealCursor': If 'true' reveals the cursor if it is outside view port.

`revealLine` \- Reveal the given line at the given logical position

- _Reveal line argument object_ \- Property-value pairs that can be passed through this argument:

  - 'lineNumber': A mandatory line number value.
  - 'at': Logical position at which line has to be revealed.

    ```
    'top', 'center', 'bottom'
    Copy
    ```

`editor.unfold` \- Unfold the content in the editor

- _Unfold editor argument_ \- Property-value pairs that can be passed through this argument:

  - 'levels': Number of levels to unfold. If not set, defaults to 1.
  - 'direction': If 'up', unfold given number of levels up otherwise unfolds down.
  - 'selectionLines': Array of the start lines (0-based) of the editor selections to apply the unfold action to. If not
    set, the active selection(s) will be used.

`editor.fold` \- Fold the content in the editor

- _Fold editor argument_ \- Property-value pairs that can be passed through this argument:

  - 'levels': Number of levels to fold.
  - 'direction': If 'up', folds given number of levels up otherwise folds down.
  - 'selectionLines': Array of the start lines (0-based) of the editor selections to apply the fold action to. If not set, the active selection(s) will be used.
    If no levels or direction is set, folds the region at the locations or if already collapsed, the first uncollapsed parent instead.

`editor.toggleFold` \- Folds or unfolds the content in the editor depending on its current state

`editor.actions.findWithArgs` \- Open a new In-Editor Find Widget with specific options.

- searchString - String to prefill the find input
- replaceString - String to prefill the replace input
- isRegex - enable regex
- preserveCase - try to keep the same case when replacing
- findInSelection - restrict the find location to the current selection
- matchWholeWord
- isCaseSensitive

`editor.action.goToLocations` \- Go to locations from a position in a file

- _uri_ \- The text document in which to start
- _position_ \- The position at which to start
- _locations_ \- An array of locations.
- _multiple_ \- Define what to do when having multiple results, either `peek`, `gotoAndPeek`, or \`goto
- _noResultsMessage_ \- Human readable message that shows when locations is empty.

`editor.action.peekLocations` \- Peek locations from a position in a file

- _uri_ \- The text document in which to start
- _position_ \- The position at which to start
- _locations_ \- An array of locations.
- _multiple_ \- Define what to do when having multiple results, either `peek`, `gotoAndPeek`, or \`goto

`workbench.action.quickOpen` \- Quick access

- _prefix_ -

`notebook.cell.toggleOutputs` \- Toggle Outputs

- _options_ \- The cell range options

`notebook.fold` \- Fold Cell

- _index_ \- The cell index

`notebook.unfold` \- Unfold Cell

- _index_ \- The cell index

`notebook.selectKernel` \- Notebook Kernel Args

- _kernelInfo_ \- The kernel info

`notebook.cell.changeLanguage` \- Change Cell Language

- _range_ \- The cell range
- _language_ \- The target cell language

`notebook.execute` \- Run All

- _uri_ \- The document uri

`notebook.cell.execute` \- Execute Cell

- _options_ \- The cell range options

`notebook.cell.executeAndFocusContainer` \- Execute Cell and Focus Container

- _options_ \- The cell range options

`notebook.cell.cancelExecution` \- Stop Cell Execution

- _options_ \- The cell range options

`workbench.action.findInFiles` \- Open a workspace search

- _A set of options for the search_ -

`_interactive.open` \- Open Interactive Window

- _showOptions_ \- Show Options
- _resource_ \- Interactive resource Uri
- _controllerId_ \- Notebook controller Id
- _title_ \- Notebook editor title

`interactive.execute` \- Execute the Contents of the Input Box

- _resource_ \- Interactive resource Uri

`search.action.openNewEditor` \- Open a new search editor. Arguments passed can include variables like ${relativeFileDirname}.

- _Open new Search Editor args_ -

`search.action.openEditor` \- Open a new search editor. Arguments passed can include variables like ${relativeFileDirname}.

- _Open new Search Editor args_ -

`search.action.openNewEditorToSide` \- Open a new search editor. Arguments passed can include variables like ${relativeFileDirname}.

- _Open new Search Editor args_ -

`vscode.openFolder` \- Open a folder or workspace in the current window or new window depending on the newWindow argument. Note that opening in the same window will shutdown the current extension host process and start a new one on the given folder/workspace unless the newWindow parameter is set to true.

- _uri_ \- (optional) Uri of the folder or workspace file to open. If not provided, a native dialog will ask the user for the folder
- _options_ \- (optional) Options. Object with the following properties: `forceNewWindow`: Whether to open the folder/workspace in a new window or the same. Defaults to opening in the same window. `forceReuseWindow`: Whether to force opening the folder/workspace in the same window. Defaults to false. `noRecentEntry`: Whether the opened URI will appear in the 'Open Recent' list. Defaults to false. Note, for backward compatibility, options can also be of type boolean, representing the `forceNewWindow` setting.

`vscode.newWindow` \- Opens an new window depending on the newWindow argument.

- _options_ \- (optional) Options. Object with the following properties: `reuseWindow`: Whether to open a new window or the same. Defaults to opening in a new window.

`vscode.removeFromRecentlyOpened` \- Removes an entry with the given path from the recently opened list.

- _path_ \- URI or URI string to remove from recently opened.

`moveActiveEditor` \- Move the active editor by tabs or groups

- _Active editor move argument_ \- Argument Properties:

  - 'to': String value providing where to move.
  - 'by': String value providing the unit for move (by tab or by group).
  - 'value': Number value providing how many positions or an absolute position to move.

`copyActiveEditor` \- Copy the active editor by groups

- _Active editor copy argument_ \- Argument Properties:

  - 'to': String value providing where to copy.
  - 'value': Number value providing how many positions or an absolute position to copy.

`vscode.getEditorLayout` \- Get Editor Layout

- _(returns)_ \- An editor layout object, in the same format as vscode.setEditorLayout

`workbench.action.files.newUntitledFile` \- New Untitled Text File

- _New Untitled Text File arguments_ \- The editor view type or language ID if known

`workbench.extensions.installExtension` \- Install the given extension

- _extensionIdOrVSIXUri_ \- Extension id or VSIX resource uri
- _options_ \- (optional) Options for installing the extension. Object with the following properties: `installOnlyNewlyAddedFromExtensionPackVSIX`: When enabled, VS Code installs only newly added extensions from the extension pack VSIX. This option is considered only when installing VSIX.

`workbench.extensions.uninstallExtension` \- Uninstall the given extension

- _Id of the extension to uninstall_ -

`workbench.extensions.search` \- Search for a specific extension

- _Query to use in search_ -

`workbench.action.tasks.runTask` \- Run Task

- _args_ \- Filters the tasks shown in the Quick Pick

`workbench.action.openIssueReporter` \- Open the issue reporter and optionally prefill part of the form.

- _options_ \- Data to use to prefill the issue reporter with.

`vscode.openIssueReporter` \- Open the issue reporter and optionally prefill part of the form.

- _options_ \- Data to use to prefill the issue reporter with.

`workbench.action.openLogFile` \- workbench.action.openLogFile

- _logFile_ -

`workbench.action.openWalkthrough` \- Open the walkthrough.

- _walkthroughID_ \- ID of the walkthrough to open.
- _toSide_ \- Opens the walkthrough in a new editor group to the side.

## [Simple commands](https://code.visualstudio.com/api/references/commands\#simple-commands)

Simple commands that do not require parameters can be found in the Keyboard Shortcuts list in the default `keybindings.json` file. The unbound commands are listed in a comment block at the bottom of the file.

To review the default `keybindings.json`, run **Preferences: Open Default Keyboard Shortcuts (JSON)** from the Command Palette (Ctrl+Shift+P).

08/07/2025

- [![RSS](https://code.visualstudio.com/assets/community/sidebar/rss.svg)RSS Feed](https://code.visualstudio.com/feed.xml)
- [![Stackoverflow](https://code.visualstudio.com/assets/community/sidebar/stackoverflow.svg)Ask questions](https://stackoverflow.com/questions/tagged/vscode)
- [![Twitter](https://code.visualstudio.com/assets/community/sidebar/twitter.svg)Follow @code](https://go.microsoft.com/fwlink/?LinkID=533687)
- [![GitHub](https://code.visualstudio.com/assets/community/sidebar/github.svg)Request features](https://go.microsoft.com/fwlink/?LinkID=533482)
- [![Issues](https://code.visualstudio.com/assets/community/sidebar/issue.svg)Report issues](https://www.github.com/Microsoft/vscode/issues)
- [![YouTube](https://code.visualstudio.com/assets/community/sidebar/youtube.svg)Watch videos](https://www.youtube.com/channel/UCs5Y5_7XK8HLDX0SLNwkd3w)