"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import {
	Download,
	Eye,
	File,
	Film,
	Subtitles,
	Trash2,
	Upload,
} from "lucide-react";
import { useState } from "react";
import { Area, AreaChart } from "recharts";
import useSWR from "swr";
import { getTorrents, removeTorrent, type TorrentStats } from "@/app/actions";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { getReadableSize } from "@/lib/file";
import { FlipNumber } from "./flip-number";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

export function TorrentList({ torrents }: { torrents: TorrentStats[] }) {
	const [cardsParent] = useAutoAnimate();

	const { data, mutate } = useSWR("torrents", getTorrents, {
		fallbackData: torrents,
		refreshInterval: 1000,
	});

	return (
		<div ref={cardsParent} className="flex flex-col gap-6">
			{data.length === 0 && (
				<div
					key="no-torrents"
					className="p-12 text-center text-muted-foreground"
				>
					No torrents are added currently.
				</div>
			)}
			{data.map((torrent) => (
				<TorrentCard
					key={torrent.infoHash}
					torrent={torrent}
					onRemoved={async () => {
						await mutate();
					}}
				/>
			))}
		</div>
	);
}

function TorrentCard({
	torrent,
	onRemoved,
}: {
	torrent: TorrentStats;
	onRemoved: () => Promise<void>;
}) {
	const [filesParent] = useAutoAnimate();
	const [badgeParent] = useAutoAnimate();
	const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
	const [isRemoving, setIsRemoving] = useState(false);

	const displayName = torrent.name.split(".").join(".\u200B");

	const files = torrent.files.filter((file) => file.streams);

	const handleRemove = async () => {
		if (isRemoving) return;
		setIsRemoving(true);
		setRemoveDialogOpen(false);
		try {
			await removeTorrent(torrent.infoHash);
			await onRemoved();
		} finally {
			setIsRemoving(false);
		}
	};

	const interval = 5;
	const maxPoints = 60;
	const chartData = torrent.historicalSpeeds.filter(
		(value) => value.date.getSeconds() % interval === 0,
	);
	let lastDate = chartData[chartData.length - 1]?.date ?? new Date();
	while (chartData.length < maxPoints) {
		lastDate.setSeconds(lastDate.getSeconds() + interval);
		lastDate = new Date(lastDate);
		chartData.push({ date: lastDate, download: 0, upload: 0 });
	}

	const chartConfig: ChartConfig = {
		download: { label: "Download", color: "white" },
		upload: { label: "Upload", color: "var(--chart-2)" },
	};

	return (
		<Card>
			<CardContent className="flex flex-col gap-2">
				<div className="flex flex-col-reverse md:flex-row items-start md:items-center justify-between gap-2">
					<div className="md:text-lg font-bold">{displayName}</div>
					<div ref={badgeParent} className="flex items-center gap-2">
						{torrent.streams ? (
							<Badge className="bg-green-800 text-white">Streaming</Badge>
						) : (
							<Badge>Idle</Badge>
						)}
						<Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
							<DialogTrigger
								render={
									<Button
										size="xs"
										variant="destructive"
										className="h-5 rounded-full px-2 text-xs font-medium gap-1"
										disabled={isRemoving}
									/>
								}
							>
								<Trash2 />
								Remove
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Remove torrent?</DialogTitle>
									<DialogDescription>
										Are you sure you want to remove{" "}
										<span className="font-bold">{displayName}</span> from the
										torrent client?
									</DialogDescription>
								</DialogHeader>
								<DialogFooter>
									<DialogClose render={<Button variant="outline" />}>
										No
									</DialogClose>
									<Button
										variant="destructive"
										onClick={handleRemove}
										disabled={isRemoving}
									>
										Yes
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					<div className="flex items-center gap-2 text-muted-foreground">
						<Download size={14} />
						<FlipNumber>{torrent.downloadSpeed}</FlipNumber>
					</div>
					<div className="flex items-center gap-2 text-muted-foreground">
						<Upload size={14} />
						<FlipNumber>{torrent.uploadSpeed}</FlipNumber>
					</div>
					<div className="flex items-center gap-2 text-muted-foreground">
						<Eye size={14} />
						<FlipNumber>{torrent.streams}</FlipNumber>
					</div>
				</div>

				<ChartContainer config={chartConfig} className="aspect-auto h-32">
					<AreaChart data={chartData}>
						<defs>
							<linearGradient id="fillDownload" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-download)"
									stopOpacity={0.8}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-download)"
									stopOpacity={0.1}
								/>
							</linearGradient>
							<linearGradient id="fillUpload" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-upload)"
									stopOpacity={0.8}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-upload)"
									stopOpacity={0.1}
								/>
							</linearGradient>
						</defs>
						<Area
							dataKey="download"
							type="natural"
							fill="url(#fillDownload)"
							stroke="var(--color-download)"
							stackId="download"
						/>
						<Area
							dataKey="upload"
							type="natural"
							fill="url(#fillUpload)"
							stroke="var(--color-upload)"
							stackId="upload"
						/>
						<ChartTooltip
							cursor={false}
							content={({ active, payload }) => {
								if (!active || !payload?.length) return null;
								const date = payload[0]?.payload?.date;
								if (!date || date > new Date()) return null;
								const formattedPayload = payload.map((entry) => ({
									...entry,
									value: `${getReadableSize(entry.value as number)}/s`,
								}));
								return (
									<ChartTooltipContent
										active={true}
										payload={formattedPayload}
										labelFormatter={() => date.toLocaleTimeString()}
										indicator="dot"
									/>
								);
							}}
						/>
					</AreaChart>
				</ChartContainer>

				<div ref={filesParent}>
					{files.length > 0 && (
						<div key="header" className="mt-4 font-semibold">
							Files:
						</div>
					)}
					{files.map((file) => (
						<div
							key={file.path}
							className="flex items-start gap-2 text-muted-foreground"
						>
							<div className="mt-0.75">
								{file.isVideo ? (
									<Film size={14} />
								) : file.isSubtitle ? (
									<Subtitles size={14} />
								) : (
									<File size={14} />
								)}
							</div>
							{file.name.split(".").join(".\u200B")} ({file.size})
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
