import { NextResponse } from "next/server";

let globalServerSettings: Record<string, any> = {
  showStudentTalkTab: true,
};

export async function GET() {
  try {
    return NextResponse.json({
      settings: globalServerSettings,
      showStudentTalkTab: globalServerSettings.showStudentTalkTab !== false,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    globalServerSettings = {
      ...globalServerSettings,
      ...body,
    };
    return NextResponse.json({
      success: true,
      settings: globalServerSettings,
      showStudentTalkTab: globalServerSettings.showStudentTalkTab !== false,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
