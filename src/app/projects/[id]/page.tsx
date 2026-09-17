import ProjectWorkspace from "./ProjectWorkspace";

export default function ProjectPage({ params }: { params: { id: string } }) {
  return <ProjectWorkspace projectId={params.id} />;
}
