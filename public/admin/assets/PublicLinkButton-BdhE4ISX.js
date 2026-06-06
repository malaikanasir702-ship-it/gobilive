import{c as r,j as i,z as c}from"./index-BI6KzagQ.js";/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const s=r("Link2",[["path",{d:"M9 17H7A5 5 0 0 1 7 7h2",key:"8i5ue5"}],["path",{d:"M15 7h2a5 5 0 1 1 0 10h-2",key:"1b9ql8"}],["line",{x1:"8",x2:"16",y1:"12",y2:"12",key:"1jonct"}]]);function l({url:t,label:n="Copy Public Link"}){const e=()=>{const o=`${window.location.origin}${t}`;navigator.clipboard.writeText(o).then(()=>{c.success("Public link copied to clipboard!")})};return i.jsxs("button",{className:"btn-secondary gap-2 text-primary-600 border-primary-200 hover:bg-primary-50",onClick:e,title:n,children:[i.jsx(s,{size:15}),i.jsx("span",{className:"hidden sm:inline",children:n})]})}export{l as P};
