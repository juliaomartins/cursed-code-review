import type { Metadata } from "next";
import { MapView } from "@/components/map/MapView";

export const metadata: Metadata = { title: "Haunted Map" };

export default function MapPage() {
  return <MapView />;
}
