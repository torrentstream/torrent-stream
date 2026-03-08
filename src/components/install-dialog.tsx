"use client";

import { Check, Loader2 } from "lucide-react";
import { type Dispatch, type SetStateAction, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError } from "./ui/field";
import { Label } from "./ui/label";

type StremioAuthMethod = "key" | "credentials";

interface StremioAuthResponse {
	result: {
		authKey: string;
	};
}

interface StremioAddonCollectionResponse {
	result: {
		addons: Array<{
			manifest: unknown;
			transportUrl: string;
			transportName: string;
			flags: {
				official: boolean;
				protected: boolean;
			};
		}>;
	};
}

export function InstallDialog({
	open,
	setOpen,
	protocol,
	host,
}: {
	open: boolean;
	setOpen: Dispatch<SetStateAction<boolean>>;
	protocol: string;
	host: string;
}) {
	const [authMethod, setAuthMethod] = useState<StremioAuthMethod>("key");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [authKey, setAuthKey] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const handleInstall = async () => {
		setLoading(true);
		setError(null);
		setSuccess(false);

		try {
			let finalAuthKey = authKey;

			// If using credentials, fetch authKey first
			if (authMethod === "credentials") {
				if (!email || !password) {
					throw new Error("Email and password are required");
				}

				const authResponse = await fetch("https://api.strem.io/api/login", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						email,
						password,
						type: "Login",
					}),
				});

				if (!authResponse.ok) {
					throw new Error(
						"Failed to authenticate. Please check your credentials.",
					);
				}

				const authData: StremioAuthResponse = await authResponse.json();
				finalAuthKey = authData.result?.authKey;

				if (!finalAuthKey) {
					throw new Error(
						"Failed to authenticate. Please check your credentials.",
					);
				}
			} else {
				if (!authKey) {
					throw new Error("Auth key is required");
				}
			}

			// Fetch current addon collection
			const collectionResponse = await fetch(
				"https://api.strem.io/api/addonCollectionGet",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						type: "AddonCollectionGet",
						authKey: finalAuthKey,
						update: true,
					}),
				},
			);

			if (!collectionResponse.ok) {
				throw new Error(
					"Failed to fetch addons. Please check your credentials.",
				);
			}

			const collectionData: StremioAddonCollectionResponse =
				await collectionResponse.json();

			if (!collectionData.result?.addons) {
				throw new Error(
					"Failed to fetch addons. Please check your credentials.",
				);
			}

			// Fetch the actual manifest object
			const manifestUrl = `${protocol}//${host}/api/manifest.json`;
			const manifestResponse = await fetch(manifestUrl);

			if (!manifestResponse.ok) {
				throw new Error("Failed to fetch addon manifest. Please try again.");
			}

			const manifest = await manifestResponse.json();

			// Prepare the addon entry with the manifest object
			const transportUrl = `${protocol}//${host}/api/manifest.json`;
			const newAddon = {
				transportUrl,
				transportName: "",
				flags: {
					official: false,
					protected: false,
				},
				manifest,
			};

			// Replace addon if it exists with same transportUrl, otherwise add it
			const existingAddons = collectionData.result.addons || [];
			const updatedAddons = existingAddons.some(
				(addon) => addon.transportUrl === transportUrl,
			)
				? existingAddons.map((addon) =>
						addon.transportUrl === transportUrl ? newAddon : addon,
					)
				: [...existingAddons, newAddon];

			// Update addon collection
			const setResponse = await fetch(
				"https://api.strem.io/api/addonCollectionSet",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						type: "AddonCollectionSet",
						authKey: finalAuthKey,
						addons: updatedAddons,
					}),
				},
			);

			if (!setResponse.ok) {
				throw new Error("Failed to install addon. Please try again.");
			}

			setSuccess(true);
			setEmail("");
			setPassword("");
			setAuthKey("");

			// Close dialog after a short delay
			closeTimeoutRef.current = setTimeout(() => {
				setOpen(false);
				setSuccess(false);
			}, 3000);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to install addon.");
		} finally {
			setLoading(false);
		}
	};

	const handleOpenChange = (open: boolean) => {
		if (closeTimeoutRef.current) {
			clearTimeout(closeTimeoutRef.current);
			closeTimeoutRef.current = null;
		}
		setOpen(open);
		setTimeout(() => {
			setLoading(false);
			setError(null);
			setSuccess(false);
			setEmail("");
			setPassword("");
			setAuthKey("");
		}, 500);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent showCloseButton={!loading}>
				<DialogHeader>
					<DialogTitle>Install Stremio Addon</DialogTitle>
					<DialogDescription>
						Please authenticate with Stremio. Your credentials will be sent
						directly to Stremio's API from your browser. Nothing is stored on
						the server.
					</DialogDescription>
				</DialogHeader>

				<div className="flex gap-2">
					<Button
						variant={authMethod === "key" ? "default" : "outline"}
						className="flex-1"
						onClick={() => setAuthMethod("key")}
					>
						Auth Key
					</Button>
					<Button
						variant={authMethod === "credentials" ? "default" : "outline"}
						className="flex-1"
						onClick={() => setAuthMethod("credentials")}
					>
						Email & Password
					</Button>
				</div>

				{authMethod === "key" && (
					<Field>
						<Label htmlFor="authKey">Stremio Auth Key</Label>
						<Input
							id="authKey"
							type="password"
							placeholder="Enter your Stremio auth key"
							value={authKey}
							onChange={(e) => setAuthKey(e.target.value)}
							disabled={loading}
						/>
						<FieldDescription className="text-xs">
							Get your auth key from Stremio Web: open DevTools console and run{" "}
							<span className="font-mono bg-accent p-0.5 rounded">
								JSON.parse(localStorage.getItem("profile")).auth.key
							</span>
						</FieldDescription>
					</Field>
				)}

				{authMethod === "credentials" && (
					<>
						<Field>
							<Label htmlFor="email">Stremio Email</Label>
							<Input
								id="email"
								type="email"
								placeholder="Enter your Stremio email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								disabled={loading}
							/>
						</Field>
						<Field>
							<Label htmlFor="password">Stremio Password</Label>
							<Input
								id="password"
								type="password"
								placeholder="Enter your Stremio password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								disabled={loading}
							/>
						</Field>
					</>
				)}

				{error && <FieldError>{error}</FieldError>}

				<DialogFooter>
					<Button
						onClick={handleInstall}
						disabled={loading || success}
						className="w-full text-white transition-all bg-[#5a4cad] hover:bg-[#695dac]"
					>
						{loading ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Installing Addon...
							</>
						) : success ? (
							<>
								<Check className="mr-2 h-4 w-4" />
								Installed Addon Successfully!
							</>
						) : (
							"Install Addon"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
