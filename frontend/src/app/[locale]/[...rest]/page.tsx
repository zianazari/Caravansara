import { notFound } from "next/navigation";

/**
 * Any address under a language that matches no page, such as /fa/no-such-page, ends here and shows the
 * site's own not-found page inside the layout, with the page's language and direction. Without it Next.js
 * shows its default 404 outside the layout, without lang on <html> (found by the browser check,
 * specs/007-caravansara-theme T041).
 */
export default function CatchAll() {
  notFound();
}
