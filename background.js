/* global browser TKVS */

let store = new TKVS('keyval-store','keyval');
let hiddenTabs = new Set();
let enabled = true;


browser.runtime.onMessage.addListener(async (data /*, sender*/) => {

    //console.log('onMessage');

    if(!enabled) {
        return '';
    }
    if (data.type === 'screenshot') {
        const tmp = await store.get(data.url)
        if(tmp){
            const now = Date.now();
            if (tmp.ts < now){
                if ( (now - tmp.ts) < 60*60*24*7) {  // less then a week old
                    return Promise.resolve(tmp);
                }
            }
        }
        //console.debug('onMessage', data);
        // fetch HEAD and only get content-type html
        let bgtab = await browser.tabs.create({
            url: data.url,
            active: false,
        });
        browser.tabs.hide(bgtab.id);
        hiddenTabs.add(bgtab.id);

        return (new Promise( (resolve /*, reject*/) => {
            let repeats = 20;
            let siid = setInterval(async() => {
                const tmp = await store.get(data.url)
                if(tmp){
                    clearInterval(siid);
                    return resolve(tmp);
                }
                if(repeats < 1){
                    clearInterval(siid);
                    return resolve('timeout');
                }
                repeats--;
            }, 1000);
        }));
    }
    return false;
});

browser.tabs.onRemoved.addListener( (tabId /*, removeInfo*/) => {
        if(hiddenTabs.has(tabId)){
            hiddenTabs.delete(tabId);
        }
});

browser.tabs.onUpdated.addListener(
    async (tabId, changeInfo, tabInfo) => {

            if(changeInfo.status === 'loading' && tabInfo.url){
                if(
                    /https:\/\/(www\.)?(duckduckgo|google)(\.[a-z]{2,3}){1,2}/g.test(tabInfo.url)
                ) {
                    console.debug('executeScript');
                    browser.tabs.executeScript(tabId, {file: 'content.js'});
                }
            }else
            if(changeInfo.status === 'complete'){

        if(hiddenTabs.has(tabId)){
                //console.debug('handleUpdated', tabId, tabInfo.url);
                const imguri = await browser.tabs.captureTab(tabId, {
                    format: 'jpeg',
                    quality: 1,
                });
                store.set(tabInfo.url, {
                    ts: Date.now(), //details.timeStamp, // millisec since epoch
                    img: imguri
                });
                browser.tabs.remove(tabId);
            }
        }
    }
  ,{ properties: ['status'] }
);


browser.webRequest.onHeadersReceived.addListener(
    (details) => {
        if(hiddenTabs.has(details.tabId))
        {
            const cspHeader = {
                name: "Content-Security-Policy",
                value: "script-src 'none'"
            };
            details.responseHeaders.push(cspHeader);
            return { responseHeaders: details.responseHeaders };
        }
    }
    ,{ urls: ['<all_urls>'] } // filter
    ,['blocking', 'responseHeaders'] // extra
);

browser.browserAction.onClicked.addListener( () => {
    enabled = !enabled;
    browser.browserAction.setBadgeText({text: (enabled?"On":"Off")});
    browser.browserAction.setBadgeBackgroundColor({ color: (enabled?"green":"red") });
});

browser.browserAction.setBadgeText({text: (enabled?"On":"Off")});
browser.browserAction.setBadgeBackgroundColor({ color: (enabled?"green":"red") });
