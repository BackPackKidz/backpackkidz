const paypalDonateUrl = "https://www.paypal.com/donate/?hosted_button_id=VSXH3DH6PUFH2";
const donatePageUrl = "/pages/donate.html";

const communityPartners = [
  {
    name: "Beyond Ourselves",
    href: "https://www.pgica.org/Beyond_Ourselves",
    image: "/assets/sponsor-beyond-ourselves.png",
    className: "sponsor-logo-wide",
    width: 1000,
    height: 186,
  },
  {
    name: "Charlotte Community Foundation",
    href: "https://www.charlottecf.org/",
    image: "/assets/sponsor-charlotte-community-foundation.png",
    className: "sponsor-logo-wide",
    width: 690,
    height: 239,
  },
  {
    name: "Gulf Coast Community Foundation",
    href: "https://gulfcoastcf.org/",
    image: "/assets/sponsor-gulf-coast-center.png",
    className: "sponsor-logo-wide",
    width: 690,
    height: 239,
  },
  {
    // TODO (owner): the Hoffer Family Foundation has no standalone website, so both
    // it and its German Shepherd Rescue division link to swflgsdrescue.com. Send a
    // different foundation URL if you'd rather they point somewhere else.
    name: "Hoffer Family Foundation",
    href: "https://swflgsdrescue.com/",
    image: "/assets/sponsor-hoffer-family-foundation.png",
    className: "sponsor-logo-wide",
    width: 1152,
    height: 657,
  },
  {
    name: "Southwest Florida German Shepherd Rescue",
    href: "https://swflgsdrescue.com/",
    image: "/assets/sponsor-swfl-german-shepherd-rescue.png",
    className: "sponsor-logo-tall",
    width: 480,
    height: 544,
  },
  {
    name: "Burnt Store Presbyterian Church",
    href: "https://www.bspconline.org/",
    image: "/assets/sponsor-burnt-store-presbyterian.png",
    className: "sponsor-logo-tall",
    width: 816,
    height: 1265,
  },
  {
    name: "Spago Day Spa",
    href: "https://www.spagodayspa.com/",
    image: "/assets/sponsor-spago-day-spa.jpg",
    width: 315,
    height: 315,
  },
  {
    name: "Pilgrimage United Church of Christ",
    href: "https://www.pilgrimageucc.org/",
    image: "/assets/sponsor-pilgrimage-ucc.png",
    className: "sponsor-logo-wide",
    width: 302,
    height: 150,
  },
  {
    name: "Fishermen's Village",
    href: "https://www.fishermensvillage.com/",
    image: "/assets/sponsor-fishermens-village.png",
    className: "sponsor-logo-wide",
    width: 600,
    height: 168,
  },
  {
    name: "Riverwood Golf Club",
    href: "https://www.riverwoodgc.com/",
    image: "/assets/sponsor-riverwood-golf-club.png",
    className: "sponsor-logo-tall",
    width: 300,
    height: 342,
  },
  {
    name: "The Patterson Foundation",
    href: "https://www.thepattersonfoundation.org/",
    image: "/assets/sponsor-the-patterson-foundation.png",
    className: "sponsor-logo-wide",
    width: 690,
    height: 239,
  },
  {
    name: "Kendra Scott",
    href: "https://www.kendrascott.com/stores",
    image: "/assets/sponsor-kendra-scott.svg",
    className: "sponsor-logo-wide",
    width: 195,
    height: 34,
  },
  {
    name: "Punta Gorda Woman's Club",
    href: "https://puntagordawomansclub.com/",
    image: "/assets/sponsor-punta-gorda-womans-club.jpg",
    className: "sponsor-logo-wide",
    width: 2560,
    height: 640,
  },
  {
    name: "Charlotte Harbor Parrot Head Club",
    href: "https://chphc.com/",
    image: "/assets/sponsor-charlotte-players.png",
    className: "sponsor-logo-wide",
    width: 792,
    height: 336,
  },
  {
    name: "Nicola's Italian Kitchen",
    href: "https://www.nicolasitaliankitchen.net/",
  },
  {
    name: "Sam's Club Port Charlotte",
    href: "https://www.samsclub.com/club/6445-port-charlotte-fl",
    image: "/assets/sams-club-port-charlotte-logo.jpg",
    className: "sponsor-logo-wide",
    width: 690,
    height: 239,
  },
  {
    name: "Studio Seven PG",
    href: "https://studiosevenpg.com/",
  },
];

