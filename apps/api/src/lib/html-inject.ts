export function injectTailwind(html: string): string {
  const cdnScript = '<script src="https://cdn.tailwindcss.com"></script>';
  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>${cdnScript}`);
  }
  return `<!DOCTYPE html><html><head>${cdnScript}</head><body>${html}</body></html>`;
}
