
import * as vscode from 'vscode';
import * as path from 'path';

export class FileExplorerViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'myCommander.fileExplorer';

    private _view?: vscode.WebviewView;
    private _currentDir: string = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    private _folderToSelect?: string;
    private _rootPath: string = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'ready': {
                    this._updateFileList();
                    break;
                }
                case 'open': {
                    const filePath = path.join(this._currentDir, data.fileName);
                    const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
                    if (stat.type === vscode.FileType.Directory) {
                        this._currentDir = filePath;
                        this._updateFileList();
                    } else {
                        const document = await vscode.workspace.openTextDocument(filePath);
                        await vscode.window.showTextDocument(document, { preview: false });
                    }
                    break;
                }
                case 'goUp': {
                    if (this._currentDir !== this._rootPath) {
                        this._folderToSelect = path.basename(this._currentDir);
                        this._currentDir = path.dirname(this._currentDir);
                        this._updateFileList();
                    }
                    break;
                }
                case 'goToRoot': {
                    this._currentDir = this._rootPath;
                    this._updateFileList();
                    break;
                }
            }
        });
    }

    private async _updateFileList() {
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
            }

            let displayCurrentDir = this._currentDir;
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
                if (this._currentDir.startsWith(workspaceRoot)) {
                    displayCurrentDir = path.relative(workspaceRoot, this._currentDir);
                    if (displayCurrentDir === '') {
                        displayCurrentDir = '.'; // Represent workspace root as '.'
                    }
                }
            }

            const showFileSize = vscode.workspace.getConfiguration('myCommander').get('showFileSize', false);
            const searchCaseSensitive = vscode.workspace.getConfiguration('myCommander').get('searchCaseSensitive', false);

            this._view.webview.postMessage({
                type: 'fileList',
                files: fileList,
                currentDir: displayCurrentDir,
                selectedIndex: selectedIndex,
                showFileSize: showFileSize, // Pass the setting to the webview
                searchCaseSensitive: searchCaseSensitive,
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
                <div id="header">
                    <div id="header-row-1">
                        <div id="nav-buttons">
                            <button id="go-up-button">..</button>
                            <button id="go-root-button">/</button>
                        </div>
                        <div id="current-dir"></div>
                    </div>
                    <div id="header-row-2">
                        <input type="text" id="search-box" placeholder="Search..." />
                    </div>
                </div>
				<ul id="file-list" tabindex="0"></ul>
				<script src="${scriptUriWithCacheBust}"></script>
			</body>
			</html>`;
    }
}
