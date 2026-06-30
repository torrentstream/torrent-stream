import { getConfiguration } from "@/app/actions";
import { ConfigForm } from "@/components/config-form";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
	const snapshot = await getConfiguration();
	return <ConfigForm initialSnapshot={snapshot} />;
}
