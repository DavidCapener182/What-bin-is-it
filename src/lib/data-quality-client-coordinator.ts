type DataQualityClientStorage = {
  getItem: (key: string) => Promise<string | null | undefined>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

type DataQualityClientIdCoordinatorOptions = {
  storage: DataQualityClientStorage;
  storageKey: string;
  createId: () => string;
  isValid: (value: string) => boolean;
};

export function createDataQualityClientIdCoordinator({
  storage,
  storageKey,
  createId,
  isValid,
}: DataQualityClientIdCoordinatorOptions) {
  let clientIdPromise: Promise<string> | undefined;
  let operationTail: Promise<void> = Promise.resolve();

  function serialise<T>(operation: () => Promise<T>) {
    const result = operationTail.then(operation, operation);
    operationTail = result.then(() => undefined, () => undefined);
    return result;
  }

  return {
    get() {
      clientIdPromise ??= serialise(async () => {
        const stored = await storage.getItem(storageKey);
        if (stored && isValid(stored)) return stored;
        const clientId = createId();
        await storage.setItem(storageKey, clientId);
        return clientId;
      });
      return clientIdPromise;
    },
    erase() {
      clientIdPromise = undefined;
      return serialise(() => storage.removeItem(storageKey));
    },
  };
}
