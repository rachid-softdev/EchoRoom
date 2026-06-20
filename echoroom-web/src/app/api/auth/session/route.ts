import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    return Response.json(session);
  } catch (error) {
    return Response.json(
      { error: "Erreur interne du serveur" },
      { status: 500 },
    );
  }
}
