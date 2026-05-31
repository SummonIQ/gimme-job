import { AppearanceSettingsForm } from '@/components/user/application-appearance-settings';

export default function Settings() {
  return (
    <>
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Appearance Settings</h2>
      </div>

      <div className="flex flex-col gap-4">
        <AppearanceSettingsForm />
      </div>
    </>
  );
}
