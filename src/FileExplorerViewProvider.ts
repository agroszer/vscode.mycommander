import * as vscode from 'vscode';
import * as path from 'path';

export class FileExplorerViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'myCommander.fileExplorer';

    private _view?: vscode.WebviewView;
    private _currentDir: string = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    private _folderToSelect?: string;
    private _fileToSelect?: string; // New property to store the file name to select
    private _lastSelectedItemName?: string; // Stores the name of the last selected item
    private _rootPath: string = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    private _tabs: string[] = [];

    constructor(private readonly _extensionUri: vscode.Uri, private readonly _context: vscode.ExtensionContext) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        this._tabs = this._context.workspaceState.get('myCommander.tabs', [this._rootPath]);
        if (this._tabs.length > 0) {
            this._currentDir = this._tabs[0];
        }


        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'ready': {
                    this.updateFileList();
                    break;
                }
                case 'open': {
                    const filePath = path.join(this._currentDir, data.fileName);
                    const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
                    if (stat.type === vscode.FileType.Directory) {
                        this._updateCurrentDirAndTab(filePath);
                    } else {
                        const document = await vscode.workspace.openTextDocument(filePath);
                        await vscode.window.showTextDocument(document, {
                            preview: false,
                            preserveFocus: data.preserveFocus === true
                        });
                    }
                    break;
                }
                case 'goUp': {
                    if (this._currentDir !== this._rootPath) {
                        this._updateCurrentDirAndTab(path.dirname(this._currentDir), path.basename(this._currentDir));
                    }
                    break;
                }
                case 'goToRoot': {
                    this._updateCurrentDirAndTab(this._rootPath);
                    break;
                }
                case 'executeCommand': { // New case
                    if (data.command) {
                        vscode.commands.executeCommand(data.command);
                    }
                    break;
                }
                case 'findFiles': {
                    // This opens the "Find in Files" view and scopes it to the current directory.
                    // The user can then type a filename in the search input.
                    vscode.commands.executeCommand('workbench.action.findInFiles', { 
                        filesToInclude: this._currentDir,
                        showIncludesExcludes: true,
                        query: ''
                    });
                    break;
                }
                case 'addTab': {
                    const currentDir = this._currentDir;
                    this._tabs.push(currentDir);
                    this._context.workspaceState.update('myCommander.tabs', this._tabs);
                    this.updateFileList();
                    break;
                }
                case 'removeTab': {
                    const tabToRemove = data.tab;
                    const index = this._tabs.indexOf(tabToRemove);
                    if (index !== -1) {
                        this._tabs.splice(index, 1);
                        if (this._tabs.length === 0) {
                            this._tabs.push(this._rootPath);
                        }
                        this._context.workspaceState.update('myCommander.tabs', this._tabs);
                        if (this._currentDir === tabToRemove) {
                            this._currentDir = this._tabs[0];
                        }
                        this.updateFileList();
                    }
                    break;
                }
                case 'switchTab': {
                    this._currentDir = data.tab;
                    this.updateFileList();
                    break;
                }
                case 'selectionChanged': {
                    this._lastSelectedItemName = data.fileName;
                    break;
                }
            }
        });

        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('myCommander')) {
                this._updateSettings();
            }
        });
    }

    private _updateCurrentDirAndTab(newDir: string, folderToSelect?: string) {
        const oldDir = this._currentDir;
        this._currentDir = newDir;
        if (folderToSelect) {
            this._folderToSelect = folderToSelect;
        }
        const index = this._tabs.indexOf(oldDir);
        if (index !== -1) {
            this._tabs[index] = this._currentDir;
            this._context.workspaceState.update('myCommander.tabs', this._tabs);
        }
        this.updateFileList();
    }

    private _updateSettings() {
        if (!this._view) {
            return;
        }

        const rightColumn = vscode.workspace.getConfiguration('myCommander').get('rightColumn', 'nothing');
        const searchCaseSensitive = vscode.workspace.getConfiguration('myCommander').get('searchCaseSensitive', false);
        const searchMode = vscode.workspace.getConfiguration('myCommander').get('searchMode', 'filter');
        const searchMatch = vscode.workspace.getConfiguration('myCommander').get('searchMatch', 'startsWith');

        this._view.webview.postMessage({
            type: 'settingsUpdate',
            rightColumn: rightColumn,
            searchCaseSensitive: searchCaseSensitive,
            searchMode: searchMode,
            searchMatch: searchMatch,
        });
    }

    public async revealFile(fileUri: vscode.Uri) {
        if (!this._view) {
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showInformationMessage('No workspace folder open to reveal file in.');
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const filePath = fileUri.fsPath;

        // Check if the file is within the current workspace
        if (!filePath.startsWith(workspaceRoot)) {
            vscode.window.showInformationMessage('File is not within the current workspace.');
            return;
        }

        const newDir = path.dirname(filePath);

        // Find the 'current' tab and replace its path
        const oldDir = this._currentDir;
        let tabIndexToUpdate = -1;
        let longestMatch = 0;
        for (let i = 0; i < this._tabs.length; i++) {
            if (oldDir.startsWith(this._tabs[i]) && this._tabs[i].length > longestMatch) {
                longestMatch = this._tabs[i].length;
                tabIndexToUpdate = i;
            }
        }

        console.log(tabIndexToUpdate, this._tabs, oldDir);
        if (tabIndexToUpdate !== -1) {
            this._tabs[tabIndexToUpdate] = newDir;
            this._context.workspaceState.update('myCommander.tabs', this._tabs);
        }

        this._currentDir = newDir;
        this._fileToSelect = path.basename(filePath);
        this.updateFileList();
    }

    public async updateFileList() {
        if (!this._view) {
            return;
        }

        try {
            const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(this._currentDir));
            let fileList = await Promise.all(
                files.map(async ([fileName, fileType]) => {
                    const filePath = path.join(this._currentDir, fileName);
                    let fileSize = 0;
                    if (fileType === vscode.FileType.File) {
                        try {
                            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
                            fileSize = stat.size;
                        } catch (e) {
                            console.error(e);
                        }
                    }
                    return {
                        name: fileName,
                        isDirectory: fileType === vscode.FileType.Directory,
                        size: fileSize,
                    };
                })
            );

            // Sort directories first, then files alphabetically
            fileList.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) {
                    return -1;
                }
                if (!a.isDirectory && b.isDirectory) {
                    return 1;
                }
                return a.name.localeCompare(b.name);
            });

            let selectedIndex = 0;
            if (this._folderToSelect) {
                const index = fileList.findIndex(f => f.name === this._folderToSelect);
                if (index !== -1) {
                    selectedIndex = index;
                }
                this._folderToSelect = undefined;
            } else if (this._fileToSelect) { // New logic for file selection
                const index = fileList.findIndex(f => f.name === this._fileToSelect);
                if (index !== -1) {
                    selectedIndex = index;
                }
                this._fileToSelect = undefined; // Clear after selection
            } else if (this._lastSelectedItemName) { // Restore last selected item
                const index = fileList.findIndex(f => f.name === this._lastSelectedItemName);
                if (index !== -1) {
                    selectedIndex = index;
                }
                this._lastSelectedItemName = undefined; // Clear after use
            }

            

            const rightColumn = vscode.workspace.getConfiguration('myCommander').get('rightColumn', 'nothing');
            const searchCaseSensitive = vscode.workspace.getConfiguration('myCommander').get('searchCaseSensitive', false);
            const searchMode = vscode.workspace.getConfiguration('myCommander').get('searchMode', 'filter');
            const searchMatch = vscode.workspace.getConfiguration('myCommander').get('searchMatch', 'startsWith');

            this._view.webview.postMessage({
                type: 'fileList',
                files: fileList,
                selectedIndex: selectedIndex,
                rightColumn: rightColumn, // Pass the setting to the webview
                searchCaseSensitive: searchCaseSensitive,
                searchMode: searchMode,
                searchMatch: searchMatch,
                tabs: this._tabs,
                activeTab: this._currentDir,
                rootPath: this._rootPath,
            });
        } catch (e) {
            console.error(e);
            vscode.window.showErrorMessage(`Error reading directory: ${this._currentDir}`);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

        const scriptUriWithCacheBust = scriptUri.with({ query: `v=${new Date().getTime()}` });
        const styleUriWithCacheBust = styleUri.with({ query: `v=${new Date().getTime()}` });

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUriWithCacheBust}" rel="stylesheet">
				<title>File Explorer</title>
			</head>
			<body>
                <div id="main-container">
                    <div id="tab-bar">
                        <button id="go-up-button">..</button>
                        <button id="go-root-button">/</button>
                        <button id="add-tab-button">add folder/tab</button>
                        <ul id="tab-list"></ul>
                    </div>
                    <div id="file-view">
                        <div id="header">
                            <div id="header-row-1">
                                <input type="text" id="search-box" placeholder="Search..." />
                            </div>
                        </div>
                        <ul id="file-list" tabindex="0"></ul>
                    </div>
                </div>
				<script src="${scriptUriWithCacheBust}"></script>
			</body>
			</html>`;
    }
}