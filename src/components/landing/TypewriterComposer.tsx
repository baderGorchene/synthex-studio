'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useInView, useReducedMotion } from './motion';

const PROMPTS = [
  'Is coffee actually bad for my sleep?',
  'What really caused the 2008 financial crisis?',
  'Which study method works best before exams?',
  'Should our startup charge per seat or per use?',
  'Why did the Roman Republic fall?'
];

/** A ruled notepad that keeps writing the kind of questions people bring. Clicking it starts sign-up. */
export function TypewriterComposer() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLAnchorElement>({ threshold: 0.3 });
  const [index, setIndex] = useState(0);
  const [length, setLength] = useState(0);
  const [erasing, setErasing] = useState(false);

  useEffect(() => {
    if (reduced || !inView) return;
    const prompt = PROMPTS[index];
    const done = !erasing && length === prompt.length;
    const empty = erasing && length === 0;
    const delay = done ? 1800 : empty ? 350 : erasing ? 22 : 55 + Math.random() * 45;
    const timer = setTimeout(() => {
      if (done) setErasing(true);
      else if (empty) { setErasing(false); setIndex(value => (value + 1) % PROMPTS.length); }
      else setLength(value => value + (erasing ? -1 : 1));
    }, delay);
    return () => clearTimeout(timer);
  }, [reduced, inView, index, length, erasing]);

  const text = reduced ? PROMPTS[0] : PROMPTS[index].slice(0, length);

  return (
    <Link href="/sign-up" className="typewriter" ref={ref} aria-label="Start free and build your first map">
      <span className="typewriter-lines">
        <span className="typewriter-text">{text}<i className="landing-demo-caret" /></span>
      </span>
      <span className="ink-button">Build my map <ArrowRight size={18} strokeWidth={1.75} /></span>
    </Link>
  );
}
