import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

var outputChannel: vscode.OutputChannel;
var currentContext: vscode.ExtensionContext;
let extensionActive = false;

export function activate(context: vscode.ExtensionContext) {
	extensionActive = true;
	currentContext = context;
	console.log('"copy-and-paste-on-save" is now active!');

	if (outputChannel === undefined){
		outputChannel = vscode.window.createOutputChannel("Copy And Paste On Save");
	}

	let setFoldersForCurrentFileFunction = vscode.commands.registerCommand('copy-and-paste-on-save.setFoldersForCurrentFile', () => {
		setFoldersForCurrentFile();
	});

	let copyFoldersFromCurrentFileFunction = vscode.commands.registerCommand('copy-and-paste-on-save.copyFoldersFromCurrentFile', () => {
		copyFoldersFromCurrentFile();
	});

	let pasteFoldersToCurrentFileFunction = vscode.commands.registerCommand('copy-and-paste-on-save.pasteFoldersToCurrentFile', () => {
		pasteFoldersToCurrentFile();
	});

	vscode.workspace.onDidSaveTextDocument((document) => {
		copyAndPasteCurrentFile();
	});

	context.subscriptions.push(setFoldersForCurrentFileFunction);
	context.subscriptions.push(copyFoldersFromCurrentFileFunction);
	context.subscriptions.push(pasteFoldersToCurrentFileFunction);
}

export function deactivate() {
	extensionActive = false;
}

export async function copyAndPasteCurrentFile(){
	if (!extensionActive){
        return;
    }

	let textEditor = vscode.window.activeTextEditor;

    if (textEditor !== undefined){
        let fullFilePath = textEditor.document.fileName;
        let baseName = path.basename(fullFilePath);

		let sFolders = currentContext.workspaceState.get<string>(fullFilePath);

		if (sFolders === undefined || sFolders === ""){
			sFolders = currentContext.workspaceState.get<string>(baseName);
		}

		if (sFolders === undefined || sFolders === ""){
			sFolders = currentContext.globalState.get<string>(fullFilePath);
		}

		if (sFolders === undefined || sFolders === ""){
			sFolders = currentContext.globalState.get<string>(baseName);
		}

		if (sFolders !== undefined && sFolders !== ""){
			let foldersArray = sFolders.split(";");
			let hadAnErr = false;
			for(let i = 0; i < foldersArray.length; i++){
				let destinationPath = path.join(foldersArray[i], baseName);
				fs.copyFile(fullFilePath, destinationPath, (err) => {
					if (err){
						hadAnErr = true; 
						outputChannel.appendLine('failed to copy ' + fullFilePath + ' to ' + destinationPath);
					} 
				});
			}
			if (hadAnErr){
				outputChannel.show();
			}
		}
	}
}

export async function setFoldersForCurrentFile(){
    if (!extensionActive){
        return;
    }

    let textEditor = vscode.window.activeTextEditor;

    if (textEditor !== undefined){
        
        let fullFilePath = textEditor.document.fileName;
        let baseName = path.basename(fullFilePath);

		const fullOrBasePath = await vscode.window.showInformationMessage("Use full file path --[" + fullFilePath + "]-- or base file name --[" + baseName +"]-- as akKey", 'Full Path', 'Base Name');

		if (fullOrBasePath === undefined){
            return;
        }

        const contextState = await vscode.window.showInformationMessage("Set folder location(s) in", 'Global State', 'Workspace State');
        
        if (contextState === undefined){
            return;
        }

		let akKey = baseName; 

		if (fullOrBasePath === 'Full Path'){
			akKey = fullFilePath;
		}

        let currentFolders = "";

        if (contextState === 'Global State'){ 
            let globalFolders = currentContext.globalState.get<string>(akKey);
            if (globalFolders !== undefined){
                currentFolders = globalFolders;
            }

        } else if (contextState === 'Workspace State'){
            let workspaceFolders = currentContext.workspaceState.get<string>(akKey);
            if (workspaceFolders !== undefined){
                currentFolders = workspaceFolders;
            }
        }

        vscode.window.showInputBox({
            prompt: "Enter folder path(s) for --[" + akKey + "]--. Multiple folder paths should be seperated by a semicolon ; e.g \"C:\\SomeFolder;C:\\SomeOtherFolder\"",
            value: currentFolders

        }).then(folders => {
            if (folders !== undefined && folders !== currentFolders) {
                if (contextState === 'Global State'){ 
                    currentContext.globalState.update(akKey, folders);

                } else if (contextState === 'Workspace State'){
                    currentContext.workspaceState.update(akKey, folders);
                }

				if (folders === ""){
					outputChannel.appendLine("folder(s) for --[" + akKey + "]-- cleared");
				} else {
					outputChannel.appendLine("folder(s) for --[" + akKey + "]-- set to " + folders);
				}
                outputChannel.show();
            } 
        });

    } else {
        outputChannel.appendLine("No open file found.");
		outputChannel.show();
    }
}

