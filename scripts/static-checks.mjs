#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const publishRoot = join(root, "BackPackKidzWebsite");
const mode = process.argv[2];
const failures = [];

const walk = (directory, extension) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? walk(path, extension)
      : !extension || extname(entry.name) === extension
        ? [path]
        : [];
  });

const htmlFiles = walk(publishRoot, ".html");
const report = (file, message) => failures.push(`${relative(root, file)}: ${message}`);

const attributeValues = (source, names) => {
  const pattern = new RegExp(`\\b(?:${names.join("|")})\\s*=\\s*["']([^"']+)["']`, "giu");
  return [...source.matchAll(pattern)].map((match) => match[1]);
};

const candidateExists = (path) => {
  const candidates = [
    path,
    `${path}.html`,
    `${path}.js`,
    `${path}.mjs`,
    join(path, "index.html"),
  ];
  return candidates.some((candidate) => {
    try {
      return statSync(candidate).isFile();
    } catch {
      return false;
    }
  });
};

const checkLinks = () => {
  for (const file of htmlFiles) {
    const source = readFileSync(file, "utf8");
    const renderedSource = source.replace(/<!--[\s\S]*?-->/gu, "");
    const values = attributeValues(renderedSource, ["href", "src", "action"]);

    for (const srcset of attributeValues(renderedSource, ["srcset"])) {
      values.push(...srcset.split(",").map((part) => part.trim().split(/\s+/u)[0]));
    }

    for (const rawValue of values) {
      if (/^(?:https?:|mailto:|tel:|data:|javascript:)/iu.test(rawValue)) {
        continue;
      }

      if (rawValue.startsWith("#")) {
        const id = rawValue.slice(1);
        if (id && !new RegExp(`\\bid=["']${id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}["']`, "u").test(source)) {
          report(file, `fragment target ${rawValue} does not exist`);
        }
        continue;
      }

      const pathname = decodeURIComponent(rawValue.split(/[?#]/u)[0]);
      if (!pathname) continue;

      if (pathname.startsWith("/api/")) {
        const endpoint = pathname.slice(5).split("/")[0];
        if (!candidateExists(join(root, "netlify", "functions", endpoint))) {
          report(file, `API action ${pathname} has no Netlify Function`);
        }
        continue;
      }

      const target = pathname.startsWith("/")
        ? resolve(publishRoot, `.${pathname}`)
        : resolve(dirname(file), pathname);

      if (target !== publishRoot && !target.startsWith(`${publishRoot}${sep}`)) {
        report(file, `internal target escapes the publish directory: ${rawValue}`);
      } else if (!candidateExists(target)) {
        report(file, `internal target does not exist: ${rawValue}`);
      }
    }
  }
};

const checkAccessibility = () => {
  for (const file of htmlFiles) {
    const source = readFileSync(file, "utf8");

    if (!/<html\b[^>]*\blang=["'][^"']+["']/iu.test(source)) report(file, "missing html lang");
    if (!/<meta\b[^>]*\bname=["']viewport["']/iu.test(source)) report(file, "missing viewport meta");
    if (!/<a\b[^>]*class=["'][^"']*skip-link[^"']*["'][^>]*href=["']#content["']/iu.test(source)) report(file, "missing skip link to #content");
    if (!/<main\b[^>]*\bid=["']content["']/iu.test(source)) report(file, "missing main#content");
    if (!/<h1\b/iu.test(source)) report(file, "missing h1");

    const ids = [...source.matchAll(/\bid=["']([^"']+)["']/giu)].map((match) => match[1]);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    for (const id of new Set(duplicateIds)) report(file, `duplicate id "${id}"`);

    for (const match of source.matchAll(/<img\b[^>]*>/giu)) {
      if (!/\balt=["'][^"']*["']/iu.test(match[0])) report(file, "image missing alt attribute");
    }

    for (const match of source.matchAll(/<a\b[^>]*\btarget=["']_blank["'][^>]*>/giu)) {
      if (!/\brel=["'][^"']*noopener[^"']*["']/iu.test(match[0])) report(file, "target=_blank link missing rel=noopener");
    }

    for (const match of source.matchAll(/<(?:input|select|textarea)\b[^>]*\bid=["']([^"']+)["'][^>]*>/giu)) {
      if (/\btype=["']hidden["']/iu.test(match[0])) continue;
      const id = match[1].replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      if (!new RegExp(`<label\\b[^>]*\\bfor=["']${id}["']`, "iu").test(source)) {
        report(file, `form control #${match[1]} has no matching label`);
      }
    }
  }
};

const checkResponsive = () => {
  for (const file of htmlFiles) {
    const source = readFileSync(file, "utf8");
    if (!/<meta\b[^>]*content=["'][^"']*width=device-width[^"']*["'][^>]*>/iu.test(source)) {
      report(file, "viewport is not width=device-width");
    }
  }

  const css = readFileSync(join(publishRoot, "style.css"), "utf8");
  for (const breakpoint of [1100, 900, 640, 480]) {
    if (!new RegExp(`@media[^\\{]*max-width:\\s*${breakpoint}px`, "iu").test(css)) {
      report(join(publishRoot, "style.css"), `missing established ${breakpoint}px responsive breakpoint`);
    }
  }

  if (!/prefers-reduced-motion:\s*reduce/iu.test(css)) {
    report(join(publishRoot, "style.css"), "missing reduced-motion media query");
  }
};

const checkSecurity = () => {
  const hostedPayPal = "https://www.paypal.com/donate/?hosted_button_id=VSXH3DH6PUFH2";
  const script = readFileSync(join(publishRoot, "script.js"), "utf8");
  const donate = readFileSync(join(publishRoot, "pages", "donate.html"), "utf8");

  if (!script.includes(hostedPayPal)) report(join(publishRoot, "script.js"), "hosted PayPal boundary changed");
  if (!donate.includes(hostedPayPal)) report(join(publishRoot, "pages", "donate.html"), "hosted PayPal boundary changed");

  for (const file of walk(join(root, "netlify", "functions"))) {
    if (file.endsWith("paypal-ipn.js")) continue;
    if (/\bstatus\s*=\s*["']Completed["']/u.test(readFileSync(file, "utf8"))) {
      report(file, "marks a payment Completed outside paypal-ipn.js");
    }
  }

  const expectedForms = new Map([
    ["pages/contact.html", "/api/contacts"],
    ["pages/get-involved.html", "/api/volunteers"],
    ["pages/sponsor.html", "/api/sponsorships"],
  ]);

  for (const [path, endpoint] of expectedForms) {
    const file = join(publishRoot, ...path.split("/"));
    if (!readFileSync(file, "utf8").includes(`action="${endpoint}"`)) {
      report(file, `expected form action ${endpoint} is missing`);
    }
  }

  if (!/data-donation-form/u.test(donate) || !script.includes('fetch("/api/donations"')) {
    report(join(publishRoot, "pages", "donate.html"), "donation form endpoint boundary changed");
  }

  const netlifyConfig = readFileSync(join(root, "netlify.toml"), "utf8");
  const redirects = [
    "/about-us/how-it-works/*",
    "/about-us/testimonials/*",
    "/about-us/*",
    "/about-page/*",
    "/contact-page/*",
    "/donate-now/*",
    "/program-page/*",
  ];
  let previous = -1;

  for (const redirect of redirects) {
    const index = netlifyConfig.indexOf(`from = "${redirect}"`);
    if (index < 0) report(join(root, "netlify.toml"), `missing redirect ${redirect}`);
    if (index >= 0 && index <= previous) report(join(root, "netlify.toml"), `redirect order changed at ${redirect}`);
    previous = index;
  }

  if (
    walk(join(root, "netlify", "functions")).some((file) =>
      /publication|bonsai/iu.test(relative(join(root, "netlify", "functions"), file))
    )
  ) {
    report(join(root, "netlify", "functions"), "runtime publication endpoint is forbidden");
  }
};

const checks = {
  links: checkLinks,
  accessibility: checkAccessibility,
  responsive: checkResponsive,
  security: checkSecurity,
};

if (!checks[mode]) {
  process.stderr.write(`Usage: node scripts/static-checks.mjs ${Object.keys(checks).join("|")}\n`);
  process.exit(2);
}

checks[mode]();

if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`${mode} checks passed (${htmlFiles.length} HTML files).\n`);
