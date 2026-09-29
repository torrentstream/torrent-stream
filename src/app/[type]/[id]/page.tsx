import { notFound } from "next/navigation";
import { TitleView } from "@/components/catalog/title-view";

export default async function TitlePage({
	params,
}: {
	params: Promise<{ type: string; id: string }>;
}) {
	const { type, id } = await params;
	if ((type !== "movie" && type !== "tv") || !/^[1-9]\d*$/.test(id)) notFound();
	return <TitleView key={`${type}-${id}`} type={type} id={id} />;
}
