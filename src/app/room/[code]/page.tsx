import { notFound } from "next/navigation";
import { RoomClient } from "@/components/room-client";

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;

  if (!code || code.length < 4) {
    notFound();
  }

  return <RoomClient roomCode={code.toUpperCase()} />;
}
