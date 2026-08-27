import { ProjectGrid } from '@/features/projects';
import { Card } from '@/shared/ui';

/** Project picker — the landing screen after sign-in. */
export default function ProjectsPage() {
  return (
    <Card>
      <div className="flex min-h-[600px]">
        <ProjectGrid />
      </div>
    </Card>
  );
}
