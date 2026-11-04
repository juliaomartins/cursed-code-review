import type { Metadata } from "next";
import { Suspense } from "react";
import { CryptWorkspace } from "@/components/crypt/CryptWorkspace";

export const metadata: Metadata = { title: "The Crypt" };

export default function CryptPage() {
  return (
    <Suspense>
      <CryptWorkspace />
    </Suspense>
  );
}
