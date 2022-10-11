/* globals browser */

/*
   The original version of this file was created by
   Prevoow UG & Co. KG, Edward Ackroyd, Paderborn, Germany
*/

console.debug('content.js');

//let tkvs = new TKVS('keyval-store','keyval');

async function getFromStorage(type, id, fallback) {
    let tmp = await browser.storage.local.get(id);
    return (typeof tmp[id] === type) ? tmp[id] : fallback;
}


async function checkResource(url) {

    const res = await fetch(url, { method: 'HEAD' , mode: 'no-cors'});
    if(res.ok){ // 2xx
        let ctype = await res.headers.get('Content-Type');
        if(typeof ctype === 'string'){
            ctype = ctype.toLowerCase();
            if( ctype.indexOf('text/html') > -1){
                return true;
            }
        }
    }
    return false;
}

let spcore = {
    GP_DOCUMENT: null,

    GP_REMOTE: null,


    GP_setDocument: function() {
        console.debug('GP_setDocument');
        this.GP_DOCUMENT = document;
    },

    getDocument: function() {
        console.debug('GP_getDocument');
        return this.GP_DOCUMENT;
    },

    getRealGoogleUrlAjax: function(href) {
        console.debug('getRealGoogleUrlAjax');
        const realUrl = href.match(/https?:\/\/(?:www\.)?google\.[^\/]+\/url\?.*url=(https?:.+)$/i);
        if (realUrl) {
            let maybeUrl = realUrl[1];
            const iamp = maybeUrl.indexOf("&");
            if (iamp > 0) {
                maybeUrl = maybeUrl.substring(0, iamp);
            }
            return unescape(maybeUrl);
        }
        return href;
    },

    GP_addStyle: function(styleString, _doc) {
        console.debug('GP_addStyle');
        let styleElement = _doc.createElement("style");
        styleElement.type = "text/css";
        styleElement.appendChild(_doc.createTextNode(styleString));
        _doc.getElementsByTagName("head")[0].appendChild(styleElement);
    },

    getImageURL: async function(href) {
        console.debug('getImageURL', href);

        if(! (await checkResource(href))) {
            //return 'not_a_html_document';
            return browser.runtime.getURL( 'na.png' );
        }
        // TODO: make sure href is an actual URL

        const data = await browser.runtime.sendMessage({
               type: 'screenshot',
               url: href
        });
        if(data && data.img){
            return data.img;
        }
        //return 'failed_to_generate_image_data';
        return browser.runtime.getURL( 'na2.png' );
    },

    createThumbLink: function(thumb, a, doc) {
        console.debug('createThumbLink');
        let linka = doc.createElement("a");
        linka.href = a.href;
        linka.insertBefore(thumb, linka.firstChild);
        return linka;
    },

    thumbshots: async function(url) {
        console.debug('thumbshots');
        let head = this.getDocument().getElementsByTagName("head")[0];
        if (head.getAttribute("done") == "done")
            return;

        let t = 0;
        if(this.isDDGHtml(url)) {
            let document = this.getDocument();
            let links = this.fetchElement(document, ".//div[@id='links']", document);
            if (links) {
                let serpNodes = links.childNodes;
                for (let i = 0; i < serpNodes.length; ++i) {
                    let serpNode = serpNodes[i];
                    let serpAnchor = this.fetchElement(document, "./div/a[@class='large']", serpNode);
                    if (serpAnchor) {
                        let serpURL = serpAnchor.getAttribute("href");
                        if (serpURL && serpURL.indexOf("http") == 0) {
                            let previewImage = document.createElement("img");
                            previewImage.style.cssFloat = "left";
                            previewImage.style.margin = "4px 5px 0px 2px";
                            previewImage.style.width = "111px";
                            previewImage.style.height = "82px";
                            previewImage.setAttribute("src", await this.getImageURL(serpURL));
                            previewImage.style.border = "1px solid #BBBBBB";
                            let linka = document.createElement("a");
                            linka.href = serpURL;
                            linka.insertBefore(previewImage, linka.firstChild);
                            serpNode.insertBefore(linka, serpAnchor.parentNode);

                            let snippet = this.fetchElement(document, ".//div[@class='snippet']", serpNode);
                            if (snippet) {
                                snippet.style.clear = "none";
                            }
                        }
                    }
                }
            }
        }

        if (t > 0) {
            head.setAttribute("done", "done");
        }
    },

    isDDG: function(href) {
        return href.match(/https?:\/\/(next\.)?duckduckgo.com\/.*/i);
    },

    isDDGHtml: function(href) {
        return href.match(/https?:\/\/duckduckgo.com\/html.*/i);
    },

    isEngine: function(href) {
        return href.match(/https?:\/\/(www|ipv6|encrypted)(|[0-9])\.(|l\.)google\..*\/.*/i) || this.isDDG(href);
    },

    GP_main: function()
    {
        let url = this.GP_DOCUMENT.location.href;

        if (!this.isEngine(url)) {
            return;
        }

        //DDG
        if (this.isDDGHtml(url)) {
            this.thumbshots(url);
        }
    },

    fetchElement:function(doc, filter, start) {
        let elems = doc.evaluate(filter, start, null, this.window.XPathResult.ANY_TYPE, null);
        let elem = elems.iterateNext();
        return elem;
    },

    processGoogleLiTag:function(li, doc) {
        if (li == null || !li.getAttribute || (li.getAttribute("id") && li.getAttribute("id").indexOf("box") >= 0)
            || li.getAttribute("class") == null || (li.getAttribute("class").charAt(0) != 'g' && li.getAttribute("class") != "tl")) return false;

        if ("BLOCK-COMPONENT" == li.parentNode.tagName) {
            return false;
        }

        li.style.clear = "left";
        return this.processG2022(li, doc);
    },

    createGPreviewImage: function (doc) {
        let thumb;
        thumb = doc.createElement("img");
        thumb.setAttribute("loading", "lazy");
        thumb.setAttribute("align", "left");
        thumb.setAttribute("src", "");
        thumb.style.width = "111px";
        thumb.style.height = "82px";
        thumb.setAttribute("width", 111);
        thumb.setAttribute("height", 82);
        thumb.style.border = "1px solid #BBBBBC";
        thumb.style.marginBlockStart = "6px"; //for both LTR and RTL languages
        thumb.style.position = "absolute";
        return thumb;
    },

    processG2022: async function(rDiv, doc) {
        let a =  this.fetchElement(doc, ".//a[@data-ved and not(@title)]", rDiv); //not(@title)
        let result = new Object();
        if (a) {
            let href = a.href;
            href = this.getRealGoogleUrlAjax(href);
            result.a = a;
            if (href.indexOf("http://") == 0 || href.indexOf("https://") == 0) {
                if ("done" != a.getAttribute("done") && a.text != null && a.text.length > 0) {
                    result.previewInserted = true;

                    let thumb = this.createGPreviewImage(doc);
                    let linka = this.createThumbLink(thumb, a, doc);

                    thumb.setAttribute("src", await this.getImageURL(href));
                    a.setAttribute("done", "done");

                    //new 2021-08-11 Check for googles own images (mostly product images)
                    let googleAlreadyHasAnImage = this.fetchElement(doc, ".//img[@width>80 or @height>80]", rDiv);
                    if (!googleAlreadyHasAnImage) {
                        let st = rDiv.getElementsByTagName("div")[0];
                        st.style.marginInlineStart = "118px"; //for both LTR and RTL languages
                        st.parentNode.insertBefore(linka, st);
                    }
                }
            }
        }
        return result;
    }
}


