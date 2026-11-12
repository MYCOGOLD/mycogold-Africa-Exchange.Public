import { submitKyc } from "../../../lib/mycg/mycogoldKyc";

export async function POST(request: Request) {
  const { userId, idNumber, selfiePhoto } = await request.json();
  const result = submitKyc(userId, idNumber, selfiePhoto);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}