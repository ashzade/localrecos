import { NextRequest, NextResponse } from 'next/server';
import { detectCityFromIp, extractIp } from '@/lib/geo';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ip = extractIp(request.headers);
  const city = (await detectCityFromIp(ip)) ?? 'Ottawa';

  return NextResponse.json({ city });
}