const setElementHidden = (element, isHidden) => {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  element.hidden = isHidden;
  element.setAttribute("aria-hidden", String(isHidden));
};

const setLiveStatus = (node, message = "") => {
  if (!(node instanceof HTMLElement)) {
    return;
  }

  if (message) {
    node.removeAttribute("aria-hidden");
    node.textContent = message;
  } else {
    node.textContent = "";
    node.setAttribute("aria-hidden", "true");
  }
};

const setFormBusy = (form, submitButton, isBusy) => {
  if (form instanceof HTMLElement) {
    if (isBusy) {
      form.setAttribute("aria-busy", "true");
    } else {
      form.removeAttribute("aria-busy");
    }
  }

  if (submitButton instanceof HTMLButtonElement) {
    submitButton.disabled = isBusy;
  }
};

const buildPartnerLink = (partner, options = {}) => {
  const link = document.createElement(partner.href ? "a" : "div");

  link.className = ["sponsor-logo-link", partner.className]
    .filter(Boolean)
    .join(" ");

  if (link instanceof HTMLAnchorElement) {
    link.href = partner.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `Visit ${partner.name} website`);
  }

  if (options.reveal) {
    link.setAttribute("data-reveal", "");
  }

  if (partner.image) {
    const image = document.createElement("img");

    image.src = partner.image;
    image.alt = partner.alt || "";
    image.loading = "lazy";
    image.width = partner.width;
    image.height = partner.height;
    link.appendChild(image);
  } else {
    const textFallback = document.createElement("span");

    textFallback.className = "sponsor-logo-text";
    textFallback.textContent = partner.name;
    link.appendChild(textFallback);
  }

  return link;
};

const renderPartnerLists = () => {
  document.querySelectorAll("[data-partner-list]").forEach((list) => {
    if (!(list instanceof HTMLElement)) {
      return;
    }

    const isGrid = list.dataset.partnerList === "grid";
    const isMarquee = list.dataset.partnerList === "marquee";

    list.replaceChildren(
      ...communityPartners.map((partner) =>
        buildPartnerLink(partner, { reveal: isGrid })
      )
    );

    if (!isMarquee) {
      return;
    }

    const track = list.closest(".marquee-track");

    if (!track || track.children.length > 1) {
      return;
    }

    const clone = list.cloneNode(true);

    clone.removeAttribute("data-partner-list");
    clone.setAttribute("aria-hidden", "true");
    clone.querySelectorAll("a").forEach((link) => {
      link.setAttribute("tabindex", "-1");
    });
    track.appendChild(clone);
  });
};

renderPartnerLists();

const siteHeader = document.querySelector(".site-header");
const navToggle = document.querySelector(".nav-toggle");
const navPanel = document.querySelector("#primary-navigation");
const navToggleLabel = navToggle?.querySelector(".sr-only");
const desktopQuery = window.matchMedia("(min-width: 1101px)");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const parallaxLayers = Array.from(document.querySelectorAll(".parallax-layer"));
const revealItems = Array.from(document.querySelectorAll("[data-reveal]"));
const floatingDonate = document.querySelector(".floating-donate");
const donationForm = document.querySelector("[data-donation-form]");
const exportForms = Array.from(document.querySelectorAll("[data-export-form]"));

document
  .querySelectorAll("[data-form-success], [data-donation-success]")
  .forEach((panel) => setElementHidden(panel, true));

document
  .querySelectorAll("[data-form-status], [data-export-status]")
  .forEach((statusNode) => setLiveStatus(statusNode));

/* =========================
   Navigation
========================= */

