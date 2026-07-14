// Installs a browser-fidelity DOMParser onto the global scope so parser.js
// (which calls the bare global `DOMParser`, exactly as it does in the browser)
// runs unmodified under Node. Import this before importing parser.js.
//
// jsdom, not linkedom: linkedom does not implement HTMLBaseElement.href /
// HTMLLinkElement.href URL-resolution, which parser.js's base-URL detection
// depends on — under linkedom, fixtures with a <base> or <link rel=canonical>
// tag silently parse as if neither existed, masking real behavior. jsdom
// matches the browser here.
import { JSDOM } from 'jsdom';

if (!globalThis.DOMParser) {
  globalThis.DOMParser = new JSDOM().window.DOMParser;
}
