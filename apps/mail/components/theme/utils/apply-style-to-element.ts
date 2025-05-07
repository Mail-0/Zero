export function applyStyleToElement(
  element: HTMLElement,
  key: string,
  value: string
) {
  element.setAttribute(
    `style`,
    `${element.getAttribute("style") || ""}--${key}: ${value};`
  );
}
