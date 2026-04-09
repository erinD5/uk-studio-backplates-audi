import { NextResponse } from "next/server";

import { getArtDirectionBankImages } from "@/lib/artDirectionBank";

export async function GET() {
  try {
    const images = await getArtDirectionBankImages();
    return NextResponse.json(
      {
        images,
        count: images.length,
        hint:
          images.length === 0
            ? "Add images to public/art-direction-bank to populate the library."
            : undefined,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load art direction bank.",
      },
      { status: 500 },
    );
  }
}