const setNavigationState = (isOpen) => {
  if (!siteHeader || !navToggle || !navToggleLabel) {
    return;
  }

  siteHeader.classList.toggle("is-nav-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
  navToggleLabel.textContent = isOpen
    ? "Close navigation menu"
    : "Open navigation menu";
  // Prevent background scrolling on smaller viewports when nav is open.
  try {
    if (!desktopQuery.matches) {
      if (isOpen) {
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
      } else {
        document.documentElement.style.overflow = "";
        document.body.style.overflow = "";
      }
    }
  } catch (e) {
    // ignore (safe fallback)
  }
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

/* =========================
   Donation links
========================= */

document.querySelectorAll("[data-donate-link]").forEach((donateLink) => {
  if (donateLink instanceof HTMLAnchorElement) {
    donateLink.href = donatePageUrl;
  }
});

document.querySelectorAll("[data-paypal-link]").forEach((paypalLink) => {
  if (paypalLink instanceof HTMLAnchorElement) {
    paypalLink.href = paypalDonateUrl;
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
  window.location.assign(donatePageUrl);
});

const serializeDonationForm = (form) => {
  const formData = new FormData(form);

  return {
    donorType: formData.get("donor_type") || "",
    donorName: formData.get("donor_name") || "",
    organizationName:
      formData.get("business_or_organization_name") || "",
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
    mailingAddress: formData.get("address") || "",
    city: formData.get("city") || "",
    state: formData.get("state") || "",
    zip: formData.get("zip") || "",
    sourceCampaign: formData.get("source_campaign") || "Website Donation",
    inHonorMemory: formData.has("in_honor_enabled"),
    honorType: formData.get("honor_type") || "in honor of",
    honoreeName: formData.get("honoree_name") || "",
    honorMessage: formData.get("honor_message") || "",
  };
};

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));

/* Every donation field is optional; donors choose their amount on
   PayPal's page. The only check left is a format check on the email,
   and only when one was entered. */
const validateDonationClientSide = (payload) => {
  const errors = [];

  if (payload.email && !isValidEmail(payload.email)) {
    errors.push({ field: "email", message: "Enter a valid email address." });
  }

  return errors;
};

const setFieldErrors = (form, errors = []) => {
  form.querySelectorAll("[data-error-for]").forEach((errorNode) => {
    errorNode.textContent = "";
  });

  form.querySelectorAll("[aria-invalid='true']").forEach((field) => {
    field.removeAttribute("aria-invalid");

    if (field.getAttribute("aria-describedby")?.startsWith("field-error-")) {
      field.removeAttribute("aria-describedby");
    }
  });

  errors.forEach((error) => {
    const errorNode = form.querySelector(`[data-error-for="${error.field}"]`);
    const field = form.elements[error.field];

    if (errorNode) {
      errorNode.textContent = error.message;
    }

    if (field instanceof HTMLElement) {
      field.setAttribute("aria-invalid", "true");

      // Tie the visible error text to the field so screen readers
      // announce it alongside the input.
      if (errorNode) {
        if (!errorNode.id) {
          errorNode.id = `field-error-${error.field}`;
        }

        field.setAttribute("aria-describedby", errorNode.id);
      }
    }
  });
};

/* =========================
   Donation form
========================= */

if (donationForm instanceof HTMLFormElement) {
  const honorToggle = donationForm.querySelector("[data-honor-toggle]");
  const honorFields = donationForm.querySelector("[data-honor-fields]");
  const statusNode = donationForm.querySelector("[data-form-status]");
  const successPanel = document.querySelector("[data-donation-success]");
  const submitButton = donationForm.querySelector("[type='submit']");
  let isSubmittingDonation = false;

  const setHonorFieldsState = () => {
    const isEnabled =
      honorToggle instanceof HTMLInputElement && honorToggle.checked;

    if (honorFields instanceof HTMLElement) {
      honorFields.hidden = !isEnabled;
    }
  };

  honorToggle?.addEventListener("change", setHonorFieldsState);
  setHonorFieldsState();

  donationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSubmittingDonation) {
      return;
    }

    const payload = serializeDonationForm(donationForm);
    const clientErrors = validateDonationClientSide(payload);

    setFieldErrors(donationForm, clientErrors);

    if (clientErrors.length > 0) {
      const firstErrorField = donationForm.elements[clientErrors[0].field];

      if (firstErrorField instanceof HTMLElement) {
        firstErrorField.focus();
      }

      setLiveStatus(statusNode, "Please fix the highlighted fields.");

      return;
    }

    isSubmittingDonation = true;
    setFormBusy(donationForm, submitButton, true);
    setLiveStatus(statusNode, "Saving your donation information...");

    try {
      const response = await fetch("/api/donations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (Array.isArray(data.fields) && data.fields.length > 0) {
          setFieldErrors(
            donationForm,
            data.fields.map((field) => ({
              field,
              message: fieldErrorMessages[field] || "Please complete this field.",
            }))
          );
          throw new Error("Please fix the highlighted fields.");
        }

        throw new Error("Something went wrong. Please try again.");
      }

      const paypalLink = successPanel?.querySelector("[data-paypal-link]");

      if (paypalLink instanceof HTMLAnchorElement && data.paypal_url) {
        paypalLink.href = data.paypal_url;
      }

      setLiveStatus(statusNode);
      setFormBusy(donationForm, submitButton, false);
      donationForm.hidden = true;
      if (donationForm instanceof HTMLElement) {
        donationForm.setAttribute("aria-hidden", "true");
      }

      if (successPanel instanceof HTMLElement) {
        successPanel.hidden = false;
        successPanel.setAttribute("aria-hidden", "false");
        successPanel.setAttribute("tabindex", "-1");
        successPanel.focus();
      }
    } catch (error) {
      isSubmittingDonation = false;
      setFormBusy(donationForm, submitButton, false);
      setLiveStatus(
        statusNode,
        error.message || "Something went wrong. Please try again."
      );
    }
  });
}

