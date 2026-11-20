import { defineRule } from "a11yfix-core";

// Tier 1: what an image means is a judgment call. There is no deterministic
// fix that is right more often than it is wrong (file-name alt text is the
// classic false fix, and the verifier rejects it).
export const imageAlt = defineRule({
  id: "image-alt",
  version: "1.0.0",
  axe: "image-alt",
  wcag: ["1.1.1"],
  level: 1,
  tier: 1,
  confidence: "medium",
  description: "Images must have a text alternative that conveys their purpose, or an empty alt when decorative.",
  declines: [
    "always: a text alternative depends on what the image means on the page (tier 1, or a person)",
  ],
  guidance: [
    "Describe the image's purpose (what it communicates or what it does), not its appearance.",
    "If the image is inside a link or button, the alt must describe the destination or action.",
    'If the image is purely decorative or its information is already in adjacent text, use alt="", unless it is the only content of a link or button.',
    "Never use the file name, and never use generic words such as image, picture, photo, icon.",
  ].join("\n"),
});
