import { Sparkles } from 'lucide-react';

export function Logo() {
  return (
    <a className="brand" href="#top" aria-label="RenderFlow home">
      <span className="brand-mark"><Sparkles size={18} strokeWidth={2.4} /></span>
      <span>Render</span><span className="brand-muted">Flow</span>
    </a>
  );
}