exportForms.forEach((exportForm) => {
  const statusNode = exportForm.querySelector("[data-export-status]");
  const submitButton = exportForm.querySelector("[type='submit']");
  const exportUrl = exportForm.dataset.exportUrl || "/api/donations/export";
  const fileSlug =
    exportForm.dataset.exportName ||
    exportUrl.replace(/\/export\/?$/, "").split("/").filter(Boolean).pop() ||
    "records";

  exportForm.addEventListener(
    "invalid",
    () => {
      setLiveStatus(statusNode, "Enter the export token.");
    },
    true
  );

  exportForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const token = String(new FormData(exportForm).get("export_token") || "").trim();

    if (!token) {
      setLiveStatus(statusNode, "Enter the export token.");

      return;
    }

    setFormBusy(exportForm, submitButton, true);
    setLiveStatus(statusNode, "Preparing CSV...");

    try {
      const response = await fetch(exportUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Records could not be exported.");
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);

      downloadLink.href = downloadUrl;
      downloadLink.download = `backpack-kidz-${fileSlug}-${today}.csv`;
      downloadLink.click();
      URL.revokeObjectURL(downloadUrl);

      setLiveStatus(statusNode, "CSV downloaded.");
    } catch (error) {
      setLiveStatus(statusNode, error.message || "Export failed.");
    } finally {
      setFormBusy(exportForm, submitButton, false);
    }
  });
});

/* =========================
   Reveal animations
========================= */

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

/* =========================
   Floating donate button
========================= */

const updateFloatingDonate = () => {
  if (!floatingDonate) {
    return;
  }

  const shouldShow = window.scrollY > 720 && window.innerWidth > 640;
  floatingDonate.classList.toggle("is-visible", shouldShow);
};

/* =========================
   Parallax
========================= */

