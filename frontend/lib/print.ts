/** Print without browser header/footer title text when possible. */
export function printDocument() {
  const previousTitle = document.title;
  document.title = " ";
  const restore = () => {
    document.title = previousTitle;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
  // Fallback if afterprint does not fire in some browsers
  window.setTimeout(restore, 1000);
}
