import * as vscode from "vscode";

export interface GifInfo {
  name: string;
  isSpecial: boolean;
  duration?: number;
}

export class GifService {
  private readonly _baseGifs = ["lain-headbop.gif"];
  private _allGifs: string[] = [];
  private _foundBaseGifs: string[] = [];
  private _otherGifs: string[] = [];
  private _lastWasSpecial = false;
  private _baseCycledCount = 0;
  private _gifDurations: Map<string, number> = new Map();

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public async initialize(): Promise<void> {
    const gifsUri = vscode.Uri.joinPath(this._extensionUri, "assets", "gifs");
    try {
      const files = await vscode.workspace.fs.readDirectory(gifsUri);
      this._allGifs = files
        .filter(
          ([name, type]) =>
            type === vscode.FileType.File && name.endsWith(".gif"),
        )
        .map(([name]) => name);

      this._foundBaseGifs = this._baseGifs.filter((gif) =>
        this._allGifs.includes(gif),
      );

      this._otherGifs = this._allGifs.filter(
        (gif) => !this._foundBaseGifs.includes(gif),
      );

      // Pre-calculate durations
      for (const gifName of this._allGifs) {
        const uri = vscode.Uri.joinPath(gifsUri, gifName);
        const duration = await this._parseGifDuration(uri);
        this._gifDurations.set(gifName, duration);
      }
    } catch (error) {
      console.error("Failed to read GIFs directory:", error);
      this._allGifs = [];
      this._foundBaseGifs = [];
      this._otherGifs = [];
    }
  }

  private async _parseGifDuration(uri: vscode.Uri): Promise<number> {
    const FALLBACK_DURATION = 3000;
    try {
      const data = await vscode.workspace.fs.readFile(uri);
      if (data.length < 13) {
        return FALLBACK_DURATION;
      }

      // Check signature
      const signature = Buffer.from(data.slice(0, 6)).toString("ascii");
      if (signature !== "GIF89a" && signature !== "GIF87a") {
        return FALLBACK_DURATION;
      }

      let pos = 6;
      // Skip Logical Screen Descriptor
      const lsd = data.slice(pos, pos + 7);
      pos += 7;

      const hasGCT = (lsd[4] & 0x80) !== 0;
      if (hasGCT) {
        const gctSize = 3 * Math.pow(2, (lsd[4] & 0x07) + 1);
        pos += gctSize;
      }

      let totalDuration = 0;
      while (pos < data.length) {
        const blockType = data[pos++];
        if (blockType === 0x21) {
          // Extension
          const label = data[pos++];
          if (label === 0xf9) {
            // Graphic Control Extension
            const size = data[pos++];
            if (size === 4) {
              const delay = data[pos + 1] | (data[pos + 2] << 8);
              totalDuration += delay * 10; // Convert 1/100s to ms
              pos += size;
            } else {
              pos += size;
            }
            // Skip terminator
            while (pos < data.length && data[pos] !== 0) {
              pos += data[pos] + 1;
            }
            pos++;
          } else {
            // Other extension block
            while (pos < data.length && data[pos] !== 0) {
              const blockSize = data[pos];
              pos += blockSize + 1;
            }
            // Skip terminator
            pos++;
          }
        } else if (blockType === 0x2c) {
          // Image Descriptor
          pos += 8;
          const packed = data[pos++];
          const hasLCT = (packed & 0x80) !== 0;
          if (hasLCT) {
            const lctSize = 3 * Math.pow(2, (packed & 0x07) + 1);
            pos += lctSize;
          }
          // Skip Table Based Image Data
          pos++; // LZW minimum code size
          while (pos < data.length && data[pos] !== 0) {
            pos += data[pos] + 1;
          }
          pos++; // Terminator
        } else if (blockType === 0x3b) {
          // Trailer
          break;
        } else {
          // Unknown block or data we don't care about
          // This shouldn't really happen in a valid GIF
          break;
        }
      }

      return totalDuration > 0 ? totalDuration : FALLBACK_DURATION;
    } catch (e) {
      console.error(`Error parsing GIF duration for ${uri.fsPath}:`, e);
      return FALLBACK_DURATION;
    }
  }

  public getNextGif(): GifInfo {
    if (this._foundBaseGifs.length === 0 && this._otherGifs.length === 0) {
      return { name: this._baseGifs[0], isSpecial: false };
    }

    let gifName: string;
    let isSpecial = false;

    const rand = Math.random();
    // If last was special, we MUST pick a base gif.
    // If we've played 5 base gifs in a row, we MUST pick a special gif (if available).
    // Otherwise, 80% chance of base, 20% chance of special (if available).
    if (this._lastWasSpecial || this._foundBaseGifs.length === 0) {
      const index = Math.floor(Math.random() * this._foundBaseGifs.length);
      gifName = this._foundBaseGifs[index] || this._baseGifs[0];
      isSpecial = false;
    } else if (this._baseCycledCount >= 10 && this._otherGifs.length > 0) {
      const index = Math.floor(Math.random() * this._otherGifs.length);
      gifName = this._otherGifs[index];
      isSpecial = true;
    } else if (rand < 0.7 || this._otherGifs.length === 0) {
      const index = Math.floor(Math.random() * this._foundBaseGifs.length);
      gifName = this._foundBaseGifs[index] || this._baseGifs[0];
      isSpecial = false;
    } else {
      const index = Math.floor(Math.random() * this._otherGifs.length);
      gifName = this._otherGifs[index];
      isSpecial = true;
    }

    this._lastWasSpecial = isSpecial;
    if (isSpecial) {
      this._baseCycledCount = 0;
    } else {
      this._baseCycledCount++;
    }

    return {
      name: gifName,
      isSpecial,
      duration: this._gifDurations.get(gifName) || 3000,
    };
  }

  public getGifUri(webview: vscode.Webview, gifName: string): vscode.Uri {
    return webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "assets", "gifs", gifName),
    );
  }
}
