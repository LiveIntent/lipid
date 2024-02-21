# LIPID (LiveIntent Prebid Identity Debugger)
LIPID provides automated analysis and recommendations for LiveIntent's Prebid.js Identity Module.

To use LIPID, you will need to a user-scripts extension for your browser. This has only been tested with TamperMonkey in Chrome, but it may work with other user-script extensions as well.

Once your user-scripts extension is installed, import the lipid.js script using the raw github url. At this point, your extension should be able to check for and automatically load updates. 

Once the extension is loaded and enabled, the inspector console will show a variety of informational, warning, and error messages, all of which are prefixed with the tag `LIPID` to make filtering easy.

## Customing lipid config for a site
LIPID uses default configuration values such as the name of the prebid property on the global window object, or the name of the measurement reporting keys, etc. The default config settings and values can be seen near the top of the script. *These values can be modified on a per website basis and persisted to localStorage.*

The view the current lipid configuration, inspect `window.lipid.config`. Values on this object may be overridden as needed; to persist changes, call `window.lipid.storeConfig()` and then reload the page. To reset back to the default configuration, call `window.lipid.clearConfig()`.
