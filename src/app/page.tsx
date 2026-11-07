import { BestiaryGrid } from "@/components/home/BestiaryGrid";
import { Doors } from "@/components/home/Doors";
import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { ResumeBanner } from "@/components/home/ResumeBanner";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_1100px_600px_at_75%_8%,rgba(201,168,106,0.13),rgba(201,168,106,0)_70%),radial-gradient(ellipse_800px_500px_at_10%_60%,rgba(138,199,209,0.06),rgba(138,199,209,0)_70%),#08090D]">
      <SiteHeader />
      <main id="main" className="flex flex-col">
        <ResumeBanner />
        <Hero />
        <Doors />
        <BestiaryGrid />
        <HowItWorks />
      </main>
      <SiteFooter />
    </div>
  );
}
