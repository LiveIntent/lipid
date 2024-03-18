// ==UserScript==
// @name         LIPID (LiveIntent Prebid Identity Debugger)
// @namespace    LiveIntent
// @homepage     https://github.com/LiveIntent/lipid
// @version      2024-03-18_1
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
  // lipid module init and measurement v2.0

  const DEFAULT_CONFIG = {
    prebid: {
      window_property_name: 'pbjs',
      start_timeout: 5000,
      override_auction_delay: false,
      use_cmd_vs_que: false,
    },
    googletag: {
      window_property_name: 'googletag',
      start_timeout: 5000,
      reporting_key: 'li-module-enabled',
      reporting_control_values: [ 'lcid0', 'off', 't0', 't0-e0', 't0-e0-ws', 't0-e0-wa' ],
      reporting_treated_values: [ 'lcid1', 'on', 't1', 't1-e0', 't1-e1', 't1-e0-ws', 't1-e0-wa', 't1-e1-ws', 't1-e1-wa' ],
    },
    version: 2
  };

  // Set to false by default, or a number of milliseconds to override the auctionDelay
  let firstAuction = true;
  const color = (bg, fg) => `display: inline-block; color: ${fg}; background: ${bg}; padding: 1px 4px; border-radius: 3px;`;
  const label = (text, background, foreground) => ({ text, background, foreground, isLabel: true });
  const lipidLabel = ["%cLIPID", color("#996622", "#222")];
  const level = {
    DEBUG: label('DEBUG:', 'purple', 'white'),
    EVENT: label('EVENT:', 'blue', 'white'),
    INFO: label('INFO:', 'green', 'white'),
    PROBLEM: label('PROBLEM:', 'yellow', 'black'),
    WARNING: label('WARNING:', 'orange', 'black'),
    ERROR: label('ERROR:', 'red', 'white')
  };
  const log = (label, ...args) => {
    window.lipid.log.push([label, ...args]);
    if(label.isLabel) {
      console.log(`${lipidLabel[0]}%c${label.text}`, lipidLabel[1], color(label.background, label.foreground), ...args);
    }
    else {
      console.log(...lipidLabel, label, ...args);
    }
  };

  window.lipid = {
    storeConfig: () => {
      localStorage.setItem('LIPID', JSON.stringify(window.lipid.config));
      log(level.DEBUG, 'Stored config saved. Reload the page.')
    },
    clearConfig: () => {
      localStorage.removeItem('LIPID');
      log(level.DEBUG, 'Stored config reset. Reload the page.');
    },
    log: []
  };

  log(level.DEBUG, "LiveIntent Prebid Identity Debugger is active");

  const storedConfig = localStorage.getItem('LIPID');
  if(storedConfig) {
    const parsedConfig = JSON.parse(storedConfig);
    if(parsedConfig.version !== DEFAULT_CONFIG.version) {
      log(level.PROBLEM, "Your custom stored lipid config is from an older, incompatible version. This configuration will be ignored and the default will be used.");
    }
    else {
      window.lipid.config = parsedConfig;
      log(level.DEBUG, "Loaded stored config overrides: ", window.lipid.config);
    }
  }
  const config = (window.lipid.config = window.lipid.config ?? DEFAULT_CONFIG);

  let existingTargetingValue = [];

  // This timeout checks to see if Prebid starts up and processes the queue
  const auctionStart = window.setTimeout(() => {
    if(!window._pbjsGlobals?.includes?.(config.prebid.window_property_name)) {
      log(level.PROBLEM, `window._pbjsGlobals (${window._pbjsGlobals}) does not match the configured lipid.config.prebid.window_property_name (${config.prebid.window_property_name}). To automatically update this value, run `, "lipid.config.prebid_window_property_name = window._pbjsGlobals[0]; lipid.storeConfig()", " and reload the page.");
    }
    else {
      log(level.PROBLEM, `window.${config.prebid.window_property_name}.que did not get processed within a reasonable timeout (${config.prebid.start_timeout}ms). Is Prebid running on the page? If so, check that config.prebid.window_property_name is configured in LIPID to match the name the publisher gave to the prebid global window property.`);
    }
  }, config.prebid.start_timeout);
  const googletagStart = window.setTimeout(() => {
    log(level.PROBLEM, `window.${config.googletag.window_property_name}.cmd did not get processed within a reasonable timeout (${config.googletag.start_timeout}ms). Is googletag running on the page? If so, check that the config.googletag.window_property_name value matches the name of the googletag global window property. Without this, some lipid reporting may be incorrect about CONTROL vs. TREATED groups.`);
  }, config.googletag.start_timeout);

  if(!!window[config.prebid.window_property_name]) {
    log(level.PROBLEM, `window.${config.prebid.window_property_name} already exists before LIPID was loaded. LIPID may not have logged earlier config changes or events.`);
  }


  const googletag = (window[config.googletag.window_property_name] = window[config.googletag.window_property_name] ?? { cmd: [] });
  const pbjs = (window[config.prebid.window_property_name] = window[config.prebid.window_property_name] ?? { que: [], cmd: [] });
  const bidWasEnriched = (bid) => bid.userIdAsEids?.some((eid) => eid.source === "liveintent.com" || eid.uids?.some((uid) => uid.ext?.provider === "liveintent.com"));
  const moduleIsInstalled = () => pbjs.installedModules.includes("liveIntentIdSystem");
  const moduleConfig = () => pbjs.getConfig().userSync.userIds?.find(module => module.name==="liveIntentId");
  const fireLIMetric = (eventName, event) => log(level.EVENT, eventName, { ...event, moduleConfig: moduleConfig(), moduleIsInstalled: moduleIsInstalled() });
  let moduleEverConfigured = false;
  let moduleStorageEverConfigured = false;

  googletag.cmd.push(() => {
    window.clearTimeout(googletagStart); // GoogleTag was initialized, so clear the timeout.
    window.setInterval(() => {
      const liTargetingValue = window.googletag.pubads().getTargeting(config.googletag.reporting_key);
      if (existingTargetingValue.length!=liTargetingValue.length || existingTargetingValue.some((a,i) => a!==liTargetingValue[i])) {
        log(level.INFO, `Targeting value is set to ${liTargetingValue}`);
        existingTargetingValue = liTargetingValue;
      }
    }, 1000);
  });

  const hookQ = config.prebid.use_cmd_vs_que ? 'cmd' : 'que';
  const hookF = pbjs[hookQ].push.toString().match(/native/) ? 'unshift' : 'push';
  log(level.DEBUG, `Hooking ${config.prebid.window_property_name}.${hookQ}.${hookF}`);

  pbjs[hookQ][hookF](() => {
    // troubleshooting steps - Prebid Initialization
    window.clearTimeout(auctionStart); // Prebid was initialized, so clear the timeout.
    if(!moduleIsInstalled()) {
      log(level.ERROR, "liveIntentIdSystem is not an installed module. Bids will not be enriched.");
    }
    // End troubleshooting steps

    pbjs.getConfig('userSync', ({ userSync }) => {
      log(level.INFO, "setConfig(userSync)", userSync);
      let newModuleConfig = userSync.userIds?.find(module => module.name === "liveIntentId");
      if(moduleEverConfigured && !newModuleConfig) {
        log(level.WARNING, "LiveIntent module is not in the updated configuration, but previously had been on this page. Removing the userId module may not have the intended effect and the module may have already affected the auctions before this point");
      }
      if(moduleStorageEverConfigured && newModuleConfig && !newModuleConfig.storage) {
        log(level.WARNING, "LiveIntent module does not have storage configured in the updated configuration, but previously had storage configured on this page. Removing the storageConfiguration from the userId module may not have the intended effect and IDs may have already been resolved/stored.");
      }
      if(!!newModuleConfig) moduleEverConfigured = true;
      if(!!newModuleConfig?.storage) moduleStorageEverConfigured = true;
    });
    log(level.INFO, "Initial prebid configuration", pbjs.getConfig());

    // Uncomment these lines to override auctionDelay
    if(config.prebid.override_auction_delay!==false) {
      // NOTE: push to cmd from que callback in an attempt to be last processed and avoid being overwritten by other init scripts. We want this to be done as late in the init sequence as possible.
      pbjs.cmd.push(() => {
        log(level.DEBUG, `Overriding auction delay to ${config.prebid.override_auction_delay}`);
        pbjs.setConfig({ userSync: { auctionDelay: config.prebid.override_auction_delay}});
      });
    }

    pbjs.onEvent("auctionInit", (args) => {
      try {
        const auctionWasEnriched = args.bidderRequests.some(br => br.bids.some(bidWasEnriched));
        fireLIMetric("auctionInit", { auctionId: args.auctionId, enriched: auctionWasEnriched, auctionDelay: pbjs.getConfig().userSync.auctionDelay });

        // Troubleshooting steps
        const currentConfig = pbjs.getConfig();
        const currentModuleConfig = moduleConfig();
        if(firstAuction) {
          if(currentConfig.userSync.auctionDelay===0) {
            log(level.WARNING, "userSync.auctionDelay is set to 0 at the start of the auction. Bids will not be enriched for the first auction on page, but may be for subsequent auctions");
            if(currentModuleConfig && currentModuleConfig.storage) {
              log(level.INFO, "however, prebid storage IS configured on the liveIntentId module, so subsequent page views may still get first auctions enriched within the expiration period. Storage configuration -> ", currentModuleConfig.storage);
            }
            else {
              log(level.WARNING, "AND Prebid storage IS not configured on the liveIntentId module, so subsequent page views will also miss first auctions. Storage configuration -> ", currentModuleConfig);
            }
          }
          else {
            if(currentModuleConfig && currentModuleConfig.storage) {
              log(level.INFO, "userSync.auctionDelay is a non-zero value (which is good), but Prebid storage is also configured for the LiveIntent module which may reduce the effectiveness and freshness of the resolved ids compared to the built-in caching. It is recommended to remove the storage configuration.");
            }
          }
          if(!!currentModuleConfig) {
            if(!!currentModuleConfig.params.publisherId) {
              log(level.INFO, "Configured publisherId:", currentModuleConfig.params.publisherId);
              if(!!currentModuleConfig.params.distributorId) {
                log(level.WARNING, "Both publisherId and distributorId configured:", currentModuleConfig.params.publisherId, currentModuleConfig.params.distributorId);
              }
            }
            else if(!!currentModuleConfig.params.distributorId) {
              log(level.INFO, "Configured distributorId:", currentModuleConfig.params.distributorId);
            }
            else {
              log(level.ERROR, "No publisherId or distributorId is configured on the liveIntentId module", "Current params:", currentModuleConfig.params);
            }
          }
          googletag.cmd.push(() => {
            const currentModuleConfig = moduleConfig();
            const currentConfig = pbjs.getConfig();
            try {
              const targetingKeys = window.googletag.pubads().getTargetingKeys();
              if(!targetingKeys.includes(config.googletag.reporting_key)) {
                log(level.WARNING, `window.googletag.pubads().getTargetingKeys() does not contain the expected key '${config.googletag.reporting_key}'. Either the config.googletag.reporting_key in LIPID does not match (did the publisher pick a custom reporting key?), or reporting was not properly enabled.`, "Available Targeting Keys", targetingKeys);
              }
              else {
                const liTargetingValue = window.googletag.pubads().getTargeting(config.googletag.reporting_key);
                if(liTargetingValue.length===0) {
                  log(level.WARNING, `window.googletag.pubads().getTargeting('${config.googletag.reporting_key}') is missing or empty. Targeting has not been set correctly.`);
                }
                else if(liTargetingValue.length>1) {
                  log(level.ERROR, `window.googletag.pubads().getTargeting('${config.googletag.reporting_key}') contained multiple values. Targeting has not been set correctly.`, liTargetingValue);
                }
                else {
                  if(config.googletag.reporting_control_values.includes(liTargetingValue[0])) {
                    if(currentModuleConfig && currentConfig.userSync.syncEnabled!==false) {
                      log(level.ERROR, `window.googletag.pubads().getTargeting('${config.googletag.reporting_key}') indicates CONTROL group, but module is enabled and active. The control group will be polluted if the auction is enriched.`, "Targeting value is", liTargetingValue);
                    }
                    else if(auctionWasEnriched) {
                      log(level.ERROR, `window.googletag.pubads().getTargeting('${config.googletag.reporting_key}') indicates CONTROL group, but auction was enriched. The control group was polluted.`, "Targeting value is", liTargetingValue);
                    }
                    else {
                      log(level.INFO, `User is in the CONTROL group. Auction was purposefully not enriched. Targeting value is ${liTargetingValue}`);
                    }
                  }
                  else if(config.googletag.reporting_treated_values.includes(liTargetingValue[0])) {
                    if(!currentModuleConfig) {
                      log(level.ERROR, "liveIntentId module is not configured at the start of the auction. Bids will not be enriched.");
                    }
                    if(!auctionWasEnriched) {
                      log(level.WARNING, "This auction was not enriched. Either due to a mis-configuration, a timeout, or perhaps the user was just not resolved to have any identifiers.");
                    }
                    if(!currentModuleConfig || currentConfig.userSync.syncEnabled===false) {
                      log(level.ERROR, `window.googletag.pubads().getTargeting('${config.googletag.reporting_key}') indicates TREATED group, but module is not enabled or active. The test group will not be enriched and lowers the lift.`, "Targeting value is", liTargetingValue);
                    }
                    else {
                      log(level.INFO, `User is in the TREATED group. Targeting value is ${liTargetingValue}`);
                    }
                  }
                  else {
                    log(level.ERROR, `window.googletag.pubads().getTargeting('${config.googletag.reporting_key}') returned a value (${liTargetingValue}) that was not expected for either the treated or control groups. If this value is expected, please add it to the control or treated values array in the lipid.config and reload the page.`);
                  }
                }
              }
            }
            catch (e) {
              log(level.ERROR, "Unhandled exception during auctionEnd googletag evaluation", e);
            }
          });
        }
        firstAuction = false;
      }
      catch(e) {
        log(level.PROBLEM, "Unhandled exception during auctionInit", e);
      }
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

