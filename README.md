# Lain VS Code Extension

A VS Code extension that showcases Lain GIFs in the IDE, providing a companion-like experience similar to VS Code pets.

## Features

- Displays Lain GIFs in the Explorer sidebar.
- Weighted random selection of GIFs to keep the experience fresh.
- Dynamic duration detection for smooth transitions.

## Local Installation

To install the extension locally for development or personal use, follow these steps:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/gabriquaranta/lain-vscode.git
   cd lain-vscode
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Package the extension**:
   Use the VS Code Extension Manager to package the extension into a `.vsix` file:
   ```bash
   npx @vscode/vsce package
   ```

4. **Install from VSIX**:
   - Open Visual Studio Code.
   - Go to the **Extensions** view (`Ctrl+Shift+X`).
   - Click on the **...** (More Actions) menu in the top right corner of the Extensions view.
   - Select **Install from VSIX...**.
   - Browse to the generated `.vsix` file and select it.
