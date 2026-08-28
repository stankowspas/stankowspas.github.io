const noop=()=>{};
const analytics=Object.freeze({sessionStart:noop,navigation:noop,playStart:noop,resumeListening:()=>true,checkpointListening:()=>0,pauseListening:()=>0,stopListening:()=>0,adOpportunity:noop,rendered:noop,impression:noop,snapshot:()=>({}),resetForTests:noop});
const featured=Object.freeze({decorate:station=>station,decorateMany:(stations=[])=>stations,has:()=>false});
export const hostedConfig=Object.freeze({service:'ssgpt14-radio-pwa',version:'1.0.0-hosted-beta.18',environment:'production',monetization:Object.freeze({testAdsOnly:false,cmpConfigured:false,gptEnabled:false,directCampaignBackend:false,productionAdsEnabled:false}),streaming:Object.freeze({directFromBrowser:true,httpsOnly:true,proxyEnabled:false}),rights:Object.freeze({mode:'public-https-direct',inAppPlaybackRequiresExplicitEmbeddingPermission:false,commercialUsePermissionRequired:false,unknownStationsPlayableInApp:true,directBrowserPlaybackOnly:true,audioProxyEnabled:false,bypassTechnicalRestrictions:false})});
globalThis.SSGPTRadioHostedConfig=hostedConfig;
for(const selector of ['.test-ads-badge','#privacySettings'])document.querySelector(selector)?.classList.add('hidden');
export const monetization=Object.freeze({init:noop,render:()=>({source:'none'}),productionRequestAllowed:()=>false,analytics,featured,direct:Object.freeze({}),consent:Object.freeze({}),config:Object.freeze({}),runtimeConfig:hostedConfig,policy:Object.freeze({testAdsAllowed:false,productionAdsAllowed:false,cmpConfigured:false,gptEnabled:false,directCampaignBackend:false})});
globalThis.SSGPT14Monetization=monetization;
