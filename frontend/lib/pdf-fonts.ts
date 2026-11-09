import { Font } from "@react-pdf/renderer";

let registered = false;

/** Register Japanese-capable fonts once (client-side PDF only). */
export function ensurePdfFonts() {
  if (registered) return;
  Font.register({
    family: "NotoSansJP",
    fonts: [
      { src: "/fonts/NotoSansJP-Regular.ttf", fontWeight: 400 },
      { src: "/fonts/NotoSansJP-Bold.ttf", fontWeight: 700 },
    ],
  });
  // Avoid odd hyphenation of Japanese / mixed text
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
