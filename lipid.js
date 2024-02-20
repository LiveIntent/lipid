// ==UserScript==
// @name         LIPID - LiveIntent Prebid Identity Debugger
// @version      2024-02-20
// @description  Diagnose configuration and environmental issues with LiveIntent's Prebid.js Identity Module
// @match        https://*/*
// @author       phillip@liveintent.com <Phillip Markert>
// @grant        none
// ==/UserScript==

(function() {
'use strict';
// start liveintent module init and measurement v1.3

// Set to false by default, or a number of milliseconds to override the auctionDelay
const OVERRIDE_AUCTION_DELAY = false; // 300;
const PREBID_WINDOW_PROPERTY_NAME = 'pbjs';

// A reasonable timeout for prebid to initialize
const PREBID_START_TIMEOUT = 5000;

let firstAuction = true;
const color = (bg, fg) => `display: inline-block; color: ${fg}; background: ${bg}; padding: 1px 4px; border-radius: 3px;`;
const label = (text, background, foreground) => ({ text, background, foreground, isLabel: true });
const lipidLabel = ["%cLIPID", color("blue", "orange")];
const log = (label, ...args) => {
  if(label.isLabel) {
    console.log(`${lipidLabel[0]}%c${label.text}`, lipidLabel[1], color(label.background, label.foreground), ...args);
  }
  else {
    console.log(...lipidLabel, label, ...args);
  }
};
log("LiveIntent Prebid Identity Debugger is active");

// This timeout checks to see if Prebid starts up and processes the queue
const auctionStart = window.setTimeout(() => {
  log(label("WARNING:", "yellow", "black"), `window.${PREBID_WINDOW_PROPERTY_NAME}.que did not get processed within a reasonable timeout (${PREBID_START_TIMEOUT}ms). Is Prebid running on the page? If so, check that the PREBID_WINDOW_PROPERTY_NAME constant configured in LIPID matches the name the publisher gave to the prebid global window property.`);
}, PREBID_START_TIMEOUT);

if(!!window[PREBID_WINDOW_PROPERTY_NAME]) log(label("WARNING:", 'red'), `window.${PREBID_WINDOW_PROPERTY_NAME} already exists. The LIPID script may not have been logged earlier config changes.`);


const pbjs = (window[PREBID_WINDOW_PROPERTY_NAME] = window[PREBID_WINDOW_PROPERTY_NAME] ?? { que: [] });
const bidWasEnriched = (bid) => bid.userIdAsEids?.some((eid) => eid.source === "liveintent.com" || eid.uids?.some((uid) => uid.ext?.provider === "liveintent.com"));
const moduleIsInstalled = () => pbjs.installedModules.includes("liveIntentIdSystem");
const moduleConfig = () => pbjs.getConfig().userSync.userIds?.find(module => module.name==="liveIntentId");
const fireLIMetric = (label, event) => log(label, { ...event, moduleConfig: moduleConfig(), moduleIsInstalled: moduleIsInstalled() });

pbjs.que.push(() => {
  // troubleshooting steps - Prebid Initialization
  window.clearTimeout(auctionStart); // Prebid was initialized, so clear the timeout.
  if(!moduleIsInstalled()) {
    log(label("ERROR:", "red"), "liveIntentIdSystem is not an installed module. Bids will not be enriched.");
  }
  // End troubleshooting steps

  pbjs.getConfig('userSync', ({ userSync }) => log("setConfig(userSync)", userSync));

  // Uncomment these lines to override auctionDelay
  if(OVERRIDE_AUCTION_DELAY!==false) {
    pbjs.cmd.push(() => {
      log(label("OVERRIDE:", "orange", "black"), `Overriding auction delay to ${OVERRIDE_AUCTION_DELAY}`);
      pbjs.setConfig({ userSync: { auctionDelay: OVERRIDE_AUCTION_DELAY}});
    });
  }

  pbjs.onEvent("auctionInit", (args) => {
    const auctionWasEnriched = args.bidderRequests.some(br => br.bids.some(bidWasEnriched));
    fireLIMetric(label("auctionInit", "green"), { auctionId: args.auctionId, enriched: auctionWasEnriched, auctionDelay: pbjs.getConfig().userSync.auctionDelay });

    // Troubleshooting steps
    const currentConfig = pbjs.getConfig();
    const currentModuleConfig = moduleConfig();
    if(firstAuction && currentConfig.userSync.auctionDelay===0) {
      log(label("WARNING:", "yellow", "black"), "userSync.auctionDelay is set to 0 at the start of the auction. Bids will not be enriched for the first auction on page, but may be for subsequent auctions");
      if(currentModuleConfig && currentModuleConfig.storage) {
        log(label("WARNING:", "yellow", "black"), "however, prebid storage IS configured on the liveIntentId module, so subsequent page views may still get first auctions enriched within the expiration period. Storage configuration -> ", currentModuleConfig.storage);
      }
    }
    else {
      if(currentModuleConfig && currentModuleConfig.storage) {
        log(label("WARNING:", "cyan", "black"), "userSync.auctionDelay is a non-zero value (which is good), but Prebid storage is also configured for the LiveIntent module which may reduce the effectiveness and freshness of the resolved ids compared to the built-in caching. It is recommended to remove the storage configuration.");
      }
    }
    firstAuction = false;
    if(!currentModuleConfig) {
      log(label("ERROR:", "red"), "liveIntentId module is not configured at the start of the auction. Bids will not be enriched.");
    }
    if(!auctionWasEnriched) {
      log(label("INFO:", "magenta", "white"), "This auction was not enriched. Either due to a mis-configuration, a timeout, or perhaps the user was just not resolved to have any identifiers.");
    }
  });

  pbjs.onEvent("auctionEnd", (args) => {
    const auctionWasEnriched = args.bidderRequests.some(br => br.bids.some(bidWasEnriched));
    const auctionTotalCpm = (pbjs.getHighestCpmBids()??[]).reduce((carry, bid) => carry + bid.cpm, 0);
    fireLIMetric(label("auctionEnd", "green"), { auctionId: args.auctionId, enriched: auctionWasEnriched, cpm: auctionTotalCpm });
  });

  pbjs.onEvent("adRenderSucceeded", ({ bid }) => {
    const winningBidWasEnriched = pbjs.getEvents().find(e => e.eventType==='auctionInit' && e.args.auctionId===bid.auctionId)?.args.bidderRequests.find(br => br.bidderCode===bid.bidderCode)?.bids.some(bidWasEnriched) ?? false;
    fireLIMetric(label("adRenderSucceeded", "green"), { auctionId: bid.auctionId, enriched: winningBidWasEnriched, bidId: bid.requestId, cpm: bid.cpm });
  });
});
    // end liveintent module init and measurement
})();

