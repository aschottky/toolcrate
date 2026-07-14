import { getPostById, getPostsSorted } from "../src/data/posts.js";

const root = document.getElementById("blog-root");

function formatDate(iso) {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderList() {
  document.title = "Blog — ToolCrate";
  document.body.classList.remove("blog-post-view");

  const posts = getPostsSorted();
  const cards = posts
    .map((post) => {
      const media = post.imageUrl
        ? `
          <div class="post-card__media">
            <img
              src="${escapeHtml(post.imageUrl)}"
              alt=""
              loading="lazy"
              decoding="async"
            />
          </div>
        `
        : `
          <div class="post-card__media post-card__media--placeholder" aria-hidden="true">
            <span>Tool<span>Crate</span></span>
          </div>
        `;

      return `
      <a class="post-card${post.imageUrl ? "" : " post-card--no-image"}" href="/blog/?post=${encodeURIComponent(post.id)}">
        ${media}
        <div class="post-card__body">
          <div class="post-card__meta">
            <span class="post-card__category">${escapeHtml(post.category)}</span>
            <span>${escapeHtml(formatDate(post.date))}</span>
          </div>
          <h2 class="post-card__title">${escapeHtml(post.title)}</h2>
          <p class="post-card__excerpt">${escapeHtml(post.excerpt)}</p>
          <span class="post-card__link">Read more →</span>
        </div>
      </a>
    `;
    })
    .join("");

  root.innerHTML = `
    <div class="blog-intro" id="blog-intro">
      <p class="eyebrow">Insights</p>
      <h1>Expert Insights on Conversion &amp; UX.</h1>
      <p>Minimal, professional, zero fluff — how high-authority sites win the job.</p>
    </div>
    ${
      posts.length
        ? `<div class="blog-grid">${cards}</div>`
        : `<p class="blog-empty">No posts yet.</p>`
    }
  `;
}

function renderPost(id) {
  const post = getPostById(id);

  if (!post) {
    document.title = "Post not found — ToolCrate";
    document.body.classList.add("blog-post-view");
    root.innerHTML = `
      <div class="post-view">
        <a class="post-back" href="/blog/">← Back to Blog</a>
        <p class="blog-missing">That post doesn’t exist. <a href="/blog/">Return to the blog</a>.</p>
      </div>
    `;
    return;
  }

  document.title = `${post.title} — ToolCrate`;
  document.body.classList.add("blog-post-view");
  window.scrollTo({ top: 0, behavior: "auto" });

  root.innerHTML = `
    <article class="post-view">
      <a class="post-back" href="/blog/">← Back to Blog</a>
      <div class="post-view__meta">
        <span class="post-view__category">${escapeHtml(post.category)}</span>
        <span>${escapeHtml(formatDate(post.date))}</span>
      </div>
      <h1 class="post-view__title">${escapeHtml(post.title)}</h1>
      <div class="post-prose">${post.content}</div>
      <aside class="post-cta">
        <h2>See what elite looks like on your site.</h2>
        <p>Get a free expert preview — a concrete before/after of your homepage, built to convert.</p>
        <a class="post-cta__btn" href="/try/">Get a Free Expert Preview</a>
      </aside>
    </article>
  `;
}

function syncBlogView() {
  const postId = new URLSearchParams(window.location.search).get("post");
  if (postId) {
    renderPost(postId);
  } else {
    renderList();
  }
}

syncBlogView();
window.addEventListener("popstate", syncBlogView);

const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("navLinks");

hamburger?.addEventListener("click", () => {
  hamburger.classList.toggle("active");
  navLinks?.classList.toggle("active");
});

navLinks?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    hamburger?.classList.remove("active");
    navLinks?.classList.remove("active");
  });
});
