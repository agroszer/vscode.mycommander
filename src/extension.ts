// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { FileExplorerViewProvider } from './FileExplorerViewProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "mycommander" is now active!');

    const fileExplorerProvider = new FileExplorerViewProvider(context.extensionUri, context);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			FileExplorerViewProvider.viewType,
			fileExplorerProvider
		)
	);

    context.subscriptions.push(
        vscode.commands.registerCommand('myCommander.refresh', () => {
            fileExplorerProvider.updateFileList();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('myCommander.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'myCommander');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('myCommander.revealInExplorer', () => {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document.uri) {
                fileExplorerProvider.revealFile(activeEditor.document.uri);
            } else {
                vscode.window.showInformationMessage('No active editor or document to reveal.');
            }
        })
    );
}

// This method is called when your extension is deactivated
export function deactivate() {}