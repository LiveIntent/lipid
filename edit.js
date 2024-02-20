// ==UserScript==
// @name         LIPID - LiveIntent Prebid Identity Debugger
// @version      2024-02-20
// @description  Diagnoses configuration and environmental issues with LiveIntent's Prebid.js Identity Module
// @match        https://*
// @author       phillip@liveintent.com <Phillip Markert>
// @grant        none
// ==/UserScript==

(function() {
'use strict';
// start liveintent module init and measurement v1.3

const color = (background, foreground) => `display: inline-block; color: ${foreground}; background: ${background}; padding: 1px 4px; border-radius: 3px;`;
const label = ["%cLiveIntent", color("blue", "orange")];
const tag = (text, background, foreground) => {
  return [label[0] + "%c" + text, label[1], color(background, foreground)];
}

console.log(...label, "Starting LIPID");
if(!!window.pbjs) console.log(...tag("WARNING:", 'red'), "window.pbjs ALREADY EXISTS!!");
const pbjs = (window.pbjs = window.pbjs ?? { que: [] });
const fireLIMetric = (eventName, event) => console.log(...tag(eventName, "green"), { ...event, moduleConfig: moduleConfig(), moduleIsInstalled: moduleIsInstalled() });
const bidWasEnriched = (bid) => bid.userIdAsEids?.some((eid) => eid.source === "liveintent.com" || eid.uids?.some((uid) => uid.ext?.provider === "liveintent.com"));
const moduleIsInstalled = () => pbjs.installedModules.includes("liveIntentIdSystem");
const moduleConfig = () => pbjs.getConfig().userSync.userIds?.find(module => module.name==="liveIntentId");

pbjs.que.push(() => {
  console.log(...label, "LIPID Callback");

  pbjs.getConfig('userSync', ({ userSync }) => console.log(...label, "setConfig(userSync)", userSync));
  // pbjs.setConfig({ userSync: { auctionDelay:300}});

  pbjs.onEvent("auctionInit", (args) => {
    const auctionWasEnriched = args.bidderRequests.some(br => br.bids.some(bidWasEnriched));
    fireLIMetric("auctionInit", { auctionId: args.auctionId, enriched: auctionWasEnriched, auctionDelay: pbjs.getConfig().userSync.auctionDelay });
  });

  pbjs.onEvent("auctionEnd", (args) => {
    const auctionWasEnriched = args.bidderRequests.some(br => br.bids.some(bidWasEnriched));
    const auctionTotalCpm = (pbjs.getHighestCpmBids()??[]).reduce((carry, bid) => carry + bid.cpm, 0);
    fireLIMetric("auctionEnd", { auctionId: args.auctionId, enriched: auctionWasEnriched, cpm: auctionTotalCpm });
  });

  pbjs.onEvent("adRenderSucceeded", ({ bid }) => {
    const winningBidWasEnriched = pbjs.getEvents().find(e => e.eventType==='auctionInit' && e.args.auctionId===bid.auctionId)?.args.bidderRequests.find(br => br.bidderCode===bid.bidderCode)?.bids.some(bidWasEnriched) ?? false;
    fireLIMetric("adRenderSucceeded", { auctionId: bid.auctionId, enriched: winningBidWasEnriched, bidId: bid.requestId, cpm: bid.cpm });
  });
});
    // end liveintent module init and measurement
})();
