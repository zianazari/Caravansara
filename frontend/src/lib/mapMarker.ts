/** A shared decorative house marker for exact listing locations on host and admin maps. */
export function createHouseMarker({ draggable = false }: { draggable?: boolean } = {}): HTMLSpanElement {
  const element = document.createElement("span");
  element.className = `grid size-10 place-items-center rounded-xl border-2 border-card bg-primary text-primary-foreground shadow-md${draggable ? " cursor-grab active:cursor-grabbing" : ""}`;
  element.setAttribute("aria-hidden", "true");
  element.dataset.mapMarker = "house";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.75");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("size-6", "pointer-events-none");
  for (const d of ["m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z", "M9 21v-8h6v8"]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  element.append(svg);
  return element;
}
