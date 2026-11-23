import { Eye, EyeOff, GripVertical } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProviderId } from "@/lib/config/schema";

export function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="space-y-6">
			<h2 className="flex min-h-10 items-center text-xl font-semibold">
				{title}
			</h2>
			<Card>
				<CardContent className="flex flex-col gap-6">{children}</CardContent>
			</Card>
		</section>
	);
}

export interface ProviderSortProps {
	provider: ProviderId;
	name: string;
	draggedProvider: React.RefObject<ProviderId | undefined>;
	onMove: (dragged: ProviderId, target: ProviderId) => void;
}

export function ProviderBox({
	children,
	sort,
}: {
	children: React.ReactNode;
	sort?: ProviderSortProps;
}) {
	const { t } = useLanguage();
	return (
		<fieldset
			aria-label={sort ? t("{name} provider", { name: sort.name }) : undefined}
			className="rounded-xl border p-4"
			onDragEnter={(event) => {
				if (!sort) return;
				const dragged = sort.draggedProvider.current;
				if (!dragged || dragged === sort.provider) return;
				event.preventDefault();
				sort.onMove(dragged, sort.provider);
			}}
			onDragOver={(event) => {
				if (sort?.draggedProvider.current) event.preventDefault();
			}}
			onDrop={(event) => {
				if (!sort) return;
				event.preventDefault();
				sort.draggedProvider.current = undefined;
			}}
		>
			{sort ? (
				<div className="flex items-start gap-2">
					<button
						type="button"
						draggable
						aria-label={t("Reorder {name}", { name: sort.name })}
						className="mt-0.5 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
						onDragStart={(event) => {
							sort.draggedProvider.current = sort.provider;
							event.dataTransfer.effectAllowed = "move";
							event.dataTransfer.setData("text/plain", sort.provider);
						}}
						onDragEnd={() => {
							sort.draggedProvider.current = undefined;
						}}
					>
						<GripVertical className="size-5" />
					</button>
					<div className="min-w-0 flex-1">{children}</div>
				</div>
			) : (
				children
			)}
		</fieldset>
	);
}

