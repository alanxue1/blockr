# Blockr

A simple browser extension that blocks websites and tracks visit attempts with visual analytics.

## Features

- Block specific websites
- Visual analytics dashboard with charts
- Track daily blocked attempts
- Easy management interface

## Installation

1. Open in browser
2. Go to `arc://extensions/` or `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select this folder

## Usage

1. Click the extension icon
2. Add websites to block in "Manage Sites" tab
3. View analytics in "Stats" tab
4. Blocked sites will show a custom block page

## Files

- `manifest.json` - Extension configuration
- `background.js` - Background service worker
- `popup.html/js` - Extension popup interface
- `blocked.html` - Block page shown for blocked sites
- `chart.min.js` - Chart.js library for analytics

Built for Arc browser with full CSP compliance.