function HandleDOMContent(evt) {
        console.debug('HandleDOMContent');
        let doc = evt.target;
        if (doc._sp_x_loaded) return;
        doc._sp_x_loaded = true;

        if (doc.location == null) return;
        let u = doc.location.toString();
        if (! (u.match(/https?:\/\/(www|ipv6|encrypted)(|[0-9])\.(|l\.)google\..*\/.*/i)
                || spcore.isDDG(u))) {
            return;
        }

        if (u.match(/https?:\/\/[^\/]*\/(dfp|maps|flights|adsense|inbox|edu|appserve|retail|destination)/i)) { //don't run on these
            return;
        }

        if (u.match(/tbm=isch/i)) { //don't run on Google images page
            return;
        }

        spcore.GP_setDocument();
        spcore.GP_main();

        //DDG javascript version
        if (spcore.isDDG(u) && !spcore.isDDGHtml(u)) {
            spcore.GP_addStyle(".result__snippet {min-height: 55px;}", doc);
            let observer = new spcore.window.MutationObserver(function(mutations) {
                mutations.forEach( async function(mutation) {
                    if (mutation.target.nodeName == "DIV" && mutation.target.getAttribute("id") == "links") {
                        for (let i = 0; i < mutation.addedNodes.length; ++i) {
                            let serpNode = mutation.addedNodes[i];
                            serpNode.style.clear = "left";
                            let serpAnchor = spcore.fetchElement(doc, ".//h2/a", serpNode);
                            if (serpAnchor) {
                                let serpURL = serpAnchor.getAttribute("href");
                                if (serpURL && serpURL.indexOf("http") == 0) {
                                    let previewImage = doc.createElement("img");
                                    previewImage.style.cssFloat = "left";
                                    previewImage.style.margin = "10px 5px 0px 2px";
                                    previewImage.style.width = "111px";
                                    previewImage.style.height = "82px";
                                    previewImage.setAttribute("src", (await spcore.getImageURL(serpURL)) );
                                    previewImage.style.border = "1px solid #BBBBBB";

                                    let linka = doc.createElement("a");
                                    linka.href = serpURL;
                                    linka.insertBefore(previewImage, linka.firstChild);
                                    serpNode.insertBefore(linka, serpNode.firstChild);

                                    serpAnchor.parentNode.style.display = "flex"; //h2
                                }
                            }
                        }
                    }
                });
            });
            observer.observe(doc, {
                attributes: false,
                childList: true,
                characterData: false,
                subtree: true
            });
        }

        if (!u.match(/https?:\/\/(www|ipv6|encrypted)(|[0-9])\.(|l\.)google\..*\/.*/i)) {
            return;
        }

        spcore.GP_addStyle("#rhs_block {margin-left: 20px;}", doc);
        spcore.GP_addStyle(".exp-outline {border-right-width: 0px !important;}", doc);

        let t = 0;
        let ignore = false;

        let handleMutatedNode = function(targetNode) {
            if (ignore || targetNode.childElementCount < 5) {
                return;
            }

            if (t==0 && (targetNode instanceof spcore.window.HTMLBodyElement || targetNode instanceof spcore.window.HTMLDivElement)) {
                let lis = doc.evaluate("//*[(@class='g' or starts-with(@class, 'g ')) and not(@__sp_done2)]", targetNode, null, spcore.window.XPathResult.ANY_TYPE, null);
                let li = lis.iterateNext();

                if (li) {
                    let liArray = new Array();
                    while (li) {
                        liArray.push(li);
                        li = lis.iterateNext();
                    }
                    for(let liIndex=0; liIndex<liArray.length; liIndex++) {
                        let result = spcore.processGoogleLiTag(liArray[liIndex], doc);
                        if (result && result.previewInserted) {
                            ignore = true;
                            t++;
                        }
                        //Mark it
                        liArray[liIndex].setAttribute("__sp_done2", "X");
                    }
                    ignore = false;
                }
            }

            if (t > 0) { //images were inserted
                t = 0;
            }
        }

        // add resetting timeout delay for when many manipulations are done to the document
        let observer = new spcore.window.MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                handleMutatedNode(mutation.target);
            });
        });
        observer.observe(doc, {attributes: false, childList: true, characterData: false,subtree: true});
}


(async () => {

    spcore.window = window;
    spcore.initDoc = document;
    spcore.GP_REMOTE = await getFromStorage('string','remote','http://localhost:7050/api');

    let checkDoc = spcore.initDoc;
    if (!(typeof checkDoc === 'undefined') && !checkDoc._sp_x_loaded && checkDoc.nodeName == "#document") {
        addEventListener("DOMContentLoaded", HandleDOMContent);
    }

})();

