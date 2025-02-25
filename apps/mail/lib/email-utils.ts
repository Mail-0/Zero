import { EMAIL_HTML_TEMPLATE } from "./constants";
import Color from "color";

export const template = (html: string) => {
  const htmlParser = new DOMParser();
  const doc = htmlParser.parseFromString(html, "text/html");
  const template = htmlParser.parseFromString(EMAIL_HTML_TEMPLATE, "text/html");
  Array.from(doc.head.children).forEach((child) => template.head.appendChild(child));
  template.body.innerHTML = doc.body.innerHTML;
  template.body.style.backgroundColor = getComputedStyle(document.body).getPropertyValue(
    "background-color",
  );

  template.querySelectorAll("a").forEach((a) => {
    if (a.href || !a.textContent) return;
    if (URL.canParse(a.textContent)) a.href = a.textContent;
    else if (a.textContent.includes("@")) a.href = `mailto:${a.textContent}`;
  });

  const quoteElements = [
    ".gmail_quote",
    "blockquote",
    '[class*="quote"]', // quote partial match for class names
    '[id*="quote"]', // quote partial match for id names
  ];

  for (const selector of quoteElements) {
    const element = template.querySelector(selector);
    if (!element) continue;
    const details = document.createElement("details");
    details.classList.add("auto-details");
    const summary = document.createElement("summary");
    details.appendChild(summary);
    details.appendChild(element.cloneNode(true));
    element.parentNode?.replaceChild(details, element);
    break;
  }

  return template.documentElement.outerHTML;
};

export const fixNonReadableColors = (rootElement: HTMLElement, minContrast = 3.5) => {
  const elements = Array.from<HTMLElement>(rootElement.querySelectorAll("*"));
  elements.unshift(rootElement);

  for (const el of elements) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;

    const textColor = Color(style.color);
    const effectiveBg = getEffectiveBackgroundColor(el);

    const blendedText =
      textColor.alpha() < 1 ? effectiveBg.mix(textColor, effectiveBg.alpha()) : textColor;
    const contrast = blendedText.contrast(effectiveBg);

    if (contrast < minContrast) {
      const blackContrast = Color("#000000").contrast(effectiveBg);
      const whiteContrast = Color("#ffffff").contrast(effectiveBg);
      el.style.color = blackContrast >= whiteContrast ? "#000000" : "#ffffff";
    }
  }
};

const getEffectiveBackgroundColor = (element: HTMLElement) => {
  let current: HTMLElement | null = element;
  while (current) {
    const bg = Color(getComputedStyle(current).backgroundColor);
    if (bg.alpha() >= 1) return bg.rgb();
    current = current.parentElement;
  }
  return Color("#ffffff");
};
