"use client";

import { useEffect, useRef } from "react";
import { mountDocScrollSpy } from "@/lib/proposalShared";

// Mounts the scroll-position dot nav for the server-rendered proposal
// document next to this component. Purely a browser-side enhancement —
// the document itself is already fully rendered server-side.
export default function DocScrollSpy() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mountDocScrollSpy(ref.current?.parentElement ?? document);
  }, []);

  return <div ref={ref} style={{ display: "none" }} aria-hidden="true" />;
}