export function Toggle({
	label,
	description,
	checked,
	disabled = false,
	onChange,
}: {
	label: string;
	description?: string;
	checked: boolean;
	disabled?: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<label
			className={`flex justify-between gap-4 ${
				description ? "min-h-11 items-start" : "items-center"
			} ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
		>
			<span>
				<span className="block font-medium">{label}</span>
				{description && (
					<span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
						{description}
					</span>
				)}
			</span>
			<input
				type="checkbox"
				checked={checked}
				disabled={disabled}
				onChange={(event) => onChange(event.target.checked)}
				className="mt-0.5 size-5 shrink-0 accent-primary"
			/>
		</label>
	);
}

export function NumberField({
	label,
	description,
	value,
	unit,
	min,
	step = 1,
	valueResolution = 0,
	onChange,
}: {
	label: string;
	description?: string;
	value: number;
	unit?: string;
	min?: number;
	step?: number | "any";
	valueResolution?: number;
	onChange: (value: number) => void;
}) {
	const { t } = useLanguage();
	const id = useId();
	const normalizedValue = String(Number.isFinite(value) ? value : 0);
	const [inputValue, setInputValue] = useState(normalizedValue);
	const [editing, setEditing] = useState(false);

	useEffect(() => {
		if (editing) return;
		const displayedValue = Number(inputValue);
		const tolerance =
			valueResolution / 2 +
			Number.EPSILON * Math.max(Math.abs(value), Math.abs(displayedValue), 1);
		if (
			Number.isFinite(displayedValue) &&
			Math.abs(displayedValue - value) <= tolerance
		) {
			return;
		}
		setInputValue(normalizedValue);
	}, [editing, inputValue, normalizedValue, value, valueResolution]);

	return (
		<div className="flex flex-col gap-2">
			<Label htmlFor={id}>{t(label)}</Label>
			<div className="flex items-center gap-2">
				<Input
					id={id}
					type="number"
					value={inputValue}
					min={min}
					step={step}
					onFocus={() => setEditing(true)}
					onChange={(event) => {
						setInputValue(event.target.value);
						const parsed = event.target.valueAsNumber;
						if (Number.isFinite(parsed)) onChange(parsed);
					}}
					onBlur={(event) => {
						setEditing(false);
						const parsed = event.target.valueAsNumber;
						if (Number.isFinite(parsed)) {
							onChange(parsed);
						} else {
							setInputValue(normalizedValue);
						}
					}}
				/>
				{unit && (
					<span className="shrink-0 text-sm text-muted-foreground">{unit}</span>
				)}
			</div>
			{description && (
				<p className="text-xs leading-relaxed text-muted-foreground">
					{description}
				</p>
			)}
		</div>
	);
}

export function SpeedField({
	label,
	value,
	onChange,
}: {
	label: string;
	value: number;
	onChange: (value: number) => void;
}) {
	const { t } = useLanguage();
	const unlimited = value < 0;
	const id = useId();
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<Label htmlFor={id}>{t(label)}</Label>
				<label className="flex items-center gap-2 text-xs text-muted-foreground">
					<input
						type="checkbox"
						checked={unlimited}
						onChange={(event) =>
							onChange(
								event.target.checked
									? -1
									: Math.max(0, value < 0 ? 10 * 1024 ** 2 : value),
							)
						}
						className="size-4 accent-primary"
					/>
					{t("Unlimited")}
				</label>
			</div>
			<div className="flex items-center gap-2">
				<Input
					id={id}
					type="number"
					min={0}
					step={1}
					disabled={unlimited}
					value={unlimited ? "" : value}
					placeholder={t("Unlimited")}
					onChange={(event) => onChange(Math.round(Number(event.target.value)))}
				/>
				<span className="shrink-0 text-sm text-muted-foreground">B/s</span>
			</div>
		</div>
	);
}

export function PasswordField({
	id,
	label = "Password",
	autoComplete = "current-password",
	value,
	onChange,
}: {
	id: string;
	label?: string;
	autoComplete?: string;
	value: string;
	onChange: (value: string) => void;
}) {
	const { t } = useLanguage();
	const [visible, setVisible] = useState(false);
	return (
		<div className="flex flex-col gap-2">
			<Label htmlFor={id}>{t(label)}</Label>
			<div className="relative">
				<Input
					id={id}
					type={visible ? "text" : "password"}
					value={value}
					autoComplete={autoComplete}
					onChange={(event) => onChange(event.target.value)}
					className="pr-10"
				/>
				<button
					type="button"
					className="absolute right-0 top-0 flex size-9 items-center justify-center text-muted-foreground hover:text-foreground"
					onClick={() => setVisible((current) => !current)}
					aria-label={visible ? t("Hide password") : t("Show password")}
					aria-pressed={visible}
				>
					{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
				</button>
			</div>
		</div>
	);
}

export function Chip({
	selected,
	onClick,
	disabled = false,
	draggable = false,
	onDragStart,
	onDragEnter,
	onDragOver,
	onDrop,
	onDragEnd,
	children,
}: {
	selected: boolean;
	onClick: () => void;
	disabled?: boolean;
	draggable?: boolean;
	onDragStart?: React.DragEventHandler<HTMLButtonElement>;
	onDragEnter?: React.DragEventHandler<HTMLButtonElement>;
	onDragOver?: React.DragEventHandler<HTMLButtonElement>;
	onDrop?: React.DragEventHandler<HTMLButtonElement>;
	onDragEnd?: React.DragEventHandler<HTMLButtonElement>;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			onClick={onClick}
			disabled={disabled}
			draggable={draggable}
			onDragStart={onDragStart}
			onDragEnter={onDragEnter}
			onDragOver={onDragOver}
			onDrop={onDrop}
			onDragEnd={onDragEnd}
			className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed ${
				draggable ? "cursor-pointer active:cursor-grabbing " : ""
			}${
				selected
					? "border-primary bg-primary text-primary-foreground"
					: "hover:bg-accent"
			}`}
		>
			{children}
		</button>
	);
}
