import { NextResponse } from "next/server";
import type { ApiError, ApiSuccess } from "@/types/api";

export function success<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ ok: true, data }, init);
}

export function failure(message: string, status = 400) {
  return NextResponse.json<ApiError>({ ok: false, error: message }, { status });
}
