import { useStorageStatus } from "../StoragePersistence";
import { texts } from "../texts";

export function SettingsPage() {
  const storage = useStorageStatus();

  return (
    <>
      <h1>{texts.settings.title}</h1>
      <section className="card" aria-labelledby="settings-storage">
        <h2 id="settings-storage">{texts.settings.storageHeading}</h2>
        <p data-testid="storage-status" data-status={storage}>
          {texts.settings.storage[storage]}
        </p>
      </section>
    </>
  );
}
