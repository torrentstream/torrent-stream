import makeFetchCookie from "fetch-cookie";

export type SessionCredentials = {
	username: string;
	password: string;
};

const createCookieFetch = () => makeFetchCookie(fetch);
type CookieFetch = ReturnType<typeof createCookieFetch>;

type AuthenticatedSessionOptions = {
	name: string;
	origin: string;
	loginUrl: string;
	requestTimeout: () => number;
	createLoginBody: (credentials: SessionCredentials) => BodyInit;
	isLoginSuccessful: (response: Response, redirectUrl?: URL) => boolean;
	isLoginRedirect: (redirectUrl?: URL) => boolean;
};

export class AuthenticatedSession {
	private client = createCookieFetch();
	private credentials?: SessionCredentials;
	private authenticated = false;
	private generation = 0;
	private loginPromise?: Promise<void>;

	constructor(private options: AuthenticatedSessionOptions) {}

	async fetch(url: string, credentials: SessionCredentials) {
		for (let attempt = 0; attempt < 2; attempt++) {
			await this.login(credentials);

			const generation = this.generation;
			const sessionClient = this.client;
			const response = await this.request(sessionClient, url);
			const redirectUrl = this.getRedirectUrl(response);
			if (!this.options.isLoginRedirect(redirectUrl)) return response;

			this.invalidate(generation);
		}

		throw new Error(`${this.options.name} session was rejected after login`);
	}

	private async login(credentials: SessionCredentials) {
		this.prepare(credentials);
		if (this.authenticated) return;
		if (this.loginPromise) return this.loginPromise;

		const generation = this.generation;
		const sessionClient = this.client;
		const loginPromise = (async () => {
			const response = await this.request(
				sessionClient,
				this.options.loginUrl,
				{
					method: "POST",
					body: this.options.createLoginBody(credentials),
				},
			);
			const redirectUrl = this.getRedirectUrl(response);

			if (!this.options.isLoginSuccessful(response, redirectUrl)) {
				throw new Error(
					`${this.options.name} login rejected (${response.status})`,
				);
			}

			if (generation === this.generation) this.authenticated = true;
		})();

		this.loginPromise = loginPromise;
		try {
			await loginPromise;
		} finally {
			if (this.loginPromise === loginPromise) this.loginPromise = undefined;
		}
	}

	private request(client: CookieFetch, url: string, init?: RequestInit) {
		return client(url, {
			...init,
			redirect: "manual",
			signal: AbortSignal.timeout(this.options.requestTimeout()),
		});
	}

	private prepare(credentials: SessionCredentials) {
		if (
			this.credentials?.username === credentials.username &&
			this.credentials.password === credentials.password
		) {
			return;
		}

		this.client = createCookieFetch();
		this.credentials = { ...credentials };
		this.authenticated = false;
		this.generation++;
		this.loginPromise = undefined;
	}

	private invalidate(generation: number) {
		if (generation !== this.generation) return;
		this.authenticated = false;
		this.generation++;
	}

	private getRedirectUrl(response: Response) {
		if (response.status !== 302) return undefined;
		const location = response.headers.get("location");
		if (!location) return undefined;

		try {
			return new URL(location, this.options.origin);
		} catch {
			return undefined;
		}
	}
}
