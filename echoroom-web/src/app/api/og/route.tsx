import { ImageResponse } from "@vercel/og";
import { db } from "@/server/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Missing scenario id", { status: 400 });
  }

  try {
    // Only serve OG images for PUBLIC + APPROVED scenarios (no auth on this route)
    const scenario = await db.scenario.findFirst({
      where: {
        id,
        visibility: "PUBLIC",
        moderationStatus: "APPROVED",
      },
      select: {
        title: true,
        description: true,
        character: { select: { name: true, avatarUrl: true } },
        creator: { select: { username: true } },
      },
    });

    if (!scenario) {
      return new Response("Scenario not found", { status: 404 });
    }

    // Try to load font for better rendering — fallback to default sans on failure
    let interFont: ArrayBuffer | null = null;
    try {
      const fontResponse = await fetch(
        "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff",
        { signal: AbortSignal.timeout(5000) },
      );
      interFont = await fontResponse.arrayBuffer();
    } catch {
      // Font loading failed — ImageResponse will use default sans-serif
    }

    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0a0b 0%, #141416 50%, #1a1a2e 100%)",
          padding: "60px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="#06b6d4"
            role="img"
            aria-label="EchoRoom AI"
          >
            <title>EchoRoom AI</title>
            <circle cx="12" cy="12" r="10" />
          </svg>
          <span style={{ color: "#06b6d4", fontSize: "24px", fontWeight: 600 }}>EchoRoom AI</span>
        </div>
        <h1
          style={{
            fontSize: "48px",
            fontWeight: 700,
            color: "#fafafa",
            textAlign: "center",
            margin: "0 0 16px",
            lineHeight: 1.2,
            maxWidth: "800px",
          }}
        >
          {scenario.title}
        </h1>
        <p
          style={{
            fontSize: "24px",
            color: "#a1a1aa",
            textAlign: "center",
            margin: 0,
          }}
        >
          {scenario.character?.name ?? "Personnage"} · Créé par{" "}
          {scenario.creator?.username ?? "un membre"}
        </p>
      </div>,
      {
        width: 1200,
        height: 630,
        ...(interFont ? { fonts: [{ name: "Inter", data: interFont, weight: 400 }] } : {}),
      },
    );
  } catch (_error) {
    // Fallback: redirect to character avatar
    const scenario = await db.scenario.findUnique({
      where: { id },
      select: { character: { select: { avatarUrl: true } } },
    });
    if (scenario?.character?.avatarUrl) {
      return Response.redirect(scenario.character.avatarUrl, 302);
    }
    return new Response("Failed to generate OG image", { status: 500 });
  }
}
