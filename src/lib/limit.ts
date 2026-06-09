export function createLimit(concurrency: number) {
	let active = 0;
	const queue: (() => void)[] = [];

	return async function limit<T>(task: () => Promise<T>): Promise<T> {
		while (active >= concurrency) {
			await new Promise<void>((resolve) => queue.push(resolve));
		}
		active++;
		try {
			return await task();
		} finally {
			active--;
			queue.shift()?.();
		}
	};
}