export async function copyFoldersFromCurrentFile(){
    if (!extensionActive){
        return;
    }

    let textEditor = vscode.window.activeTextEditor;

    if (textEditor !== undefined){
        let fullFilePath = textEditor.document.fileName;
        let baseName = path.basename(fullFilePath);
		let akKey = "";
		let sFolders = currentContext.workspaceState.get<string>(fullFilePath);

		if (sFolders !== undefined && sFolders !== ""){
			akKey = fullFilePath;
		} else {
			sFolders = currentContext.workspaceState.get<string>(baseName);
		}

		if (sFolders !== undefined && sFolders !== ""){
			akKey = baseName;
		} else {
			sFolders = currentContext.globalState.get<string>(fullFilePath);
		}

		if (sFolders !== undefined && sFolders !== ""){
			akKey = baseName;
		} else {
			sFolders = currentContext.globalState.get<string>(baseName);
		}

		currentContext.globalState.update("copy-and-paste-on-save.copiedFile", akKey);

		if (akKey !== ""){
			outputChannel.appendLine("Folders copied from --[" + akKey + "]--");
		} else {
			outputChannel.appendLine("No folders set for --[" + akKey + "]--. copied folders set to none.");
		}
       
        outputChannel.show();
    } else {
        outputChannel.appendLine("No open file found. Open a file to copy folder location(s) from the file.");
		outputChannel.show();
    }
}

export async function pasteFoldersToCurrentFile(){
    if (!extensionActive){
        return;
    }
	let textEditor = vscode.window.activeTextEditor;

    if (textEditor !== undefined){
        let fullFilePath = textEditor.document.fileName;
        let baseName = path.basename(fullFilePath);

		let copiedFileakKey = currentContext.globalState.get<string>("copy-and-paste-on-save.copiedFile");
		if (copiedFileakKey !== undefined && copiedFileakKey !== ""){
			let bGlobal = false;
			let sFolders = currentContext.workspaceState.get<string>(copiedFileakKey);

			if (sFolders === undefined || sFolders === ""){
				sFolders = currentContext.globalState.get<string>(copiedFileakKey);
				bGlobal = true;
			}

			if (sFolders !== undefined && sFolders !== ""){

				const fullOrBasePath = await vscode.window.showInformationMessage("Use full file path [" + fullFilePath + "] or base file name [" + baseName +"] as akKey", 'Full Path', 'Base Name');
				if (fullOrBasePath === undefined){
					return;
				}

				let akKey = baseName;
				if (fullOrBasePath === 'Full Path'){
					akKey = fullFilePath;
				}

				if (bGlobal){
					currentContext.globalState.update(akKey, sFolders);
					outputChannel.appendLine("Paste folder locations for " + akKey + " Set To " + sFolders + " in the global state");
				} else {
					currentContext.workspaceState.update(akKey, sFolders);
					outputChannel.appendLine("Paste folder locations for " + akKey + " Set To " + sFolders + " in the workspace state");
				}
				outputChannel.show();
			} else {
				outputChannel.appendLine("No folder locations found for " + copiedFileakKey);
				outputChannel.show();
			}
		} else {
			outputChannel.appendLine("No folders locations copied");
			outputChannel.show();
		}
	}
}