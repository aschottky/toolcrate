const HEADER_OFFSET_PX = 88;

function syncBlogView() {
  const isPost = new URLSearchParams(window.location.search).has("post");
  document.body.classList.toggle("blog-post-view", isPost);

  const intro = document.getElementById("blog-intro");
  if (intro) {
    intro.hidden = isPost;
  }

  if (isPost) {
    guardSoroScroll();
    schedulePostScrollFix();
  }
}

function guardSoroScroll() {
  const container = document.getElementById("soro-blog");
  if (!container || container.dataset.scrollGuard === "true") {
    return;
  }

  container.dataset.scrollGuard = "true";
  container.scrollIntoView = function scrollIntoViewWithHeaderOffset(options = {}) {
    const top = container.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: Math.max(0, top - HEADER_OFFSET_PX),
      behavior: options.behavior === "smooth" ? "smooth" : "auto",
    });
  };
}

function schedulePostScrollFix() {
  [0, 120, 400].forEach((delay) => {
    window.setTimeout(() => {
      if (!document.body.classList.contains("blog-post-view")) return;
      const container = document.getElementById("soro-blog");
      if (!container) return;
      const top = container.getBoundingClientRect().top + window.scrollY;
      const target = Math.max(0, top - HEADER_OFFSET_PX);
      if (Math.abs(window.scrollY - target) > 4) {
        window.scrollTo({ top: target, behavior: "auto" });
      }
    }, delay);
  });
}

syncBlogView();

window.addEventListener("popstate", syncBlogView);

const pushState = history.pushState.bind(history);
history.pushState = (...args) => {
  pushState(...args);
  syncBlogView();
};

const replaceState = history.replaceState.bind(history);
history.replaceState = (...args) => {
  replaceState(...args);
  syncBlogView();
};

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
