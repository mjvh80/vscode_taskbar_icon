# Peacock Taskbar Icon

Prefixes the VS Code window title with an emoji chosen to resemble the current Peacock title-bar colour. This makes windows easier to distinguish in the Windows taskbar.

## Use

Install the extension and set a title template in your VS Code user settings if you want to control the rest of the title:

```jsonc
"window.title": "${rootName} | ${activeEditorShort}"
```

The extension writes a workspace-level `window.title`, inserting its colour emoji at the front. It uses the workspace's `workbench.colorCustomizations.titleBar.activeBackground` first, then `peacock.color`. A manually configured workspace `window.title` is left unchanged. The **Peacock Taskbar Icon: Refresh Window Title** command forces an update.

The match is based on colours measured from Windows' emoji font. Circles are preferred over squares, and squares over hearts or other emoji, when the colour match is close; a substantially closer colour match takes priority.

## Development

- Open this folder in VS Code and press F5 to launch an Extension Development Host.
- Run `npm test` for the unit tests.
- Run `npm run show-matches` to inspect sample mappings.
- On Windows, run `npm run build-palette` to regenerate `src/palette.json`. This downloads the latest Unicode emoji test data and measures the locally installed Segoe UI Emoji font using Edge or Chrome. Regenerating the palette can change results across Windows/font versions.
- Package with `npx @vscode/vsce package` and install the resulting `.vsix` with `code --install-extension <file.vsix>`.

## AI Assistance

Parts of the implementation and tests were created with assistance from GitHub Copilot. Project direction and publication decisions are by Marcus van Houdt.

## License

This project is licensed under the MIT License; see the `LICENSE` file.
