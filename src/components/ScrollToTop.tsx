import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  // useLayoutEffect fires before paint, ensuring scroll happens before render
  useLayoutEffect(() => {
    if (hash) return;
    // Instant scroll to top on route change
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, hash]);

  // Deep links like /#pricing: scroll to the section once the (lazy) page has rendered it
  useEffect(() => {
    if (!hash) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      let el: Element | null = null;
      try { el = document.querySelector(hash); } catch { /* invalid selector */ }
      if (el || ++tries > 20) {
        window.clearInterval(timer);
        el?.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
