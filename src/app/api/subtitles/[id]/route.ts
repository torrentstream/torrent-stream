import { NextResponse } from "next/server";
import {
	downloadOpenSubtitle,
	subtitleErrorMessage,
} from "@/lib/media/opensubtitles";

export async function GET(
	_request: Request,
	context: RouteContext<"/api/subtitles/[id]">,
) {
	const { id } = await context.params;
	if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
		return NextResponse.json(
			{ error: "Invalid subtitle ID." },
			{ status: 400 },
		);
	try {
		return new Response(await downloadOpenSubtitle(Number(id)), {
			headers: {
				"Content-Type": "application/x-subrip; charset=utf-8",
				"Cache-Control": "private, max-age=86400",
			},
		});
	} catch (error) {
		return NextResponse.json(
			{ error: subtitleErrorMessage(error) },
			{ status: 502 },
		);
	}
}
