import { Sparkles } from 'lucide-react';

export function Logo() {
  return (
    <a className="brand" href="#top" aria-label="Artify Studio home">
      <span className="brand-mark"><Sparkles size={18} strokeWidth={2.4} /></span>
      <span>Artify</span><span className="brand-muted">Studio</span>
    </a>
  );
}
