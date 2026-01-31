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
            :root {
              -webkit-font-smoothing: antialiased;
            }
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100%;
              margin: 0;
              background-color: transparent;
            }
            .gif-wrapper {
              width: fit-content;
              height: fit-content;
              overflow: auto;
              display: inline-block;
            }
            img {
              display: block;
              width: auto;
              height: auto;
              max-width: none;
              max-height: none;
              image-rendering: pixelated;
              image-rendering: crisp-edges;
              -ms-interpolation-mode: nearest-neighbor;
              image-rendering: -moz-crisp-edges;
              image-rendering: -o-pixelated;
            }
          </style>
          <title>Lain</title>
        </head>
        <body>
          <div class="gif-wrapper"><img id="lain-gif" src="" alt="Lain" /></div>
          <script>
            const vscode = acquireVsCodeApi();
            const img = document.getElementById('lain-gif');
            const wrapper = document.querySelector('.gif-wrapper');
            let cycleTimeout;

            function requestNextGif() {
              if (cycleTimeout) {
                clearTimeout(cycleTimeout);
              }
              vscode.postMessage({ type: 'ready' });
            }

            // Ensure the wrapper uses the GIF's intrinsic size and does not scale it.
            img.addEventListener('load', () => {
              try {
                const w = img.naturalWidth || img.width;
                const h = img.naturalHeight || img.height;
                if (w && h) {
                  wrapper.style.width = w + 'px';
                  wrapper.style.height = h + 'px';
                }
              } catch (e) {
                // ignore
              }
            });

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
