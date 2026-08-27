import { CreateProjectWizard } from '@/features/projects';

/** Two-step create-project wizard, centred in the viewport (short form on an
 *  otherwise empty screen). Offsets the ~57px top bar so it reads as centred. */
export default function NewProjectPage() {
  return (
    <div className="flex min-h-[calc(100dvh-57px)] flex-col items-center justify-center">
      <CreateProjectWizard />
    </div>
  );
}
