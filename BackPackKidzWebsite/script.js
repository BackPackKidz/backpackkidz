const donateUrl = "https://www.paypal.com/donate/?hosted_button_id=VSXH3DH6PUFH2";
const siteHeader = document.querySelector(".site-header");
const navToggle = document.querySelector(".nav-toggle");
const navPanel = document.querySelector("#primary-navigation");
const navToggleLabel = navToggle?.querySelector(".sr-only");
const desktopQuery = window.matchMedia("(min-width: 1101px)");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const parallaxLayers = Array.from(document.querySelectorAll(".parallax-layer"));
const revealItems = Array.from(document.querySelectorAll("[data-reveal]"));
const floatingDonate = document.querySelector(".floating-donate");

const setNavigationState = (isOpen) => {
  if (!siteHeader || !navToggle || !navToggleLabel) {
    return;
  }

  siteHeader.classList.toggle("is-nav-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
  navToggleLabel.textContent = isOpen
    ? "Close navigation menu"
    : "Open navigation menu";
};

if (siteHeader && navToggle && navPanel) {
  const toggleNavigation = () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    setNavigationState(!isOpen);
  };

  navToggle.addEventListener("click", toggleNavigation);

  navToggle.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      toggleNavigation();
    }
  });

  navPanel.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    if (event.target.closest("a")) {
      setNavigationState(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setNavigationState(false);
    }
  });

  const resetNavigationForDesktop = (event) => {
    if (event.matches) {
      setNavigationState(false);
    }
  };

  if (desktopQuery.addEventListener) {
    desktopQuery.addEventListener("change", resetNavigationForDesktop);
  } else {
    desktopQuery.addListener(resetNavigationForDesktop);
  }
}

document.querySelectorAll("[data-donate-link]").forEach((donateLink) => {
  if (donateLink instanceof HTMLAnchorElement) {
    donateLink.href = donateUrl;
  }
});

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const donateControl = event.target.closest("[data-donate-link]");

  if (!donateControl || donateControl instanceof HTMLAnchorElement) {
    return;
  }

  event.preventDefault();
  window.location.assign(donateUrl);
});

if (revealItems.length > 0) {
  if (!reducedMotionQuery.matches) {
    document.documentElement.classList.add("motion-ready");
  }

  if ("IntersectionObserver" in window && !reducedMotionQuery.matches) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.12,
      }
    );

    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }
}

const updateFloatingDonate = () => {
  if (!floatingDonate) {
    return;
  }

  const shouldShow = window.scrollY > 720 && window.innerWidth > 640;
  floatingDonate.classList.toggle("is-visible", shouldShow);
};

const updateParallax = () => {
  if (parallaxLayers.length === 0) {
    return;
  }

  if (reducedMotionQuery.matches || !desktopQuery.matches) {
    parallaxLayers.forEach((layer) => layer.style.setProperty("--parallax-y", "0px"));
    return;
  }

  const viewportHeight = window.innerHeight || 1;

  parallaxLayers.forEach((layer) => {
    const section = layer.closest("[data-parallax-section]");
    const bounds = (section || layer).getBoundingClientRect();
    const speed = Number(layer.dataset.parallaxSpeed || 0.08);
    const progress = (viewportHeight - bounds.top) / (viewportHeight + bounds.height);
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const offset = (clampedProgress - 0.5) * speed * 180;

    layer.style.setProperty("--parallax-y", `${offset.toFixed(2)}px`);
  });
};

let animationFrame = null;

const requestMotionUpdate = () => {
  if (animationFrame !== null) {
    return;
  }

  animationFrame = window.requestAnimationFrame(() => {
    animationFrame = null;
    updateFloatingDonate();
    updateParallax();
  });
};

window.addEventListener("scroll", requestMotionUpdate, { passive: true });
window.addEventListener("resize", requestMotionUpdate);

if (desktopQuery.addEventListener) {
  desktopQuery.addEventListener("change", requestMotionUpdate);
  reducedMotionQuery.addEventListener("change", requestMotionUpdate);
} else {
  desktopQuery.addListener(requestMotionUpdate);
  reducedMotionQuery.addListener(requestMotionUpdate);
}

updateFloatingDonate();
updateParallax();
