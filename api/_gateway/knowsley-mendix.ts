type MendixAttribute = {
  hash?: string;
  readonly?: boolean;
  value: unknown;
};

type MendixObject = {
  attributes: Record<string, MendixAttribute>;
  guid: string;
  hash: string;
  objectType: string;
};

type MendixResponse = {
  changes?: Record<string, Record<string, MendixAttribute>>;
  csrftoken?: string;
  objects?: MendixObject[];
};

const baseUrl = 'https://knowsleytransaction.mendixcloud.com';
const addressSearchOperation = 'jjzer6smPUaBpVLzU7R0Tg';
const addressSelectionOperation = 'cl7H5Z5PXk6wTiewsx2JHQ';

function requestToken(sequence: number) {
  return `${Date.now()}-${sequence}`;
}

function cookieValues(headers: Headers) {
  const extendedHeaders = headers as Headers & { getSetCookie?: () => string[] };
  const values = extendedHeaders.getSetCookie?.();
  if (values?.length) return values;
  const combined = headers.get('set-cookie');
  return combined ? combined.split(/,\s*(?=__Host-)/) : [];
}

function createCookieHeader(headers: Headers) {
  const pairs = cookieValues(headers).map((value) => value.split(';', 1)[0]);
  const hostXasId = pairs.find((value) => value.startsWith('__Host-XASID='));
  const xasId = hostXasId?.slice('__Host-XASID='.length);
  if (!pairs.some((value) => value.startsWith('__Host-XASSESSIONID=')) || !xasId) {
    throw new Error('Knowsley did not create a collection lookup session.');
  }
  return [
    ...pairs,
    `xasid=${xasId}`,
    '__Host-DeviceType=Desktop',
    '__Host-Profile=Responsive',
    '__Host-SessionTimeZoneOffset=-60',
  ].join('; ');
}

function findObject(response: MendixResponse, objectType: string) {
  const object = response.objects?.find((candidate) => candidate.objectType === objectType);
  if (!object) throw new Error(`Knowsley did not return ${objectType}.`);
  return object;
}

function attributeValue(
  changes: Record<string, Record<string, MendixAttribute>> | undefined,
  guid: string,
  attribute: string,
) {
  return changes?.[guid]?.[attribute]?.value;
}

export type KnowsleyMendixDates = {
  NextBlue?: unknown;
  NextFood?: unknown;
  NextGrey?: unknown;
  NextMaroon?: unknown;
};

export async function fetchKnowsleyMendixDates(
  postcode: string,
  uprn: string,
): Promise<KnowsleyMendixDates> {
  let sequence = 0;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const initial = await fetch(
      `${baseUrl}/link/youarebeingredirected?target=bincollectioninformation`,
      { redirect: 'manual', signal: controller.signal },
    );
    if (initial.status !== 303) {
      throw new Error(`Knowsley collection lookup returned ${initial.status}.`);
    }
    const cookie = createCookieHeader(initial.headers);

    async function xas(body: object, csrf?: string): Promise<MendixResponse> {
      const response = await fetch(`${baseUrl}/xas/`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          cookie,
          referer: `${baseUrl}/index.html`,
          'x-mx-reqtoken': requestToken(sequence++),
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`Knowsley collection lookup returned ${response.status}.`);
      }
      return response.json() as Promise<MendixResponse>;
    }

    const session = await xas({
      action: 'get_session_data',
      params: {
        hybrid: false,
        offline: false,
        referrer: null,
        profile: '',
        timezoneoffset: -60,
        timezoneId: 'Europe/London',
        preferredLanguages: ['en-GB', 'en-US', 'en'],
        version: 2,
      },
      profiledata: { [requestToken(sequence++)]: 1 },
    });
    if (!session.csrftoken) throw new Error('Knowsley did not return a collection lookup token.');

    const redirectObject = findObject(
      session,
      'Service_YouAreBeingRedirected.YouAreBeingRedirected_Redirect',
    );
    const opened = await xas({
      action: 'executeaction',
      params: {
        actionname: 'Service_YouAreBeingRedirected.SUB_YouAreBeingRedirected',
        applyto: 'selection',
        guids: [redirectObject.guid],
      },
      changes: {},
      objects: [redirectObject],
      context: [],
      profiledata: { [requestToken(sequence++)]: 1 },
    }, session.csrftoken);

    const enquiryObject = findObject(opened, 'OnlineServices.OS_vmBinCollectionEnquiry');
    const enquiryChanges = opened.changes?.[enquiryObject.guid] ?? {};
    const searched = await xas({
      action: 'runtimeOperation',
      operationId: addressSearchOperation,
      params: { OS_MissedBinEnquiry: { guid: enquiryObject.guid } },
      validationGuids: [enquiryObject.guid],
      changes: {
        [enquiryObject.guid]: {
          ...enquiryChanges,
          EnquiryPostcodeOrStreetName: { value: postcode },
        },
      },
      objects: [enquiryObject],
      profiledata: { [requestToken(sequence++)]: 1 },
    }, session.csrftoken);

    const selectedGuid = Object.entries(searched.changes ?? {}).find(([, changes]) => (
      changes.UPRN?.value === uprn
    ))?.[0];
    const selectedAddress = searched.objects?.find((object) => object.guid === selectedGuid);
    if (!selectedGuid || !selectedAddress) {
      throw new Error('The selected property was not returned by Knowsley for this postcode.');
    }

    const selected = await xas({
      action: 'runtimeOperation',
      operationId: addressSelectionOperation,
      params: { Generic_Address: { guid: selectedAddress.guid } },
      validationGuids: [enquiryObject.guid],
      changes: {
        [enquiryObject.guid]: {
          ...enquiryChanges,
          EnquiryPostcodeOrStreetName: { value: postcode },
          ...(searched.changes?.[enquiryObject.guid] ?? {}),
        },
        [selectedAddress.guid]: searched.changes?.[selectedAddress.guid] ?? {},
      },
      objects: [enquiryObject, selectedAddress],
      profiledata: { [requestToken(sequence++)]: 1 },
    }, session.csrftoken);

    const returnedUprn = attributeValue(selected.changes, enquiryObject.guid, 'UPRN');
    const addressSelected = attributeValue(selected.changes, enquiryObject.guid, 'AddressSelected');
    if (returnedUprn !== uprn || addressSelected !== true) {
      throw new Error('Knowsley returned collection dates for a different property.');
    }

    return {
      NextMaroon: selected.changes?.[enquiryObject.guid]?.NextMaroon,
      NextGrey: selected.changes?.[enquiryObject.guid]?.NextGrey,
      NextBlue: selected.changes?.[enquiryObject.guid]?.NextBlue,
      NextFood: selected.changes?.[enquiryObject.guid]?.NextFood,
    };
  } finally {
    clearTimeout(timeout);
  }
}
