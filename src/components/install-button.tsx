"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { InstallDialog } from "./install-dialog";
import { StremioIcon } from "./stremio-icon";
import { Button } from "./ui/button";

export function InstallButton({ fullWidth = false }: { fullWidth?: boolean }) {
	const { t } = useLanguage();
	const [protocol, setProtocol] = useState("");
	const [host, setHost] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);

	useEffect(() => {
		setProtocol(window.location.protocol);
		setHost(window.location.host);
	}, []);

	return (
		<>
			<Button
				className={`bg-[#5a4cad] hover:bg-[#695dac] text-white rounded-full ${fullWidth ? "w-full min-h-11" : ""}`}
				onClick={() => setDialogOpen(true)}
			>
				<StremioIcon />
				{fullWidth ? (
					t("Install Stremio Addon")
				) : (
					<>
						<span className="hidden md:inline">
							{t("Install Stremio Addon")}
						</span>
						<span className="md:hidden">{t("Install")}</span>
					</>
				)}
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
