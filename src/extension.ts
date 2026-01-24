import * as vscode from "vscode";
import { GifService } from "./gifService";

export async function activate(context: vscode.ExtensionContext) {
  const gifService = new GifService(context.extensionUri);
  await gifService.initialize();

  const provider = new LainViewProvider(context.extensionUri, gifService);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      LainViewProvider.viewType,
      provider,
    ),
  );
}

class LainViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "lain.view";

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _gifService: GifService,
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview();

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "ready": {
          this._updateGif();
          break;
        }
      }
    });
  }

  private _updateGif() {
    if (!this._view) {
      return;
    }

    const gifInfo = this._gifService.getNextGif();
    const gifUri = this._gifService.getGifUri(this._view.webview, gifInfo.name);

    // Cache busting to ensure GIF restarts from frame 0
    const uriWithTime = `${gifUri.toString()}?t=${Date.now()}`;

    this._view.webview.postMessage({
      type: "updateGif",
      uri: uriWithTime,
      isSpecial: gifInfo.isSpecial,
      duration: gifInfo.duration,
    });
  }

  private _getHtmlForWebview() {
    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<style>
					body {
						display: flex;
						justify-content: center;
						align-items: center;
						height: 100vh;
						margin: 0;
						overflow: hidden;
						background-color: transparent;
					}
					img {
						max-width: 100%;
						max-height: 100%;
						object-fit: contain;
					}
				</style>
				<title>Lain</title>
			</head>
			<body>
				<img id="lain-gif" src="" alt="Lain" />
				<script>
					const vscode = acquireVsCodeApi();
					const img = document.getElementById('lain-gif');
					let cycleTimeout;

					function requestNextGif() {
						if (cycleTimeout) {
							clearTimeout(cycleTimeout);
						}
						vscode.postMessage({ type: 'ready' });
					}
					
					window.addEventListener('message', event => {
						const message = event.data;
						switch (message.type) {
							case 'updateGif':
								img.src = message.uri;
								
								let nextDelay;
								if (message.isSpecial && message.duration) {
									nextDelay = message.duration;
								} else {
									nextDelay = Math.floor(Math.random() * 5000) + 5000;
								}
								
								cycleTimeout = setTimeout(requestNextGif, nextDelay);
								break;
						}
					});

					requestNextGif();
				</script>
			</body>
			</html>`;
  }
}
