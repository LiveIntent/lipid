// ==UserScript==
// @name         LI Measurement Script
// @namespace    http://liveintent.com
// @version      2024-07-10-1
// @description  LiveIntent PCID Initialization and GAM Measurement Script
// @author       phillip@liveintent.com
// @grant        none
// ==/UserScript==

(function () {
  // start liveintent module init and measurement v1.5.5
  const LI_REPORTING_KEY = "li-module-enabled";

  // Initialize ONE of the following values, but not both
  let LI_PUBLISHER_ID; // = your LiveIntent Publisher ID
  let LI_DISTRIBUTOR_ID; // = your LiveIntent Distributor ID (did-xxxx)

  // Initialize this value if the user is logged in
  let LOGGED_IN_USERS_EMAIL_OR_EMAIL_HASH; // = email or email hash of logged in user

  const pbjs = (window.pbjs = window.pbjs || { que: [] });
  const googletag = (window.googletag = window.googletag || { cmd: [] });

  const TREATMENT_RATE = 0.95;
  if (window.liModuleEnabled === undefined) {
    // To manage the control group selection externally, override the initialization of this value
    // true = treated group, false = control group.
    window.liModuleEnabled = Math.random() < TREATMENT_RATE;
    window.liTreatmentRate = TREATMENT_RATE;
  }

  let auctionsEnriched = {};

  function setTargeting(enriched) {
    googletag.cmd.push(function () {
      let targeting = window.liModuleEnabled ? "t1" : "t0";
      if (enriched !== undefined) targeting += enriched ? "-e1" : "-e0";
      googletag.pubads().setTargeting(LI_REPORTING_KEY, targeting);
    });
  }

  setTargeting();

  pbjs.que.push(function () {
    // Enable the module, only if the visit is in the treated group
    if (window.liModuleEnabled) {
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
                  thetradedesk: true,
                  sovrn: true,
                },
              },
              storage: {
                type: "html5",
                name: "__tamLIResolveResult",
                expires: 1,
              },
            },
          ],
        },
      });
    }

    pbjs.onEvent("auctionInit", function (args) {
      auctionsEnriched[args.auctionId] =
        args.adUnits &&
        args.adUnits.some(
          (au) =>
            au.bids &&
            au.bids.some(
              (b) =>
                b.userIdAsEids &&
                b.userIdAsEids.some(
                  (eid) =>
                    eid.source === "liveintent.com" ||
                    (eid.uids &&
                      eid.uids.some(
                        (uid) =>
                          uid.ext && uid.ext.provider === "liveintent.com"
                      ))
                )
            )
        );
      setTargeting(auctionsEnriched[args.auctionId]);
    });
  });
  // end liveintent module init and measurement
})();
