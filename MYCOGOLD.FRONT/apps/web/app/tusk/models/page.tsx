import { PageShell } from "../../../components/ui/page-shell";
import { ModelRegistryList } from "../../../components/tusk/model-registry-list";
export default function TuskModelsPage() { return <PageShell title="Model registry" description="Versioned models require evaluation and approval before activation."><ModelRegistryList /></PageShell>; }
