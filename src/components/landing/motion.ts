'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

/** True while the element is on screen (or once, with `once`). */
export function useInView<T extends Element>(options: { once?: boolean; threshold?: number; rootMargin?: string } = {}): [RefObject<T | null>, boolean] {
  const { once = false, threshold = 0.35, rootMargin = '0px' } = options;
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        if (once) observer.disconnect();
      } else if (!once) {
        setInView(false);
      }
    }, { threshold, rootMargin });
    observer.observe(element);
    return () => observer.disconnect();
  }, [once, threshold, rootMargin]);
  return [ref, inView];
}

/** Adds `is-in` to every `[data-reveal]` inside the root as it scrolls into view. */
export function useRevealOnScroll(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    element.classList.add('motion-ready');
    const targets = element.querySelectorAll<HTMLElement>('[data-reveal]');
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    targets.forEach(target => observer.observe(target));
    return () => observer.disconnect();
  }, [root]);
}

/** Scales a fixed-size board to the width of its frame. */
export function useFitScale<T extends HTMLElement>(boardWidth: number): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fit = (width: number) => setScale(Math.min(1, width / boardWidth));
    fit(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => fit(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [boardWidth]);
  return [ref, scale];
}
