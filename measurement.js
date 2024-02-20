// ==UserScript==
// @name         LI Measurement Script
// @namespace    http://liveintent.com
// @version      2024-02-14-1
// @description  LiveIntent PCID Initialization and GAM Measurement Script
// @author       You
// @grant        none
// ==/UserScript==

(function() {
'use strict';
// start liveintent module init and measurement v1.3
const LI_PUBLISHER_ID = "74318";
const LI_DISTRIBUTOR_ID = undefined;
const LOGGED_IN_USERS_EMAIL_OR_EMAIL_HASH = "";
const LI_REPORTING_KEY = "li-module-enabled";

const pbjs = (window.pbjs = window.pbjs ?? { que: [] });
const googletag = (window.googletag = window.googletag ?? { cmd: [] });

const LI_MODULE_ENABLED = true; //Math.random() < 0.95;
let bidsEnriched;

function setTargeting(enriched, wonAll) {
    googletag.cmd.push(function () {
        let targeting = LI_MODULE_ENABLED ? "t1" : "t0";
        if(enriched!==undefined) targeting += enriched ? "-e1" : "-e0";
        if(wonAll!==undefined) targeting += wonAll ? "-wa" : "-ws";
        googletag.pubads().setTargeting(LI_REPORTING_KEY, targeting);
        console.log(LI_REPORTING_KEY, targeting);
    });
}

setTargeting();

pbjs.que.push(function () {
  if (LI_MODULE_ENABLED) {
    pbjs.setConfig({
      userSync: {
        auctionDelay: 300,
        userIds: [
          {
            name: "liveIntentId",
            params: {
              publisherId: LI_PUBLISHER_ID,
              distributorId: LI_DISTRIBUTOR_ID,
              emailHash: LOGGED_IN_USERS_EMAIL_OR_EMAIL_HASH,
              requestedAttributesOverrides: {
                uid2: true,
                bidswitch: true,
                medianet: true,
                magnite: true,
                pubmatic: true,
                index: true,
                openx: true,
              },
            },
          },
        ],
      },
    });
  }

  function fireLIMetric(event) {
    console.log("fireLIMetric", event);
  }

  function wasEnriched(bid) {
    return bid.userIdAsEids.some((eid) => eid.source === "liveintent.com" || eid.uids?.some((uid) => uid.ext?.provider === "liveintent.com"));
  }

  pbjs.onEvent("auctionEnd", function (args) {
    console.log("auctionEnd", args);
    const auctionWasEnriched = args.bidderRequests.some(br => br.bids.some(wasEnriched));
    const auctionTotalCpm = (pbjs.getHighestCpmBids()??[]).reduce((carry, bid) => carry + bid.cpm, 0);
    fireLIMetric({ event: "auctionEnd", moduleEnabled: LI_MODULE_ENABLED, auctionId: args.auctionId, enriched: auctionWasEnriched, cpm: auctionTotalCpm });
    setTargeting(auctionWasEnriched);
  });

  pbjs.onEvent("adRenderSucceeded", function ({ bid }) {
    console.log("adRenderSucceeded", bid);
    const winningBidWasEnriched = pbjs.getEvents().find(e => e.eventType==='auctionInit' && e.args.auctionId===bid.auctionId)?.args.bidderRequests.find(br => br.bidderCode===bid.bidderCode)?.bids.some(wasEnriched) ?? false;
    fireLIMetric({ event: "adRenderSucceeded", moduleEnabled: LI_MODULE_ENABLED, auctionId: bid.auctionId, enriched: winningBidWasEnriched, bidId: bid.requestId, cpm: bid.cpm });
    setTargeting(winningBidWasEnriched, pbjs.getAllPrebidWinningBids().length === 0);
  });
});

    // end liveintent module init and measurement
})();
