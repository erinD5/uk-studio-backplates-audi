import { NextResponse } from "next/server";
import { loadReferenceImagesFromPaths } from "@/lib/styleLibrary";
import {
  collectStudioParameters,
  buildStudioPrompt,
  matchStudioReferences,
  StudioParameterSelection,
  validateStudioSelection,
} from "@/lib/studioSystem";

interface StudioAgentsRequestBody {
  selection?: Partial<StudioParameterSelection>;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StudioAgentsRequestBody;
    const validation = validateStudioSelection(body.selection ?? {});
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: "Studio parameter validation failed.",
          issues: validation.errors,
        },
        { status: 400 },
      );
    }

    const collected = collectStudioParameters(validation.normalized);
    const referenceMatch = await matchStudioReferences(collected);
    const loadedReferences = await loadReferenceImagesFromPaths(referenceMatch.paths);
    const instruction = buildStudioPrompt(collected);

    return NextResponse.json(
      {
        parameters: collected,
        referencePaths: referenceMatch.paths,
        effectiveReferenceImages: loadedReferences.slice(0, 2),
        instruction,
        validation: {
          passed: true,
          checks: {
            gradientHexValuesValid: true,
            lightingDirectionValid: true,
            floorTypeValid: true,
            accentHexPopulatedWhenSelected:
              collected.accent.id === "none" ? true : Boolean(collected.accent.hex),
          },
        },
        diagnostics: {
          referenceLibraryLoadedCount: loadedReferences.length,
          usedGradientFamilyFallback: referenceMatch.usedFallback,
          mismatchLog: referenceMatch.mismatchLog,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error in studio agents route.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
