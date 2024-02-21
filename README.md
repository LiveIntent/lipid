# LIPID (LiveIntent Prebid Identity Debugger)
LIPID provides automated analysis and recommendations for LiveIntent's Prebid.js Identity Module.

To use LIPID, you will need to a user-scripts extension for your browser. This has only been tested with TamperMonkey in Chrome, but it may work with other user-script extensions as well.

Once your user-scripts extension is installed, import the lipid.js script using the raw github url. At this point, your extension should be able to check for and automatically load updates. 

Once the extension is loaded and enabled, the inspector console will show a variety of informational, warning, and error messages, all of which are prefixed with the tag `LIPID` to make filtering easy.
