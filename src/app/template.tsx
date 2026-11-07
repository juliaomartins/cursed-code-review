import type { ReactNode } from "react";

/** Every navigation enters a new room of the crypt: the page fades up out of the dark (none under reduced motion). */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="room-enter">{children}</div>;
}
