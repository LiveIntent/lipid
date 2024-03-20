// ==UserScript==
// @name         LI Prebid Identity Initialization and Measurement Script
// @namespace    http://liveintent.com
// @version      1.6
// @description  Performs an a/b test for the LiveIntent prebid identity module and reports on the relative performance of each group.
// @author       phillip@liveintent.com <Phillip Markert>
// @homepage     https://github.com/LiveIntent/lipid
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  /* This script sets up an a/b test for the LiveIntentId module, reporting on the relative 
  performance of each group. The default behavior randomly selects 5% of visits to be in a 
  CONTROL group and only enables the module for the other 95% of visits (the TREATED group). 
  This a/b test selection logic can optionally be performed by an external process and connected 
  here by overriding the LI_MODULE_ENABLED value to match. If the external process also handles 
  configuring the LiveIntentId module (only when the TREATED group is selected!), then the 
  LI_CONFIGURE_MODULE value should be set to false. */

  // start liveintent module init and measurement script v1.6
  const LI_MODULE_ENABLED = Math.random() < 0.95; // Override w/ true = TREATED, false = CONTROL
  const LI_CONFIGURE_MODULE = true; // false if module is to be enabled by external process
  const LI_REPORTING_KEY = "li-module-enabled";

  const pbjs = (window.pbjs = window.pbjs || { que: [] });
  const googletag = (window.googletag = window.googletag || { cmd: [] });

  function configureLiveIntentIdModule() {
    if (LI_CONFIGURE_MODULE) {
      pbjs.mergeConfig({
        userSync: {
          /* 300 is recommended for the best combination of resolution/performance.
             If auctionDelay=0, then storage should be configured below. */
          auctionDelay: 300,

          userIds: [
            {
              name: "liveIntentId",
              params: {
                /* Specify either a publisherId or distributorId, but not both. */
                // publisherId: "INSERT PUBLISHER_ID HERE",
                // distributorId: "INSERT DISTRIBUTOR_ID HERE",

                /* If available, setting this will further improve resolution.
                   Leave as undefined, empty-string, or commented-out if not available. */
                // emailHash: "LOGGED IN USERS EMAIL OR EMAIL HASH",

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

              /* Storage should ONLY be configured if auctionDelay=0 */
              // storage: {
              //   expires: 1,
              //   name: "pbjs_li_nonid",
              //   type: "cookie"
              // }
            },
          ],
        },
      });
    }
  }

  function setTargeting(enriched, wonAll) {
    googletag.cmd.push(function () {
      // t1 = module enabled, t0 = module disabled
      let targeting = LI_MODULE_ENABLED ? "t1" : "t0";
      // e1 = enriched, e0 = not enriched
      if (enriched !== undefined) targeting += enriched ? "-e1" : "-e0";
      // wa = Prebid won all ad-slots, ws = Prebid won some ad-slots
      if (wonAll !== undefined) targeting += wonAll ? "-wa" : "-ws";
      googletag.pubads().setTargeting(LI_REPORTING_KEY, targeting);
    });
  }

  setTargeting(); // Only reports t value at first.
  const auctionsEnriched = {}; // Track enrichment per auctionId
  pbjs.que.push(() => {
    if (LI_MODULE_ENABLED) {
      configureLiveIntentIdModule();
    }

    pbjs.onEvent("auctionInit", function (args) {
      auctionsEnriched[args.auctionId ?? 0] = args.adUnits?.some((adUnit) =>
        adUnit.bids?.some((bid) =>
          bid.userIdAsEids?.some(
            (eid) =>
              eid.source === "liveintent.com" ||
              eid.uids?.some((uid) => uid.ext?.provider === "liveintent.com")
          )
        )
      );
      // Reports t and e values after auctionInit event.
      setTargeting(auctionsEnriched[args.auctionId]);
    });

    pbjs.onEvent("adRenderSucceeded", function (args) {
      // Reports t, e, and w values after adRenderSucceeded event.
      setTargeting(
        auctionsEnriched[args.bid.auctionId ?? 0],
        pbjs.getAllPrebidWinningBids().length === 0
      );
    });
  });
  // end liveintent module init and measurement script
})();
