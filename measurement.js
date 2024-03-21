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
  // start liveintent module init and measurement script v1.6
  const pbjs = (window.pbjs = window.pbjs || { cmd: [] });

  pbjs.cmd.push(() => {
    const userSync = pbjs.getConfig().userSync;
    // Is the module already configured
    const liModuleConfigured = userSync.userIds?.some(
      (m) => m.name === "liveIntentId"
    );

    /* 
     Configuration Phase: Determines group (control vs. treated) and configures appropriately
     There are three options for how to determine the group:
     Option A: via window.liModule.enabled or window.liModuleEnabled (if set)
     Option B: random selection based upon window.liModule.testPercentage (if set)
     Option C: automatically if liveIntent module is configured in prebid userSync
    */

    // update window.liModule w/deep merge of defaults and capture as a constant to prevent updates
    const liModule = (window.liModule = Object.assign(
      {
        enabled:
          window.liModuleEnabled ?? window.liModule.testPercentage
            ? // normalize testPercentage to a number between 0 and 1
              Math.random() <
              (window.liModule.testPercentage < 1
                ? window.liModule.testPercentage
                : window.liModule.testPercentage / 100)
            : liModuleConfigured,
        params: Object.assign(
          {
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
          window.liModule.params
        ),
        reportingKey: "li-module-enabled",
        auctionsEnriched: {},
      },
      window.liModule
    ));
    // Legacy support
    window.liModuleEnabled = liModule.enabled;

    if (liModule.enabled && !liModuleConfigured) {
      liModule.deferInit
        ? setTimeout(configureLiveIntentModule, 0)
        : configureLiveIntentModule();
    }

    function configureLiveIntentModule() {
      pbjs.mergeConfig({
        userSync: {
          userIds: [
            Object.assign({
              name: "liveIntentId",
              params: liModule.params,
              storage: userSync.auctionDelay
                ? undefined
                : {
                    expires: 1,
                    name: "pbjs_li_nonid",
                    type: "cookie",
                  },
            }),
          ],
        },
      });
    }

    // Reporting Phase: Reports the group and performance of the module
    const googletag = (window.googletag = window.googletag || { cmd: [] });

    function setTargeting(enriched, wonAll) {
      googletag.cmd.push(function () {
        // t1 = module enabled, t0 = module disabled
        let targeting = liModule.enabled ? "t1" : "t0";
        // e1 = enriched, e0 = not enriched
        if (enriched !== undefined) targeting += enriched ? "-e1" : "-e0";
        // wa = Prebid won all ad-slots, ws = Prebid won some ad-slots
        if (wonAll !== undefined) targeting += wonAll ? "-wa" : "-ws";
        googletag.pubads().setTargeting(liModule.reportingKey, targeting);
      });
    }

    setTargeting();

    pbjs.onEvent("auctionInit", function (args) {
      liModule.auctionsEnriched[args.auctionId ?? 0] = args.adUnits?.some(
        (adUnit) =>
          adUnit.bids?.some((bid) =>
            bid.userIdAsEids?.some(
              (eid) =>
                eid.source === "liveintent.com" ||
                eid.uids?.some((uid) => uid.ext?.provider === "liveintent.com")
            )
          )
      );
      setTargeting(liModule.auctionsEnriched[args.auctionId]);
    });

    pbjs.onEvent("adRenderSucceeded", function (args) {
      setTargeting(
        liModule.auctionsEnriched[args.bid.auctionId ?? 0],
        pbjs.getAllPrebidWinningBids().length === 0
      );
    });
  });
  // end liveintent module init and measurement script
})();
