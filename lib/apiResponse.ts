import { NextResponse } from "next/server";

/**
 * RFC 7807 Problem Details for HTTP APIs
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  error?: string; // 従来クライアントとの完全後方互換用
  invalidParams?: Array<{ name: string; reason: string }>;
  [key: string]: unknown;
}

export class ApiResponse {
  /**
   * 成功レスポンス（200 OK, 201 Created等）
   */
  static success<T>(data: T, status = 200, init?: ResponseInit): NextResponse<T> {
    return NextResponse.json(data, { status, ...init });
  }

  /**
   * RFC 7807 に準拠した統一エラーレスポンス（従来クライアントとの後方互換性を含む）
   */
  static problem(
    status: number,
    title: string,
    detail?: string,
    options?: {
      type?: string;
      instance?: string;
      invalidParams?: Array<{ name: string; reason: string }>;
      extra?: Record<string, unknown>;
    }
  ): NextResponse<ProblemDetails> {
    const defaultType = `https://httpstatuses.com/${status}`;
    const body: ProblemDetails = {
      type: options?.type || defaultType,
      title,
      status,
      ...(detail ? { detail, error: detail } : {}),
      ...(options?.instance ? { instance: options.instance } : {}),
      ...(options?.invalidParams ? { invalidParams: options.invalidParams } : {}),
      ...(options?.extra || {}),
    };

    return NextResponse.json(body, {
      status,
      headers: {
        "Content-Type": "application/problem+json",
      },
    });
  }

  /**
   * 400 Bad Request
   */
  static badRequest(detail: string, invalidParams?: Array<{ name: string; reason: string }>): NextResponse<ProblemDetails> {
    return this.problem(400, "Bad Request", detail, { invalidParams });
  }

  /**
   * 401 Unauthorized
   */
  static unauthorized(detail = "認証が必要です"): NextResponse<ProblemDetails> {
    return this.problem(401, "Unauthorized", detail);
  }

  /**
   * 403 Forbidden
   */
  static forbidden(detail = "アクセス権限がありません"): NextResponse<ProblemDetails> {
    return this.problem(403, "Forbidden", detail);
  }

  /**
   * 404 Not Found
   */
  static notFound(detail = "リソースが見つかりません"): NextResponse<ProblemDetails> {
    return this.problem(404, "Not Found", detail);
  }

  /**
   * 500 Internal Server Error
   */
  static internalError(detail = "サーバー内部エラーが発生しました"): NextResponse<ProblemDetails> {
    return this.problem(500, "Internal Server Error", detail);
  }
}
