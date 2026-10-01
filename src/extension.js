'use strict';

const vscode = require('vscode');
const { colorToEmoji, buildTitle } = require('./colorEmoji');

const WRITTEN_KEY = 'peacockTaskbarIcon.writtenTitle';

function peacockColor() {
    const custom = vscode.workspace.getConfiguration('workbench').inspect('colorCustomizations');
    const titleBar = custom && custom.workspaceValue && custom.workspaceValue['titleBar.activeBackground'];
    if (titleBar) {
        return titleBar;
    }
    const peacock = vscode.workspace.getConfiguration('peacock').inspect('color');
    return peacock && peacock.workspaceValue;
}

async function update(context) {
    if (!vscode.workspace.workspaceFolders) {
        return;
    }
    const windowConfig = vscode.workspace.getConfiguration('window');
    const info = windowConfig.inspect('title');
    const current = info.workspaceValue;
    const written = context.workspaceState.get(WRITTEN_KEY);

    // A workspace title we did not write is user-owned; leave it alone.
    if (current !== undefined && current !== written) {
        return;
    }

    const emoji = colorToEmoji(peacockColor());
    const template = info.globalValue !== undefined ? info.globalValue : info.defaultValue;
    const desired = emoji ? buildTitle(template, emoji) : undefined;
    if (desired === current) {
        return;
    }
    await windowConfig.update('title', desired, vscode.ConfigurationTarget.Workspace);
    await context.workspaceState.update(WRITTEN_KEY, desired);
}

function activate(context) {
    let queue = Promise.resolve();
    const schedule = () => {
        queue = queue.then(() => update(context)).catch(err => console.error('peacock-taskbar-icon:', err));
        return queue;
    };

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('workbench.colorCustomizations')
                || e.affectsConfiguration('peacock.color')
                || e.affectsConfiguration('window.title')) {
                schedule();
            }
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(schedule),
        vscode.commands.registerCommand('peacockTaskbarIcon.refresh', schedule),
    );
    schedule();
}

function deactivate() { }

module.exports = { activate, deactivate };
