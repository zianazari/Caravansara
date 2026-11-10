// Types for image imports (import photo from "./x.jpg"), as Next.js declares them. next-env.d.ts has the same
// line, but it is generated and not committed, so CI's type check (before the build) would not see it
// (feature 020: the default listing picture is imported this way).
/// <reference types="next/image-types/global" />
