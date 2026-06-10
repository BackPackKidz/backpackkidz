const paypalDonateUrl = "https://www.paypal.com/donate/?hosted_button_id=VSXH3DH6PUFH2";
const donatePageUrl = "/pages/donate.html";
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
const exportForm = document.querySelector("[data-export-form]");
<<<<<<< HEAD

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

=======

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

>>>>>>> 30e6fe9012249aaa5cd7b82acbd2a54a53a17e66
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
<<<<<<< HEAD

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const donateControl = event.target.closest("[data-donate-link]");

  if (!donateControl || donateControl instanceof HTMLAnchorElement) {
    return;
  }

  event.preventDefault();
=======

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const donateControl = event.target.closest("[data-donate-link]");

  if (!donateControl || donateControl instanceof HTMLAnchorElement) {
    return;
  }

  event.preventDefault();
>>>>>>> 30e6fe9012249aaa5cd7b82acbd2a54a53a17e66
  window.location.assign(donatePageUrl);
});

const serializeDonationForm = (form) => {
  const formData = new FormData(form);

  return {
    donor_type: formData.get("donor_type") || "",
    donor_name: formData.get("donor_name") || "",
    business_or_organization_name:
      formData.get("business_or_organization_name") || "",
    email: formData.get("email") || "",
    amount: formData.get("amount") || "",
    phone: formData.get("phone") || "",
    address: formData.get("address") || "",
    city: formData.get("city") || "",
    state: formData.get("state") || "",
    zip: formData.get("zip") || "",
    source_campaign: formData.get("source_campaign") || "Website Donation",
    in_honor_enabled: formData.has("in_honor_enabled"),
    honor_type: formData.get("honor_type") || "in honor of",
    honoree_name: formData.get("honoree_name") || "",
    honor_message: formData.get("honor_message") || "",
    public_recognition_allowed: formData.has("public_recognition_allowed"),
    wants_thank_you_gift_or_card: formData.has("wants_thank_you_gift_or_card"),
  };
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));

const validateDonationClientSide = (payload) => {
  const errors = [];
  const amount = Number(String(payload.amount).replace(/[$,]/g, ""));

  if (!payload.donor_type) {
    errors.push({ field: "donor_type", message: "Choose a donor type." });
  }

  if (
    !String(payload.donor_name).trim() &&
    !String(payload.business_or_organization_name).trim()
  ) {
    errors.push({
      field: "donor_name",
      message: "Enter a name or business/organization name.",
    });
  }

  if (!isValidEmail(payload.email)) {
    errors.push({ field: "email", message: "Enter a valid email address." });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push({
      field: "amount",
      message: "Enter a donation amount greater than 0.",
    });
  }

  if (payload.in_honor_enabled && !String(payload.honoree_name).trim()) {
    errors.push({ field: "honoree_name", message: "Enter the honoree name." });
  }

  return errors;
};

const setFieldErrors = (form, errors = []) => {
  form.querySelectorAll("[data-error-for]").forEach((errorNode) => {
    errorNode.textContent = "";
  });

  form.querySelectorAll("[aria-invalid='true']").forEach((field) => {
    field.removeAttribute("aria-invalid");
  });

  errors.forEach((error) => {
    const errorNode = form.querySelector(`[data-error-for="${error.field}"]`);
    const field = form.elements[error.field];

    if (errorNode) {
      errorNode.textContent = error.message;
    }

    if (field instanceof HTMLElement) {
      field.setAttribute("aria-invalid", "true");
    }
  });
};

if (donationForm instanceof HTMLFormElement) {
  const honorToggle = donationForm.querySelector("[data-honor-toggle]");
  const honorFields = donationForm.querySelector("[data-honor-fields]");
  const statusNode = donationForm.querySelector("[data-form-status]");
  const submitButton = donationForm.querySelector("[data-submit-label]");
  const successPanel = document.querySelector("[data-donation-success]");
  let isSubmittingDonation = false;

  const setHonorFieldsState = () => {
    const isEnabled = honorToggle instanceof HTMLInputElement && honorToggle.checked;

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

      if (statusNode) {
        statusNode.textContent = "Please fix the highlighted fields.";
      }

      return;
    }

    isSubmittingDonation = true;
    donationForm.classList.add("is-submitting");

    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = true;
      submitButton.textContent = "Saving...";
    }

    if (statusNode) {
      statusNode.textContent = "Saving your donation information...";
    }

    try {
      const response = await fetch("/api/donations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        if (Array.isArray(data.errors)) {
          setFieldErrors(donationForm, data.errors);
          throw new Error("Please fix the highlighted fields.");
        }

        throw new Error(data.error || "Donation information could not be saved.");
      }

      const paypalLink = successPanel?.querySelector("[data-paypal-link]");

      if (paypalLink instanceof HTMLAnchorElement && data.paypal_url) {
        paypalLink.href = data.paypal_url;
      }

      donationForm.hidden = true;

      if (successPanel instanceof HTMLElement) {
        successPanel.hidden = false;
        successPanel.focus();
      }
    } catch (error) {
      isSubmittingDonation = false;
      donationForm.classList.remove("is-submitting");

      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
        submitButton.textContent = "Save my donation info";
      }

      if (statusNode) {
        statusNode.textContent = error.message || "Something went wrong. Please try again.";
      }
    }
  });
}

if (exportForm instanceof HTMLFormElement) {
  const statusNode = exportForm.querySelector("[data-export-status]");

  exportForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const token = String(new FormData(exportForm).get("export_token") || "").trim();

    if (!token) {
      if (statusNode) {
        statusNode.textContent = "Enter the export token.";
      }

      return;
    }

    if (statusNode) {
      statusNode.textContent = "Preparing CSV...";
    }

    try {
      const response = await fetch("/api/donations/export", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Donation records could not be exported.");
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);

      downloadLink.href = downloadUrl;
      downloadLink.download = `backpack-kidz-donations-${today}.csv`;
      downloadLink.click();
      URL.revokeObjectURL(downloadUrl);

      if (statusNode) {
        statusNode.textContent = "CSV downloaded.";
      }
    } catch (error) {
      if (statusNode) {
        statusNode.textContent = error.message || "Export failed.";
      }
    }
  });
}
<<<<<<< HEAD

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
=======

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
>>>>>>> 30e6fe9012249aaa5cd7b82acbd2a54a53a17e66
