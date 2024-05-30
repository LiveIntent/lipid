// ==UserScript==
// @name         LIPID (LiveIntent Prebid Identity Debugger)
// @namespace    LiveIntent
// @homepage     https://github.com/LiveIntent/lipid
// @version      2024-05-28_1
// @description  Diagnose configuration and environmental issues with LiveIntent's Prebid.js Identity Module
// @match        https://*/*
// @author       phillip@liveintent.com <Phillip Markert>
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/LiveIntent/lipid/main/lipid.js
// @noframes     true
// @downloadURL  https://raw.githubusercontent.com/LiveIntent/lipid/main/lipid.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";
  const DEFAULT_CONFIG = {
    prebid: {
      // The name of the global window property that Prebid.js is installed on.
      window_property_name: "pbjs",
      // The time in milliseconds to wait for Prebid to start up and process the queue
      start_timeout: 5000,
      // Attempt to override the auctionDelay to a specific value. Set to false to disable this feature.
      override_auction_delay: false,
      // Override to use prebid.cmd instead of prebid.que (for publishers who reset the que)
      use_cmd_vs_que: false,
    },
    googletag: {
      // The name of the global window property that googletag is installed on.
      window_property_name: "googletag",
      // The time in milliseconds to wait for googletag to start up and process the queue
      start_timeout: 5000,
      // The time in milliseconds to poll for the reporting key value from googletag
      polling_interval: 1000,
      // The reporting key that is used to indicate the user's group in the experiment
      reporting_key: "li-module-enabled",
      // The values that indicate the user is in the control group
      reporting_control_values: [
        "lcid0",
        "off",
        "t0",
        "t0-e0",
        "t0-e1",
        "t0-e0-ws",
        "t0-e0-wa",
        "t0-e1-ws",
        "t0-e1-wa",
      ],
      // The values that indicate the user is in the treated group
      reporting_treated_values: ["lcid1", "on", "t1", "t1-e0", "t1-e1", "t1-e0-ws", "t1-e0-wa", "t1-e1-ws", "t1-e1-wa"],
      // Set to true (CONTROL) or false (TREATED) to override the control group setting to allow lipid to do analysis
      // even if the reporting values are not set properly on the page. Leave as undefined to use the page-level setting.
      override_control_group: undefined,
    },
    // The version of the configuration. This is used to detect incompatible stored configurations.
    version: 3,
  };

  let firstAuction = true; // Some warnings are only relevant for the first auction
  // Styled logging with labels
  const color = (bg, fg) =>
    `display: inline-block; color: ${fg}; background: ${bg}; padding: 1px 4px; border-radius: 3px;`;
  const lipidLabel = ["%cLIPID", color("#996622", "#222")];
  const label = (text, background, foreground) => ({
    text,
    background,
    foreground,
    isLabel: true,
  });
  const level = {
    DEBUG: label("DEBUG:", "purple", "white"),
    EVENT: label("EVENT:", "blue", "white"),
    INFO: label("INFO:", "green", "white"),
    LIPID: label("LIPID:", "yellow", "black"),
    WARNING: label("WARNING:", "orange", "black"),
    ERROR: label("ERROR:", "red", "white"),
  };
  const log = (label, ...args) => {
    // Keep all messages in an array for easy access if the console is littered with other messages
    window.lipid.log.push([label, ...args]);
    if (label.isLabel) {
      console.log(`${lipidLabel[0]}%c${label.text}`, lipidLabel[1], color(label.background, label.foreground), ...args);
    } else {
      console.log(...lipidLabel, label, ...args);
    }
  };

  // API for Lipid stored on the window object
  window.lipid = {
    storeConfig: () => {
      localStorage.setItem("LIPID", JSON.stringify(window.lipid.config));
      log(level.DEBUG, "Stored config saved. Reload the page to apply.");
    },
    clearConfig: () => {
      localStorage.removeItem("LIPID");
      log(level.DEBUG, "Stored config reset. Reload the page to apply.");
    },
    log: [], // Just for convenience to find all messages in the console
  };

  log(level.DEBUG, "LiveIntent Prebid Identity Debugger is active");

  // Retrieve stored config from localStorage or fallback to DEFAULT_CONFIG
  const storedConfig = localStorage.getItem("LIPID");
  if (storedConfig) {
    const parsedConfig = JSON.parse(storedConfig);
    if (parsedConfig.version !== DEFAULT_CONFIG.version) {
      log(
        level.LIPID,
        "Your custom stored lipid config is from an older, incompatible version. This configuration will be ignored and the default will be used."
      );
    } else {
      window.lipid.config = parsedConfig;
      log(level.DEBUG, "Loaded stored config overrides: ", window.lipid.config);
    }
  }
  const config = (window.lipid.config = window.lipid.config ?? DEFAULT_CONFIG);

  if (config.googletag.override_control_group !== undefined) {
    log(
      level.LIPID,
      `NOTE: Control group reporting is overridden via config to ${
        config.googletag.override_control_group ? "CONTROL" : "TREATED"
      }. This is to allow lipid to continue analysis even when reporting values are not properly set. If this overridden value does not match the actual page-level setting, you will see incorrect messages from lipid.`
    );
  }

  // Use a timeout to check if Prebid and GoogleTag start up and processes the queue
  const auctionStart = window.setTimeout(() => {
    if (!window._pbjsGlobals) {
      log(level.ERROR, `window._pbjsGlobals is not set is Prebid.js installed on the page?`);
    } else if (!window._pbjsGlobals?.includes?.(config.prebid.window_property_name)) {
      log(
        level.LIPID,
        `window._pbjsGlobals (${window._pbjsGlobals}) does not include the configured lipid.config.prebid.window_property_name (${config.prebid.window_property_name}). To automatically update this value, run `,
        "lipid.config.prebid.window_property_name = window._pbjsGlobals[0]; lipid.storeConfig()",
        " and reload the page."
      );
    } else {
      log(
        level.LIPID,
        `window.${config.prebid.window_property_name}.que did not get processed within a reasonable timeout (${config.prebid.start_timeout}ms). Is Prebid running on the page? If so, check that config.prebid.window_property_name is configured in LIPID to match the name the publisher gave to the prebid global window property.`
      );
    }
  }, config.prebid.start_timeout);
  const googletagStart = window.setTimeout(() => {
    log(
      level.LIPID,
      `window.${config.googletag.window_property_name}.cmd did not get processed within a reasonable timeout (${config.googletag.start_timeout}ms). Is googletag running on the page? If so, check that the config.googletag.window_property_name value matches the name of the googletag global window property. Without this, some lipid reporting may be incorrect about CONTROL vs. TREATED groups.`
    );
  }, config.googletag.start_timeout);

  // Use the configured window property names to find the prebid and googletag instances (or create them)
  const googletag = (window[config.googletag.window_property_name] = window[config.googletag.window_property_name] ?? {
    cmd: [],
  });
  const pbjs = (window[config.prebid.window_property_name] = window[config.prebid.window_property_name] ?? {
    que: [],
    cmd: [],
  });

  // Utility functions
  const eidBelongsToLiveIntent = (eid) =>
    eid.source === "liveintent.com" || eid.uids?.some((uid) => uid.ext?.provider === "liveintent.com");
  const bidWasEnriched = (bid) => bid.userIdAsEids?.some(eidBelongsToLiveIntent);
  const moduleIsInstalled = () => pbjs.installedModules.includes("liveIntentIdSystem");
  const moduleConfig = () => pbjs.getConfig().userSync.userIds?.find((module) => module.name === "liveIntentId");
  const fireLIMetric = (eventName, event) =>
    log(level.EVENT, eventName, {
      ...event,
      moduleConfig: moduleConfig(),
      moduleIsInstalled: moduleIsInstalled(),
    });

  // Necessary to prevent quantum tunneling where an object is logged to the Chrome console,
  // but then the object is updated asynchronously before Chrome has a chance to display it.
  const snapshot = (obj) => JSON.parse(JSON.stringify(obj));

  // Enables checking for unconfiguration later in the page lifecycle
  let moduleEverConfigured = false;
  let moduleStorageEverConfigured = false;

  // Use a polling loop to monitor the targeting value (since no callback API exists)
  // Lower the config.googletag.polling_interval if you think you are missing some intermediate values
  let existingTargetingValue = [];
  googletag.cmd.push(() => {
    window.clearTimeout(googletagStart); // GoogleTag was initialized, so clear the timeout.
    window.setInterval(() => {
      const liTargetingValue = window.googletag.pubads().getTargeting(config.googletag.reporting_key);
      if (
        existingTargetingValue.length != liTargetingValue.length ||
        existingTargetingValue.some((a, i) => a !== liTargetingValue[i])
      ) {
        log(level.INFO, `Targeting value is set to ${liTargetingValue}`);
        existingTargetingValue = liTargetingValue;
      }
    }, config.googletag.polling_interval);
  });

  // Hook into the Prebid init sequence to measure and log events
  const hookQ = config.prebid.use_cmd_vs_que ? "cmd" : "que";
  // If prebid has already processed the que, we must use .push(),
  // otherwise, use unshift() to be as early in the init processing as possible
  const prebidQueAlreadyProcessed = !pbjs[hookQ].push.toString().match(/native/);
  if (prebidQueAlreadyProcessed) {
    log(
      level.LIPID,
      `Prebid has already processed the ${hookQ} queue. LIPID may not have logged earlier config changes or events.`
    );
  }
  const hookF = prebidQueAlreadyProcessed ? "push" : "unshift";

  const lipidHook = () => {
    window.clearTimeout(auctionStart); // Prebid was initialized, so clear the timeout.
    // TODO - find hook and then check all previous ones for emitPrebidConfig
    if (pbjs[hookQ].length === 0 || pbjs[hookQ][0].name !== "lipidHook") {
      log(
        level.LIPID,
        "LIPID hook was not the first in the queue. LIPID may not have logged earlier config changes or events."
      );
    }
    const initialModuleConfig = moduleConfig();
    if (initialModuleConfig) {
      log(
        level.LIPID,
        "LiveIntent module is already configured before LIPID initialization. Double-check that the module is not enabled when CONTROL group is selected.",
        initialModuleConfig
      );
    }

    log(level.INFO, "Initial prebid configuration", snapshot(pbjs.getConfig()));
    pbjs.getConfig("userSync", ({ userSync }) => {
      log(level.INFO, "setConfig(userSync)", snapshot(userSync));
      let newModuleConfig = userSync.userIds?.find((module) => module.name === "liveIntentId");
      if (moduleEverConfigured && !newModuleConfig) {
        log(
          level.ERROR,
          "LiveIntent module is not in the updated configuration, but previously had been on this page. Removing the userId module may not have the intended effect and the module may have already affected the auctions before this point"
        );
      }
      if (moduleStorageEverConfigured && newModuleConfig && !newModuleConfig.storage) {
        log(
          level.WARNING,
          "LiveIntent module does not have storage configured in the updated configuration, but previously had storage configured on this page. Removing the storageConfiguration from the userId module may not have the intended effect and IDs may have already been resolved/stored."
        );
      }
      if (newModuleConfig) moduleEverConfigured = true;
      if (newModuleConfig?.storage) moduleStorageEverConfigured = true;
    });

    if (config.prebid.override_auction_delay !== false) {
      // NOTE: We want this to be done as late in the init sequence as possible.
      // pbjs.cmd is processed after pbjs.que, so push the auctionDelay override to cmd from a que callback
      // in an attempt to be last processed action before the auction starts and avoid being overwritten by other init scripts.
      pbjs.cmd.push(() => {
        log(level.LIPID, `Overriding auction delay to ${config.prebid.override_auction_delay}`);
        pbjs.setConfig({
          userSync: { auctionDelay: config.prebid.override_auction_delay },
        });
      });
    }

    pbjs.onEvent("auctionInit", (args) => {
      try {
        const enrichedBid = args.bidderRequests.flatMap((br) => br.bids).find(bidWasEnriched);
        const auctionWasEnriched = enrichedBid !== undefined;
        fireLIMetric("auctionInit", {
          auctionId: args.auctionId,
          enriched: auctionWasEnriched,
          enrichedIds: enrichedBid?.userIdAsEids.filter(eidBelongsToLiveIntent),
          auctionDelay: pbjs.getConfig().userSync.auctionDelay,
        });

        // Troubleshooting steps
        if (firstAuction) {
          // Don't report these errors for every auction on the page.
          firstAuction = false;

          const currentConfig = snapshot(pbjs.getConfig());
          const currentModuleConfig = moduleConfig();
          googletag.cmd.push(() => {
            try {
              const targetingKeys = window.googletag.pubads().getTargetingKeys();
              if (
                config.googletag.override_control_group === undefined &&
                !targetingKeys.includes(config.googletag.reporting_key)
              ) {
                log(
                  level.WARNING,
                  `window.googletag.pubads().getTargetingKeys() does not contain the expected key '${config.googletag.reporting_key}'. Either the config.googletag.reporting_key in LIPID does not match (did the publisher pick a custom reporting key?), or reporting was not properly enabled.`,
                  "Available Targeting Keys",
                  targetingKeys
                );
              } else {
                const liTargetingValue = window.googletag.pubads().getTargeting(config.googletag.reporting_key);
                if (config.googletag.override_control_group === undefined && liTargetingValue.length === 0) {
                  log(
                    level.WARNING,
                    `window.googletag.pubads().getTargeting('${config.googletag.reporting_key}') is missing or empty. Targeting has not been set correctly.`
                  );
                } else if (liTargetingValue.length > 1) {
                  log(
                    level.ERROR,
                    `window.googletag.pubads().getTargeting('${config.googletag.reporting_key}') contained multiple values. Targeting has not been set correctly.`
                  );
                } else {
                  if (
                    config.googletag.override_control_group === true ||
                    config.googletag.reporting_control_values.includes(liTargetingValue[0])
                  ) {
                    // CONTROL group selected
                    if (!moduleIsInstalled()) {
                      log(
                        level.INFO,
                        `liveIntentIdSystem is not an installed module, but window.googletag.pubads().getTargeting('${config.googletag.reporting_key}') indicates CONTROL group`
                      );
                    }
                    if (currentModuleConfig && currentConfig.userSync.syncEnabled !== false) {
                      log(
                        level.WARNING,
                        `window.googletag.pubads().getTargeting('${config.googletag.reporting_key}') indicates CONTROL group, but the LiveIntent module is enabled and active, so the control group may be polluted if the auction gets enriched.`
                      );
                    } else {
                      log(level.INFO, `User is in the CONTROL group. Auction was purposefully not enriched.`);
                    }
                    if (auctionWasEnriched) {
                      log(
                        level.ERROR,
                        `window.googletag.pubads().getTargeting('${config.googletag.reporting_key}') indicates CONTROL group, but auction was enriched. The control group was polluted.`
                      );
                    }
                  } else if (
                    // TREATED group selected
                    config.googletag.override_control_group === false ||
                    config.googletag.reporting_treated_values.includes(liTargetingValue[0])
                  ) {
                    if (!auctionWasEnriched) {
                      // Check to see if module is installed and configured
                      if (!moduleIsInstalled()) {
                        log(
                          level.ERROR,
                          `window.googletag.pubads().getTargeting('${config.googletag.reporting_key}') indicates TREATED group, but liveIntentIdSystem is not an installed module. Bids will not be enriched.`
                        );
                      }
                      if (!currentModuleConfig) {
                        log(
                          level.ERROR,
                          `window.googletag.pubads().getTargeting('${config.googletag.reporting_key}') indicates TREATED group, but liveIntentId module is not configured in the userSync.userIds array. Bids will not be enriched.`
                        );
                      } else {
                        // Check module config for proper setup
                        if (currentModuleConfig.params.publisherId) {
                          log(level.INFO, "Configured publisherId:", currentModuleConfig.params.publisherId);
                          if (currentModuleConfig.params.distributorId) {
                            log(
                              level.WARNING,
                              "Both publisherId and distributorId configured:",
                              currentModuleConfig.params.publisherId,
                              currentModuleConfig.params.distributorId
                            );
                          }
                        } else if (currentModuleConfig.params.distributorId) {
                          log(level.INFO, "Configured distributorId:", currentModuleConfig.params.distributorId);
                        } else {
                          log(
                            level.ERROR,
                            "No publisherId or distributorId is configured on the liveIntentId module",
                            "Current params:",
                            currentModuleConfig.params
                            );
                          }
                        }
                        if (currentConfig.userSync.syncEnabled === false) {
                          log(
                            level.ERROR,
                            `window.googletag.pubads().getTargeting('${config.googletag.reporting_key}') indicates TREATED group, but the Prebid userSync is disabled. Bids will not be enriched.`,
                            currentConfig.userSync
                          );
                        } else {
                          // Check userSync settings
                          if (currentConfig.userSync.auctionDelay === 0) {
                            if (currentModuleConfig.storage) {
                              log(
                                level.WARNING,
                                "userSync.auctionDelay is set to 0 at the start of the auction. However, prebid storage IS configured on the liveIntentId module, so subsequent page views may still get first auctions enriched within the expiration period.",
                                currentModuleConfig.storage
                              );
                            } else {
                              log(
                                level.ERROR,
                                "userSync.auctionDelay is set to 0 at the start of the auction and Prebid storage is not configured on the LiveIntent module. Bids will not be enriched for the first auction on each page, but may be for subsequent auctions",
                                currentModuleConfig
                              );
                            }
                        } else {
                          if (
                            currentModuleConfig &&
                            currentModuleConfig.storage
                          ) {
                            log(
                              level.INFO,
                              "userSync.auctionDelay is a non-zero value (which is good), but Prebid storage is also configured for the LiveIntent module which may reduce the effectiveness and freshness of the resolved ids compared to the built-in caching. It is recommended to remove the storage configuration."
                            );
                          } else {
                            log(
                              level.WARNING,
                              `window.googletag.pubads().getTargeting('${config.googletag.reporting_key}') indicates TREATED group, but this auction was still not enriched. This may not be an error due to a mis-configuration, or it could be a transient issue due to a timeout or no identifiers returned for the user.`
                            );
                          }
                        }
                      }
                    } else {
                      // Check module config for proper setup
                      if (currentModuleConfig.params.publisherId) {
                        log(level.INFO, "Configured publisherId:", currentModuleConfig.params.publisherId);
                        if (currentModuleConfig.params.distributorId) {
                          log(
                            level.WARNING,
                            "Both publisherId and distributorId configured:",
                            currentModuleConfig.params.publisherId,
                            currentModuleConfig.params.distributorId
                          );
                        }
                      } else if (currentModuleConfig.params.distributorId) {
                        log(level.INFO, "Configured distributorId:", currentModuleConfig.params.distributorId);
                      } else {
                        log(
                          level.ERROR,
                          "No publisherId or distributorId is configured on the liveIntentId module",
                          "Current params:",
                          currentModuleConfig.params
                        );
                      }
                      log(level.INFO, `User is in the TREATED group and auction was enriched.`);
                    }
                  }
                  // Unknown targeting value
                  else {
                    log(
                      level.ERROR,
                      `window.googletag.pubads().getTargeting('${config.googletag.reporting_key}') returned a value (${liTargetingValue}) that was not expected for either the TREATED or CONTROL groups. If this value is expected, please add it to the corresponding CONTROL or TREATED values array in the lipid.config and reload the page.`
                    );
                  }
                }
              }
            } catch (e) {
              log(level.ERROR, "Unhandled exception during auctionInit googletag evaluation", e);
            }
          });
        }
      } catch (e) {
        log(level.LIPID, "Unhandled exception during auctionInit", e);
      }
    });

    pbjs.onEvent("auctionEnd", (args) => {
      try {
        const auctionWasEnriched = args.bidderRequests.some((br) => br.bids.some(bidWasEnriched));
        const auctionTotalCpm = (pbjs.getHighestCpmBids() ?? []).reduce((carry, bid) => carry + bid.cpm, 0);
        fireLIMetric("auctionEnd", {
          auctionId: args.auctionId,
          enriched: auctionWasEnriched,
          cpm: auctionTotalCpm,
        });
      } catch (e) {
        log(level.LIPID, "Unhandled exception during auctionEnd", e);
      }
    });

    pbjs.onEvent("adRenderSucceeded", ({ bid }) => {
      try {
        const winningBidWasEnriched =
          pbjs
            .getEvents()
            .find((e) => e.eventType === "auctionInit" && e.args.auctionId === bid.auctionId)
            ?.args.bidderRequests.find((br) => br.bidderCode === bid.bidderCode)
            ?.bids.some(bidWasEnriched) ?? false;
        fireLIMetric("adRenderSucceeded", {
          auctionId: bid.auctionId,
          enriched: winningBidWasEnriched,
          bidId: bid.requestId,
          cpm: bid.cpm,
        });
      } catch (e) {
        log(level.LIPID, "Unhandled exception during adRenderSucceeded", e);
      }
    });
  };
  log(level.DEBUG, `Hooking ${config.prebid.window_property_name}.${hookQ}.${hookF}`);
  pbjs[hookQ][hookF](lipidHook);
})();
