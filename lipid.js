// ==UserScript==
// @name         LIPID (LiveIntent Prebid Identity Debugger)
// @namespace    LiveIntent
// @homepage     https://github.com/LiveIntent/lipid
// @version      2024-02-21_2
// @description  Diagnose configuration and environmental issues with LiveIntent's Prebid.js Identity Module
// @match        https://*/*
// @author       phillip@liveintent.com <Phillip Markert>
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/LiveIntent/lipid/main/lipid.js
// @noframes     true
// @downloadURL  https://raw.githubusercontent.com/LiveIntent/lipid/main/lipid.js
// @grant        none
// ==/UserScript==

(function() {
'use strict';
  // start liveintent module init and measurement v1.3

  const DEFAULT_CONFIG = {
    override_auction_delay: false,
    prebid_window_property_name: 'pbjs',
    googletag_window_property_name: 'googletag',
    googletag_reporting_key: 'li-module-enabled',
    googletag_reporting_control_values: [ 'lcid0', 'off', 't0', 't0-e0', 't0-e0-ws', 't0-e0-wa' ],
    googletag_reporting_treated_values: [ 'lcid1', 'on', 't1', 't1-e0', 't1-e1', 't1-e0-ws', 't1-e0-wa', 't1-e1-ws', 't1-e1-wa' ],
    prebid_start_timeout: 5000,
    googletag_start_timeout: 5000
  };

  // Set to false by default, or a number of milliseconds to override the auctionDelay
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

  window.lipid = {
    storeConfig: () => {
      localStorage.setItem('LIPID', JSON.stringify(window.lipid.config));
      log('Stored config saved. Reload the page.')
    },
    clearConfig: () => {
      localStorage.removeItem('LIPID');
      log('Stored config reset. Reload the page.');
    }
  };
  const storedConfig = localStorage.getItem('LIPID');
  if(storedConfig) {
    window.lipid.config = JSON.parse(storedConfig);
    log("Loaded stored config overrides: ", window.lipid.config);
  }
  const config = (window.lipid.config = window.lipid.config ?? DEFAULT_CONFIG);


  // This timeout checks to see if Prebid starts up and processes the queue
  const auctionStart = window.setTimeout(() => {
    if(!window._pbjsGlobals?.includes?.(config.prebid_window_property_name)) {
      log(label("INFO:", "red", "white"), `window._pbjsGlobals (${window._pbjsGlobals}) does not match the configured lipid.config.prebid_window_property_name (${config.prebid_window_property_name}). To automatically update this value, run `, "lipid.config.prebid_window_property_name = window._pbjsGlobals[0]; lipid.storeConfig()", " and reload the page.");
    }
    else {
      log(label("WARNING:", "yellow", "black"), `window.${config.prebid_window_property_name}.que did not get processed within a reasonable timeout (${config.prebid_start_timeout}ms). Is Prebid running on the page? If so, check that config.prebid_window_property_name is configured in LIPID to match the name the publisher gave to the prebid global window property.`);
    }
  }, config.prebid_start_timeout);
  const googletagStart = window.setTimeout(() => {
    log(label("GAM SETUP:", "yellow", "black"), `window.${config.googletag_window_property_name}.cmd did not get processed within a reasonable timeout (${config.googletag_start_timeout}ms). Is googletag running on the page? If so, check that the config.googletag_window_property_name value matches the name of the googletag global window property.`);
  }, config.googletag_start_timeout);

  if(!!window[config.prebid_window_property_name]) log(label("WARNING:", 'red'), `window.${config.prebid_window_property_name} already exists. The LIPID script may not have been logged earlier config changes.`);

  const googletag = (window[config.googletag_window_property_name] = window[config.googletag_window_property_name] ?? { cmd: [] });
  const pbjs = (window[config.prebid_window_property_name] = window[config.prebid_window_property_name] ?? { que: [] });
  const bidWasEnriched = (bid) => bid.userIdAsEids?.some((eid) => eid.source === "liveintent.com" || eid.uids?.some((uid) => uid.ext?.provider === "liveintent.com"));
  const moduleIsInstalled = () => pbjs.installedModules.includes("liveIntentIdSystem");
  const moduleConfig = () => pbjs.getConfig().userSync.userIds?.find(module => module.name==="liveIntentId");
  const fireLIMetric = (label, event) => log(label, { ...event, moduleConfig: moduleConfig(), moduleIsInstalled: moduleIsInstalled() });

  googletag.cmd.push(() => {
    window.clearTimeout(googletagStart); // GoogleTag was initialized, so clear the timeout.
  });

  pbjs.que.push(() => {
    // troubleshooting steps - Prebid Initialization
    window.clearTimeout(auctionStart); // Prebid was initialized, so clear the timeout.
    if(!moduleIsInstalled()) {
      log(label("ERROR:", "red"), "liveIntentIdSystem is not an installed module. Bids will not be enriched.");
    }
    // End troubleshooting steps

    pbjs.getConfig('userSync', ({ userSync }) => log("setConfig(userSync)", userSync));

    // Uncomment these lines to override auctionDelay
    if(config.override_auction_delay!==false) {
      pbjs.cmd.push(() => {
        log(label("OVERRIDE:", "orange", "black"), `Overriding auction delay to ${config.override_auction_delay}`);
        pbjs.setConfig({ userSync: { auctionDelay: config.override_auction_delay}});
      });
    }

    pbjs.onEvent("auctionInit", (args) => {
      try {
        const auctionWasEnriched = args.bidderRequests.some(br => br.bids.some(bidWasEnriched));
        fireLIMetric(label("auctionInit", "green", "white"), { auctionId: args.auctionId, enriched: auctionWasEnriched, auctionDelay: pbjs.getConfig().userSync.auctionDelay });

        // Troubleshooting steps
        const currentConfig = pbjs.getConfig();
        const currentModuleConfig = moduleConfig();
        if(firstAuction) {
          if(currentConfig.userSync.auctionDelay===0) {
            log(label("WARNING:", "yellow", "black"), "userSync.auctionDelay is set to 0 at the start of the auction. Bids will not be enriched for the first auction on page, but may be for subsequent auctions");
            if(currentModuleConfig && currentModuleConfig.storage) {
              log(label("INFO:", "cyan", "black"), "however, prebid storage IS configured on the liveIntentId module, so subsequent page views may still get first auctions enriched within the expiration period. Storage configuration -> ", currentModuleConfig.storage);
            }
            else {
              log(label("WARNING:", "orange", "black"), "AND Prebid storage IS not configured on the liveIntentId module, so subsequent page views will also miss first auctions. Storage configuration -> ", currentModuleConfig);
            }
          }
          else {
            if(currentModuleConfig && currentModuleConfig.storage) {
              log(label("INFO:", "cyan", "black"), "userSync.auctionDelay is a non-zero value (which is good), but Prebid storage is also configured for the LiveIntent module which may reduce the effectiveness and freshness of the resolved ids compared to the built-in caching. It is recommended to remove the storage configuration.");
            }
          }
          if(!!currentModuleConfig) {
            if(!!currentModuleConfig.params.publisherId) {
              log(label("INFO:", "green", "white"), "Configured publisherId:", currentModuleConfig.params.publisherId);
              if(!!currentModuleConfig.params.distributorId) {
                log(label("WARN:", "orange", "white"), "Both publisherId and distributorId configured:", currentModuleConfig.params.publisherId, currentModuleConfig.params.distributorId);
              }
            }
            else if(!!currentModuleConfig.params.distributorId) {
              log(label("INFO:", "green", "white"), "Configured distributorId:", currentModuleConfig.params.distributorId);
            }
            else {
              log(label("ERROR:", "red", "white"), "No publisherId or distributorId is configured on the liveIntentId module", "Current params:", currentModuleConfig.params);
            }
          }
        }
        firstAuction = false;
        if(!currentModuleConfig) {
          log(label("ERROR:", "red"), "liveIntentId module is not configured at the start of the auction. Bids will not be enriched.");
        }
        if(!auctionWasEnriched) {
          log(label("INFO:", "magenta", "white"), "This auction was not enriched. Either due to a mis-configuration, a timeout, or perhaps the user was just not resolved to have any identifiers.");
        }
        if(!window.googletag) {
          log(label("GAM SETUP:", "orange", "white"), "window.googletag is not set. GAM Targeting does not appear to be enabled for this page.");
        }
        else {
          googletag.cmd.push(() => {
            try {
              const targetingKeys = window.googletag.pubads().getTargetingKeys();
              if(!targetingKeys.includes(config.googletag_reporting_key)) {
                log(label("GAM SETUP:", "yellow", "black"), `window.googletag.pubads().getTargetingKeys() does not contain the expected key '${config.googletag_reporting_key}'. Either the GOOGLETAG_REPORTING_KEY in LIPID does not match (did the publisher pick a custom reporting key?), or reporting was not properly enabled.`, "Available Targeting Keys", targetingKeys);
              }
              else {
                const liTargetingValue = window.googletag.pubads().getTargeting(config.googletag_reporting_key);
                if(liTargetingValue.length===0) {
                  log(label("GAM SETUP:", "orange", "white"), `window.googletag.pubads().getTargeting('${config.googletag_reporting_key}') is missing or empty. Targeting has not been set correctly.`);
                }
                else if(liTargetingValue.length>1) {
                  log(label("GAM SETUP:", "red", "white"), `window.googletag.pubads().getTargeting('${config.googletag_reporting_key}') contained multiple values. Targeting has not been set correctly.`, liTargetingValue);
                }
                else {
                  if(config.googletag_reporting_control_values.includes(liTargetingValue[0])) {
                    if(currentModuleConfig && currentConfig.userSync.syncEnabled!==false) {
                      log(label("GAM SETUP:", "red", "white"), `window.googletag.pubads().getTargeting('${config.googletag_reporting_key}') indicates CONTROL group, but module is enabled and active. The control group will be polluted if the auction is enriched.`, "Targeting value is", liTargetingValue);
                    }
                  }
                  else if(config.googletag_reporting_treated_values.includes(liTargetingValue[0])) {
                    if(!currentModuleConfig || currentConfig.userSync.syncEnabled===false) {
                      log(label("GAM SETUP:", "red", "white"), `window.googletag.pubads().getTargeting('${config.googletag_reporting_key}') indicates TREATED group, but module is not enabled or active. The test group will not be enriched and lowers the lift.`, "Targeting value is", liTargetingValue);
                    }
                  }
                  else {
                    log(label("GAM SETUP:", "red", "white"), `window.googletag.pubads().getTargeting('${config.googletag_reporting_key}') return a value (${liTargetingValue}) that was not expected for either the treated or control groups. If this value is expected, please add it to the control or treated values array in the lipid.config and reload the page.`);
                  }
                }
              }
            }
            catch (e) {
              log(label("LIPID EXCEPTION", "red", "white"), "Unhandled exception during auctionInit googletag evaluation", e);
            }
          });
        }
      }
      catch(e) {
        log(label("LIPID EXCEPTION", "red", "white"), "Unhandled exception during auctionInit", e);
      }
    });

    pbjs.onEvent("auctionEnd", (args) => {
      const auctionWasEnriched = args.bidderRequests.some(br => br.bids.some(bidWasEnriched));
      const auctionTotalCpm = (pbjs.getHighestCpmBids()??[]).reduce((carry, bid) => carry + bid.cpm, 0);
      fireLIMetric(label("auctionEnd", "green", "white"), { auctionId: args.auctionId, enriched: auctionWasEnriched, cpm: auctionTotalCpm });
    });

    pbjs.onEvent("adRenderSucceeded", ({ bid }) => {
      const winningBidWasEnriched = pbjs.getEvents().find(e => e.eventType==='auctionInit' && e.args.auctionId===bid.auctionId)?.args.bidderRequests.find(br => br.bidderCode===bid.bidderCode)?.bids.some(bidWasEnriched) ?? false;
      fireLIMetric(label("adRenderSucceeded", "green", "white"), { auctionId: bid.auctionId, enriched: winningBidWasEnriched, bidId: bid.requestId, cpm: bid.cpm });
    });
  });
    // end liveintent module init and measurement
})();

