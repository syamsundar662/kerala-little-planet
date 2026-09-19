import { areaBoxes, validPoint } from '../../world-area';
import type { Point } from '../../alappuzha-map';
import { downloadMap } from '../../world-map-provider';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const point: Point = [
    Number(url.searchParams.get('lon')),
    Number(url.searchParams.get('lat')),
  ];
  if (
    !url.searchParams.has('lon') ||
    !url.searchParams.has('lat') ||
    !validPoint(point)
  )
    return Response.json(
      { error: 'Choose a valid map location.' },
      { status: 400 },
    );
  const queries = areaBoxes(point)
    .map((b) => {
      const box = b.join(',');
      return `way[highway](${box});way[building](${box});way[natural=water](${box});way[waterway](${box});`;
    })
    .join('');
  try {
    const body = await downloadMap(
      `[out:json][timeout:20][maxsize:33554432];(${queries});out geom;`,
      request.signal,
    );
    return new Response(body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Map download unavailable. Please retry.',
      },
      { status: 503 },
    );
  }
}