const updateParallax = () => {
  if (parallaxLayers.length === 0) {
    return;
  }

  if (reducedMotionQuery.matches || !desktopQuery.matches) {
    parallaxLayers.forEach((layer) =>
      layer.style.setProperty("--parallax-y", "0px")
    );
    return;
  }

  const viewportHeight = window.innerHeight || 1;

  parallaxLayers.forEach((layer) => {
    const section = layer.closest("[data-parallax-section]");
    const bounds = (section || layer).getBoundingClientRect();
    const speed = Number(layer.dataset.parallaxSpeed || 0.08);
    const progress =
      (viewportHeight - bounds.top) / (viewportHeight + bounds.height);
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

/* =========================
   Reusable API forms
   Wires Contact, Volunteer, and Sponsorship pages to their Netlify
   functions. Each form opts in with [data-api-form] and posts its
   fields (by name) as JSON. The donation form keeps its own handler.
========================= */

const fieldErrorMessages = {
  email: "Enter a valid email address.",
};

const setApiFieldErrors = (form, fields = []) => {
  form.querySelectorAll("[data-error-for]").forEach((node) => {
    node.textContent = "";
  });
  form.querySelectorAll("[aria-invalid='true']").forEach((field) => {
    field.removeAttribute("aria-invalid");

    if (field.getAttribute("aria-describedby")?.startsWith("field-error-")) {
      field.removeAttribute("aria-describedby");
    }
  });

  fields.forEach((name) => {
    const node = form.querySelector(`[data-error-for="${name}"]`);
    const field = form.elements[name];

    if (node) {
      node.textContent = fieldErrorMessages[name] || "Please complete this field.";
    }

    if (field instanceof HTMLElement) {
      field.setAttribute("aria-invalid", "true");

      // Tie the visible error text to the field so screen readers
      // announce it alongside the input.
      if (node) {
        if (!node.id) {
          node.id = `field-error-${name}`;
        }

        field.setAttribute("aria-describedby", node.id);
      }
    }
  });
};

const serializeApiForm = (form) => {
  const payload = {};

  new FormData(form).forEach((value, key) => {
    if (key in payload) {
      payload[key] = [].concat(payload[key], value);
    } else {
      payload[key] = value;
    }
  });

  return payload;
};

document.querySelectorAll("[data-api-form]").forEach((form) => {
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const endpoint = form.getAttribute("action") || form.dataset.endpoint;
  const statusNode = form.querySelector("[data-form-status]");
  const successPanel = form.parentElement?.querySelector("[data-form-success]");
  const submitButton = form.querySelector("[type='submit']");
  let isSubmitting = false;

  form.addEventListener(
    "invalid",
    () => {
      setLiveStatus(statusNode, "Please complete the required fields.");
    },
    true
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSubmitting || !endpoint) {
      return;
    }

    // Let the browser surface its native required-field messages first.
    if (typeof form.reportValidity === "function" && !form.reportValidity()) {
      setLiveStatus(statusNode, "Please complete the required fields.");
      return;
    }

    isSubmitting = true;
    setFormBusy(form, submitButton, true);
    setLiveStatus(statusNode, "Sending...");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serializeApiForm(form)),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (Array.isArray(data.fields) && data.fields.length > 0) {
          setApiFieldErrors(form, data.fields);
          const firstField = form.elements[data.fields[0]];

          if (firstField instanceof HTMLElement) {
            firstField.focus();
          }
        }

        throw new Error(
          data.error || "Something went wrong. Please try again."
        );
      }

      setApiFieldErrors(form, []);
      form.reset();

      if (successPanel instanceof HTMLElement) {
        setLiveStatus(statusNode);
        form.hidden = true;
        form.setAttribute("aria-hidden", "true");

        successPanel.hidden = false;
        successPanel.setAttribute("aria-hidden", "false");
        successPanel.setAttribute("tabindex", "-1");
        successPanel.focus();
      } else if (statusNode) {
        setLiveStatus(statusNode, "Thank you! Your message has been sent.");
      }
    } catch (error) {
      setLiveStatus(
        statusNode,
        error.message || "Something went wrong. Please try again."
      );
    } finally {
      isSubmitting = false;
      setFormBusy(form, submitButton, false);
    }
  });
});

/* =========================
   Sponsorship cost estimate
   Mirrors the server-side COST_PER_CHILD so the Sponsor page can show a
   live yearly total ($320 per child per school year, owner confirmed).
========================= */

const sponsorCalc = document.querySelector("[data-sponsor-calc]");

if (sponsorCalc) {
  const costPerChild = Number(sponsorCalc.dataset.costPerChild || 320);
  const countInput = sponsorCalc.querySelector("[data-sponsor-count]");
  const totalOutput = sponsorCalc.querySelector("[data-sponsor-total]");

  const formatUsd = (value) =>
    value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

  const updateSponsorTotal = () => {
    const count = Math.max(0, Math.floor(Number(countInput?.value) || 0));

    if (totalOutput) {
      totalOutput.textContent =
        count > 0 ? formatUsd(count * costPerChild) : formatUsd(0);
    }
  };

  countInput?.addEventListener("input", updateSponsorTotal);
  updateSponsorTotal();
}
