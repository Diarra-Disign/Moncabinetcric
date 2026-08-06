import { refuserActeReserve } from "../../../_acte-reserve"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return refuserActeReserve(request, "sign", id)
}
