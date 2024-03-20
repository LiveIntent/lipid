// ==UserScript==
// @name         LI Measurement Script
// @namespace    http://liveintent.com
// @version      2024-03-12-1
// @description  LiveIntent PCID Initialization and GAM Measurement Script
// @author       You
// @grant        none
// ==/UserScript==

(function() {
  // start liveintent module init and measurement v1.5
  const LI_PUBLISHER_ID = "INSERT PUBLISHER_ID HERE";
  const LI_DISTRIBUTOR_ID = undefined;
  const LOGGED_IN_USERS_EMAIL_OR_EMAIL_HASH = "";
  const LI_REPORTING_KEY = "li-module-enabled";
  const pbjs = (window.pbjs = window.pbjs || { que: [] });
  const googletag = (window.googletag = window.googletag || { cmd: [] });
  const LI_MODULE_ENABLED = Math.random() < 0.95;
  let bidsEnriched;
  
  function setTargeting(enriched, wonAll) {
    googletag.cmd.push(function () {
      let targeting = LI_MODULE_ENABLED ? "t1" : "t0";
      if(enriched!==undefined) targeting += enriched ? "-e1" : "-e0";
      if(wonAll!==undefined) targeting += wonAll ? "-wa" : "-ws";
      googletag.pubads().setTargeting(LI_REPORTING_KEY, targeting);
    });
  }
  
  setTargeting();
  
  pbjs.que.push(function () {
    if (LI_MODULE_ENABLED) {
      pbjs.mergeConfig({
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
    
    pbjs.onEvent("auctionInit", function (args) {
      bidsEnriched = args.adUnits && args.adUnits.some((au) => au.bids &&
        au.bids.some((b) => b.userIdAsEids && b.userIdAsEids.some((eid) => eid.source
        === "liveintent.com" || (eid.uids && eid.uids.some((uid) => uid.ext &&
        uid.ext.provider === "liveintent.com")))));
      setTargeting(bidsEnriched);
    });
    
    pbjs.onEvent("bidWon", function (args) {
      setTargeting(bidsEnriched, pbjs.getAllPrebidWinningBids().length === 0);
    });
  });
  // end liveintent module init and measurement
})();
