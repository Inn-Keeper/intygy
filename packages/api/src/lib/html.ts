export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

/** Shared page chrome for the dashboard and evidence pages. */
export function pageShell(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:system-ui;max-width:52rem;margin:2rem auto;padding:0 1rem;color:#14201B}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #D9E1DB;padding:.5rem;text-align:left;font-size:.9rem}
h1,h2{letter-spacing:-.02em}.meta{color:#3D4A44}</style></head><body>${body}</body></html>`;
}
