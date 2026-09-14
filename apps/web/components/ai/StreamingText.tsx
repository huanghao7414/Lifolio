'use client';

/** Displays received stream content with a cursor while generation is active. */
export default function StreamingText({ text }: { text: string }) {
  return <span>{text}<span className="inline-block w-0.5 h-4 bg-white ml-0.5 animate-pulse align-middle" /></span>;
}
