"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { InstallDialog } from "./install-dialog";
import { StremioIcon } from "./stremio-icon";
import { Button } from "./ui/button";

export function InstallButton() {
	const [protocol, setProtocol] = useState("");
	const [host, setHost] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);

	const https = useMemo(() => protocol === "https:", [protocol]);

	useEffect(() => {
		setProtocol(window.location.protocol);
		setHost(window.location.host);
	}, []);

	const props = https
		? {
				nativeButton: false,
				render: <Link href={`stremio://${host}/api/manifest.json`} />,
			}
		: { onClick: () => setDialogOpen(true) };

	return (
		<>
			<Button
				className="bg-[#5a4cad] hover:bg-[#695dac] text-white rounded-full"
				{...props}
			>
				<StremioIcon />
				<span className="hidden md:inline">Install Stremio Addon</span>
				<span className="md:hidden">Install</span>
			</Button>

			<InstallDialog
				open={dialogOpen}
				setOpen={setDialogOpen}
				protocol={protocol}
				host={host}
			/>
		</>
	);
}
