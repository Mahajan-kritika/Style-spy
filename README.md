# Style Spy

Style Spy is a Manifest V3 Chrome extension that reads visible computed colours and typography from the current HTTP(S) page. It keeps saved design kits in `chrome.storage.local` and exports CSS locally. It does not send page data anywhere and has no analytics or backend.

## Install in Chrome

1. Download or clone this project to a folder on your computer.
2. Open `chrome://extensions/`.
3. Turn on **Developer mode**.
4. Choose **Load unpacked** and select the project folder containing `manifest.json`.
5. Open an ordinary HTTP or HTTPS website and select the Style Spy toolbar icon.

After changing extension files, select **Reload** on its card at `chrome://extensions/`.

## Use

- The popup scans the current page when opened. Use the refresh icon to rescan after page content changes.
- **Colours** lists normalized HEX/RGB colours, ranked by visible usage. Select a swatch or value to copy it; **Copy all** copies the palette.
- **Fonts** lists common visible font-family/weight/size/line-height/text-colour combinations. Select a property or family chip to copy it.
- **Save current kit** prompts for a unique name. Kits include the source domain and creation date. Open one to apply it to the preview; rename, export, or delete it from **Saved kits**.
- **Copy complete CSS variables** copies variables generated from the current extraction. **Export** downloads a saved kit as a `.css` file.

## Project structure

```text
style-spy/
├── manifest.json
├── background.js
├── popup.html
├── popup.css
├── popup.js
├── scripts/
│   ├── css-exporter.js
│   └── extractor.js
└── utils/
    ├── clipboard.js
    └── storage.js
```

## Implementation notes and limitations

- The page extractor checks up to 12,000 DOM elements in short batches, and only counts elements with a non-zero box intersecting the current viewport. A large page may be capped; refresh after scrolling to inspect another viewport.
- Colour counts are computed-style occurrences (background, text, and border properties); percentages are relative to those occurrences. Gradients are reported separately and are not decomposed into stop colours.
- Font combinations are collected from visible elements with directly rendered text, then ranked by frequency. Browser/platform font substitution may affect computed values.
- Chrome internal pages, the Chrome Web Store, PDF viewers, and other browser-restricted pages cannot be inspected. The extension requests page access only after the toolbar action using `activeTab`; site-level restrictions and very early popup closure may also prevent clipboard/download actions.
- This environment did not provide a running Chrome extension installation, so manual end-to-end testing against five live websites and browser-restart persistence could not be claimed. The extension should be loaded in Chrome as above for that browser-level verification.
