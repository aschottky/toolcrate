import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css             */import{a as L,n as E}from"./api-config-CdUoY1ko.js";async function j(e){if(e.status===405)return"The hosting server blocked this request (405). Refresh the page — if it persists, the API URL may be misconfigured.";if((e.headers.get("content-type")||"").includes("application/json"))try{const t=await e.json();return t.error||t.message||`Something went wrong while processing your audit (${e.status}).`}catch{return`Something went wrong while processing your audit (${e.status}).`}try{const t=(await e.text()).trim();if(t&&!t.startsWith("<"))return t.slice(0,280)}catch{}return`Something went wrong while processing your audit (${e.status}).`}async function k(e){if(!(e.headers.get("content-type")||"").includes("application/json"))return{error:await j(e),code:void 0};try{const t=await e.json();return{error:t.error||t.message||`Something went wrong while processing your audit (${e.status}).`,code:t.code}}catch{return{error:`Something went wrong while processing your audit (${e.status}).`,code:void 0}}}const R={seo:"SEO",leadCapture:"Lead Capture",mobile:"Mobile-Friendliness",trust:"Trust & Credibility",messaging:"Messaging & Clarity",performance:"Performance & Bloat",security:"Tech Stack & Security"};let m=null;function U({isDevPage:e=!1}={}){var w;const i=document.getElementById("audit-form"),t=document.getElementById("website-url"),a=document.getElementById("run-audit-btn"),c=document.getElementById("audit-status"),u=document.getElementById("audit-error"),l=document.getElementById("audit-results"),g=document.getElementById("payment-success");e&&((w=document.querySelector(".audit-badge"))==null||w.classList.add("is-dev")),g&&I()&&(g.hidden=!1,t==null||t.focus()),i==null||i.addEventListener("submit",async n=>{n.preventDefault(),A(),y(!0);const p=t.value.trim();try{let r;try{r=await fetch(L("/api/audit"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({websiteUrl:p,generatePdf:e})})}catch(d){throw new Error(E((d==null?void 0:d.message)||"Could not reach the audit server."))}if(!r.ok){const{error:d}=await k(r);throw new Error(d)}let s;try{s=await r.json()}catch{throw new Error("The server returned an unexpected response. Please try again.")}if(!s.ok)throw new Error(s.error||"Audit request failed.");S(s),e&&s.pdfBase64&&$(s.pdfBase64)}catch(r){const s=E((r==null?void 0:r.name)==="SyntaxError"?"The server returned an unexpected response. Please try again.":r.message||"Something went wrong.");B(s)}finally{y(!1)}});function y(n){a.disabled=n,t.disabled=n,a.textContent=n?"Running audit…":"Run Audit",c.hidden=!n,c.className="audit-status is-loading",n&&(c.innerHTML=`
        <div class="spinner" aria-hidden="true"></div>
        <p>Scraping the site and asking the AI for a tear-down…</p>
        <p class="audit-status-note">${e?"Building your on-screen report and PDF — usually 20–60 seconds.":"This usually takes 20–60 seconds."}</p>
      `)}function A(){u.hidden=!0,u.textContent="",l.hidden=!0,l.innerHTML="",c.hidden=!0}function B(n){c.hidden=!0,u.hidden=!1,u.textContent=n}function S(n){var b;const{report:p,websiteUrl:r,scrapedMeta:s}=n,d=Object.entries(R).map(([h,C])=>{const f=p[h];return f?`
          <article class="score-card">
            <header>
              <h3>${C}</h3>
              <span class="score-pill">${f.score}/10</span>
            </header>
            <p>${o(f.summary)}</p>
          </article>
        `:""}).join(""),T=p.tips.map(h=>`<li class="tip-item">${v(h)}</li>`).join("");l.innerHTML=`
      <section class="results-header">
        <h2>Your tear-down report</h2>
        <p class="results-url"><a href="${P(r)}" target="_blank" rel="noopener noreferrer">${o(r)}</a></p>
        <p class="results-meta">Scraped page title: <strong>${o(s.title||"(none)")}</strong></p>
      </section>
      <section class="score-grid">${d}</section>
      <section class="tips-panel">
        <h3>3 actionable fixes</h3>
        <ol>${T}</ol>
      </section>
      ${e?`<section class="audit-pdf-actions">
        <p class="audit-pdf-note">PDF generated with the same report (dev test).</p>
        <button type="button" class="btn btn-primary" id="download-pdf-btn">Download PDF again</button>
      </section>`:""}
    `,l.hidden=!1,e&&((b=document.getElementById("download-pdf-btn"))==null||b.addEventListener("click",()=>{n.pdfBase64&&$(n.pdfBase64)})),l.scrollIntoView({behavior:"smooth",block:"start"})}}function $(e){m&&URL.revokeObjectURL(m);const i=Uint8Array.from(atob(e),c=>c.charCodeAt(0)),t=new Blob([i],{type:"application/pdf"});m=URL.createObjectURL(t);const a=document.createElement("a");a.href=m,a.download="Website-Audit.pdf",document.body.appendChild(a),a.click(),a.remove()}function I(){const e=new URLSearchParams(window.location.search);return e.get("paid")==="1"||e.get("redirect_status")==="succeeded"||e.has("payment_intent")||e.has("session_id")}function v(e){return typeof e=="string"?`<p class="tip-line">${o(e)}</p>`:[`<p class="tip-line"><strong>Problem:</strong> ${o(e.problem)}</p>`,`<p class="tip-line"><strong>Solution:</strong> ${o(e.solution)}</p>`,`<p class="tip-line tip-impact"><strong>Impact:</strong> ${o(e.impact)}</p>`].join("")}function o(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}function P(e){return o(e).replaceAll("'","&#39;")}U();
