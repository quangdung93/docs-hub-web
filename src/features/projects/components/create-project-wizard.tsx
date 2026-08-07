'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check, ImagePlus, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { type MessageKey, useI18n } from '@/core/i18n';
import { UploadPanel } from '@/features/documents';
import { Button, Card, CardBody, Field, Input, Stepper, Textarea } from '@/shared/ui';
import { ScreenHeader } from '@/shared/components';

import { useCreateProject } from '../hooks/use-projects';
import { projectRoutes } from '../routes';
import { type CreateProjectInput, CreateProjectInputSchema } from '../schemas/project.schema';

/**
 * Two-step create flow. Step 1 creates the project (so step 2 has a real id to
 * upload into — the mockup's "skip" path leaves an empty but valid project).
 * Validation comes from the shared Zod schema; the component never re-implements
 * a rule.
 */
export function CreateProjectWizard() {
  const { t } = useI18n();
  const router = useRouter();
  const createProject = useCreateProject();
  // The project is created at the end of step 1 so step 2 has a real id to upload
  // into. `step` is tracked separately from `createdProjectId` so going back does
  // not orphan the already-created project.
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(CreateProjectInputSchema),
    mode: 'onTouched',
    defaultValues: { name: '', description: '' },
  });

  const onSubmitStep1 = handleSubmit((values) => {
    // Already created (the user stepped back and forward again) — don't create a
    // second project, just advance.
    if (createdProjectId) {
      setStep(2);
      return;
    }
    createProject.mutate(values, {
      onSuccess: (project) => {
        setCreatedProjectId(project.id);
        setStep(2);
      },
    });
  });

  const finish = () => router.push(projectRoutes.chat(createdProjectId ?? ''));

  return (
    <>
      <Card className="mx-auto max-w-2xl">
        <ScreenHeader title={t('createProject.title')} backHref={projectRoutes.list} />

        <div className="px-6 pt-5">
          <Stepper steps={[t('createProject.step1'), t('createProject.step2')]} current={step} />
        </div>

        {step === 1 ? (
          <form onSubmit={onSubmitStep1} noValidate>
            <CardBody>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <label className="group border-input bg-surface-muted/60 hover:border-brand/60 hover:bg-brand-subtle/40 grid size-24 shrink-0 cursor-pointer place-items-center rounded-xl border-2 border-dashed text-center transition">
                  <div>
                    <ImagePlus
                      className="text-muted-foreground group-hover:text-brand mx-auto size-5"
                      aria-hidden
                    />
                    <p className="text-muted-foreground mt-1 px-1 text-[11px] leading-tight">
                      {t('createProject.imageLabel')}
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-label={t('createProject.imageLabel')}
                  />
                </label>

                <div className="w-full flex-1 space-y-4">
                  <Field
                    label={t('createProject.name')}
                    htmlFor="project-name"
                    error={errors.name && t(errors.name.message as MessageKey)}
                  >
                    <Input
                      id="project-name"
                      placeholder={t('createProject.namePlaceholder')}
                      aria-invalid={!!errors.name}
                      {...register('name')}
                    />
                  </Field>

                  <Field label={t('createProject.description')} htmlFor="project-description">
                    <Textarea
                      id="project-description"
                      rows={2}
                      placeholder={t('createProject.descriptionPlaceholder')}
                      {...register('description')}
                    />
                  </Field>
                </div>
              </div>

              <div className="border-border mt-6 flex items-center justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(projectRoutes.list)}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={createProject.isPending}>
                  {createProject.isPending ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : null}
                  {t('common.continue')}
                  <ArrowRight aria-hidden />
                </Button>
              </div>
            </CardBody>
          </form>
        ) : (
          <CardBody>
            <UploadPanel projectId={createdProjectId!} layout="stacked" />

            <p className="text-muted-foreground mt-3 text-center text-xs">
              {t('createProject.skipHint')}
            </p>

            <div className="border-border mt-6 flex items-center justify-between border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft aria-hidden />
                {t('common.back')}
              </Button>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={finish}>
                  {t('common.skip')}
                </Button>
                <Button type="button" onClick={finish}>
                  {t('common.finish')}
                  <Check aria-hidden />
                </Button>
              </div>
            </div>
          </CardBody>
        )}
      </Card>

      <p className="text-muted-foreground mt-3 text-center text-xs">
        {t('createProject.footnote')}
      </p>
    </>
  );
}
