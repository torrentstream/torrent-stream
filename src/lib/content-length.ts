import type { ServerResponse } from "node:http";

/**
 * Next.js removes Content-Length from route handler responses, so routes that
 * know the size (the file route, for players probing and seeking) send it in
 * this header instead, and the server restores it.
 */
export const contentLengthHeader = "x-content-length";

/**
 * Turns `contentLengthHeader` back into Content-Length when headers are sent,
 * unless the body is being compressed: the size would then be wrong.
 */
export function forwardContentLength(res: ServerResponse) {
	const writeHead = res.writeHead;
	res.writeHead = function (this: ServerResponse, ...args: unknown[]) {
		const length = this.getHeader(contentLengthHeader);
		if (length !== undefined) {
			this.removeHeader(contentLengthHeader);
			if (!this.hasHeader("content-encoding")) {
				this.setHeader("content-length", length);
			}
		}
		return (writeHead as (...args: unknown[]) => ServerResponse).apply(
			this,
			args,
		);
	} as ServerResponse["writeHead"];
}
