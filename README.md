# TradingView Shortcuts

Custom keyboard shortcuts for TradingView. One keypress, no menus, no confirmations.

I scalp low timeframes and got tired of grabbing the mouse every time I wanted to flip from 1m to 5m or draw a rectangle. So now my left hand does it all: A is 1 minute, S is 5 minutes, Q pulls up the rectangle. That kind of thing.

## Install

Works on Chrome, Edge, Brave:

1. Open `chrome://extensions`
2. Turn on Developer mode (top right)
3. Click "Load unpacked" and select this folder
4. Open a TradingView chart, click the extension icon, set your keys

## How it works

Click the icon, hit Bind on anything, press a key. It saves on the spot and syncs through your Chrome profile.

Out of the box:

- `A` 1 minute · `S` 5 minutes · `D` 15 minutes · `F` 1 hour · `G` 4 hours · `H` 1 day
- `Q` rectangle · `W` trend line · `E` fib retracement · `R` horizontal line
- `T` long position · `Y` short position
- `M` magnet · `X` hide drawings · `L` lock drawings · `Shift+X` remove drawings
- `0` reset chart scale
- `←` `→` flip through your favorited timeframes

99 things are bindable in total: every timeframe down to 1 second, all the drawing tools, plus chart extras like symbol search and screenshots. Everything is rebindable, including all of the above.

## Worth knowing

- Shortcuts only fire when the chart has focus. Typing in the search box still just types.
- A bound key overrides whatever TradingView used it for. If something you relied on stops working, clear that bind.
- The arrow-key cycling uses your favorited intervals, so star a few in the timeframe menu first or there's nothing to cycle through.
- If TradingView ever redesigns a button out from under this and a shortcut can't land, you get a small toast saying so instead of silence.

## Under the hood

- `manifest.json` — MV3, only runs on tradingview.com chart pages
- `src/shared.js` — the full action list and key handling
- `src/tv-adapter.js` — finds and clicks the right TradingView buttons (favorites first, menu second, built-in hotkey as backup)
- `src/content.js` — listens for your keys, fires the action, shows the toast
- `src/popup.html/css/js` — the settings popup

No tracking, no network calls. The only permission is storage, so your binds can sync.
