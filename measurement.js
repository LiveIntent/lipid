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
  const pbjs = (window.pbjs = window.pbjs || { que: [] });

  pbjs.que.push(() => {
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

    const liModuleConfigured = pbjs.getConfig.userSync.userIds?.some(
      (m) => m.name === "liveIntentId"
    );

    // update window.liModule w/deep merge of defaults and capture as a constant to prevent updates
    const liModule = (window.liModule = Object.assign(
      {
        enabled: liModuleConfigured || Math.random() < 0.95,
        reportingKey: "li-module-enabled",
        auctionDelay: 300,
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
      },
      window.liModule
    ));

    // For legacy support
    window.liModuleEnabled = liModule.enabled;

    const configureLiveIntentModule = () => {
      pbjs.mergeConfig({
        userSync: {
          /* 300 is recommended for the best combination of resolution/performance.
             If auctionDelay=0, then storage should be configured below. */
          auctionDelay: liModule.auctionDelay,
          userIds: [
            Object.assign({
              name: "liveIntentId",
              params: liModule.params,
              storage: liModule.auctionDelay
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
    };
    if (liModule.enabled && !liModuleConfigured) {
      liModule.deferInit
        ? setTimeout(configureLiveIntentModule, 0)
        : configureLiveIntentModule();
    }

    setTargeting(); // Only reports the t value at first.

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
      // Reports t and e values after auctionInit event.
      setTargeting(liModule.auctionsEnriched[args.auctionId]);
    });

    pbjs.onEvent("adRenderSucceeded", function (args) {
      // Reports t, e, and w values after adRenderSucceeded event.
      setTargeting(
        liModule.auctionsEnriched[args.bid.auctionId ?? 0],
        pbjs.getAllPrebidWinningBids().length === 0
      );
    });
  });
  // end liveintent module init and measurement script
})();
