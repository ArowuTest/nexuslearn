import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/review") {
    return NextResponse.rewrite(new URL("/review/index.html", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/review"] };
