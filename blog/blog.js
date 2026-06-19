function syncBlogView() {
  const isPost = new URLSearchParams(window.location.search).has("post");
  document.body.classList.toggle("blog-post-view", isPost);

  const intro = document.getElementById("blog-intro");
  if (intro) {
    intro.hidden = isPost;
  }
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
