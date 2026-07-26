"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// api/_gateway/entry.ts
var entry_exports = {};
__export(entry_exports, {
  config: () => config,
  default: () => handler
});
module.exports = __toCommonJS(entry_exports);

// api/_gateway/knowsley-mendix.ts
var baseUrl = "https://knowsleytransaction.mendixcloud.com";
var addressSearchOperation = "jjzer6smPUaBpVLzU7R0Tg";
var addressSelectionOperation = "cl7H5Z5PXk6wTiewsx2JHQ";
function requestToken(sequence) {
  return `${Date.now()}-${sequence}`;
}
function cookieValues(headers2) {
  const extendedHeaders = headers2;
  const values = extendedHeaders.getSetCookie?.();
  if (values?.length) return values;
  const combined = headers2.get("set-cookie");
  return combined ? combined.split(/,\s*(?=__Host-)/) : [];
}
function createCookieHeader(headers2) {
  const pairs = cookieValues(headers2).map((value) => value.split(";", 1)[0]);
  const hostXasId = pairs.find((value) => value.startsWith("__Host-XASID="));
  const xasId = hostXasId?.slice("__Host-XASID=".length);
  if (!pairs.some((value) => value.startsWith("__Host-XASSESSIONID=")) || !xasId) {
    throw new Error("Knowsley did not create a collection lookup session.");
  }
  return [
    ...pairs,
    `xasid=${xasId}`,
    "__Host-DeviceType=Desktop",
    "__Host-Profile=Responsive",
    "__Host-SessionTimeZoneOffset=-60"
  ].join("; ");
}
function findObject(response, objectType) {
  const object = response.objects?.find((candidate) => candidate.objectType === objectType);
  if (!object) throw new Error(`Knowsley did not return ${objectType}.`);
  return object;
}
function attributeValue(changes, guid, attribute) {
  return changes?.[guid]?.[attribute]?.value;
}
async function fetchKnowsleyMendixDates(postcode, uprn) {
  let sequence = 0;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25e3);
  try {
    const initial = await fetch(
      `${baseUrl}/link/youarebeingredirected?target=bincollectioninformation`,
      { redirect: "manual", signal: controller.signal }
    );
    if (initial.status !== 303) {
      throw new Error(`Knowsley collection lookup returned ${initial.status}.`);
    }
    const cookie = createCookieHeader(initial.headers);
    async function xas(body, csrf) {
      const response = await fetch(`${baseUrl}/xas/`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          cookie,
          referer: `${baseUrl}/index.html`,
          "x-mx-reqtoken": requestToken(sequence++),
          ...csrf ? { "x-csrf-token": csrf } : {}
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error(`Knowsley collection lookup returned ${response.status}.`);
      }
      return response.json();
    }
    const session = await xas({
      action: "get_session_data",
      params: {
        hybrid: false,
        offline: false,
        referrer: null,
        profile: "",
        timezoneoffset: -60,
        timezoneId: "Europe/London",
        preferredLanguages: ["en-GB", "en-US", "en"],
        version: 2
      },
      profiledata: { [requestToken(sequence++)]: 1 }
    });
    if (!session.csrftoken) throw new Error("Knowsley did not return a collection lookup token.");
    const redirectObject = findObject(
      session,
      "Service_YouAreBeingRedirected.YouAreBeingRedirected_Redirect"
    );
    const opened = await xas({
      action: "executeaction",
      params: {
        actionname: "Service_YouAreBeingRedirected.SUB_YouAreBeingRedirected",
        applyto: "selection",
        guids: [redirectObject.guid]
      },
      changes: {},
      objects: [redirectObject],
      context: [],
      profiledata: { [requestToken(sequence++)]: 1 }
    }, session.csrftoken);
    const enquiryObject = findObject(opened, "OnlineServices.OS_vmBinCollectionEnquiry");
    const enquiryChanges = opened.changes?.[enquiryObject.guid] ?? {};
    const searched = await xas({
      action: "runtimeOperation",
      operationId: addressSearchOperation,
      params: { OS_MissedBinEnquiry: { guid: enquiryObject.guid } },
      validationGuids: [enquiryObject.guid],
      changes: {
        [enquiryObject.guid]: {
          ...enquiryChanges,
          EnquiryPostcodeOrStreetName: { value: postcode }
        }
      },
      objects: [enquiryObject],
      profiledata: { [requestToken(sequence++)]: 1 }
    }, session.csrftoken);
    const selectedGuid = Object.entries(searched.changes ?? {}).find(([, changes]) => changes.UPRN?.value === uprn)?.[0];
    const selectedAddress = searched.objects?.find((object) => object.guid === selectedGuid);
    if (!selectedGuid || !selectedAddress) {
      throw new Error("The selected property was not returned by Knowsley for this postcode.");
    }
    const selected = await xas({
      action: "runtimeOperation",
      operationId: addressSelectionOperation,
      params: { Generic_Address: { guid: selectedAddress.guid } },
      validationGuids: [enquiryObject.guid],
      changes: {
        [enquiryObject.guid]: {
          ...enquiryChanges,
          EnquiryPostcodeOrStreetName: { value: postcode },
          ...searched.changes?.[enquiryObject.guid] ?? {}
        },
        [selectedAddress.guid]: searched.changes?.[selectedAddress.guid] ?? {}
      },
      objects: [enquiryObject, selectedAddress],
      profiledata: { [requestToken(sequence++)]: 1 }
    }, session.csrftoken);
    const returnedUprn = attributeValue(selected.changes, enquiryObject.guid, "UPRN");
    const addressSelected = attributeValue(selected.changes, enquiryObject.guid, "AddressSelected");
    if (returnedUprn !== uprn || addressSelected !== true) {
      throw new Error("Knowsley returned collection dates for a different property.");
    }
    return {
      NextMaroon: selected.changes?.[enquiryObject.guid]?.NextMaroon,
      NextGrey: selected.changes?.[enquiryObject.guid]?.NextGrey,
      NextBlue: selected.changes?.[enquiryObject.guid]?.NextBlue,
      NextFood: selected.changes?.[enquiryObject.guid]?.NextFood
    };
  } finally {
    clearTimeout(timeout);
  }
}

// api/_gateway/nationwide-bin-source.ts
function normalisePostcode(value) {
  const compact = value.trim().toUpperCase().replace(/\s+/g, "");
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
}
function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}
function safeHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 500) return void 0;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : void 0;
  } catch {
    return void 0;
  }
}
function providerIdForLadCode(value) {
  return `lad-${value.toLowerCase()}`;
}
function stripPostcode(display, postcode) {
  const trimmed = display.trim();
  return trimmed.toUpperCase().endsWith(postcode) ? trimmed.slice(0, -postcode.length).replace(/,\s*$/, "").trim() : trimmed;
}
function parseNationwideAddresses(value, requestedPostcode, expectedProviderId) {
  if (!value || typeof value !== "object") {
    throw new Error("The nationwide address source returned an invalid response.");
  }
  const payload = value;
  const postcode = normalisePostcode(requestedPostcode);
  if (normalisePostcode(typeof payload.postcode === "string" ? payload.postcode : "") !== postcode || !payload.council || typeof payload.council.ladCode !== "string" || typeof payload.council.name !== "string" || typeof payload.council.slug !== "string" || !/^[a-z0-9-]{1,100}$/.test(payload.council.slug)) {
    throw new Error("The nationwide address source returned an invalid response.");
  }
  const providerId = providerIdForLadCode(payload.council.ladCode);
  if (providerId !== expectedProviderId.toLowerCase()) {
    throw new Error("The postcode source returned a different council than expected.");
  }
  if (payload.council.supported === false) {
    throw new Error(`${payload.council.name} does not expose a public live collection lookup.`);
  }
  if (!Array.isArray(payload.addresses)) {
    throw new Error("The nationwide address source returned an invalid response.");
  }
  const seen = /* @__PURE__ */ new Set();
  const addresses = payload.addresses.reduce((result, address) => {
    if (!address || typeof address.uprn !== "string" && typeof address.uprn !== "number" || typeof address.display !== "string" || typeof address.postcode !== "string") return result;
    const id = String(address.uprn).trim();
    const addressPostcode = normalisePostcode(address.postcode);
    const line1 = stripPostcode(address.display, addressPostcode);
    if (!/^\d{1,20}$/.test(id) || seen.has(id) || addressPostcode !== postcode || !line1 || line1.length > 240) return result;
    seen.add(id);
    result.push({ id, line1, postcode: addressPostcode });
    return result;
  }, []);
  return {
    councilName: payload.council.name.trim().slice(0, 160),
    councilSlug: payload.council.slug,
    providerId,
    officialUrl: safeHttpsUrl(payload.council.officialUrl),
    addresses
  };
}
function classifyWasteType(value) {
  const normalised = value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (/\b(food|caddy|kitchen)\b/.test(normalised)) return "food";
  if (/\b(garden waste|green waste|compost|organic waste)\b/.test(normalised)) return "garden";
  if (/\b(recycl\w*|paper|cardboard|card|glass|plastic|carton|metal|cans?)\b/.test(normalised)) return "recycling";
  if (/\b(general|residual|refuse|rubbish|landfill|non recyclable|domestic waste)\b/.test(normalised)) return "general";
  return "other";
}
function parseNationwideCollections(value) {
  if (!value || typeof value !== "object") return [];
  const collections = value.collections;
  if (!Array.isArray(collections)) return [];
  const seen = /* @__PURE__ */ new Set();
  return collections.reduce((result, collection) => {
    if (!collection || !isIsoDate(collection.date)) return result;
    const rawType = typeof collection.type === "string" ? collection.type.trim() : "";
    const rawLabel = typeof collection.label === "string" ? collection.label.trim() : "";
    const label = (rawLabel || rawType).slice(0, 80);
    if (!label) return result;
    const key = `${collection.date}|${label.toLowerCase()}`;
    if (seen.has(key)) return result;
    seen.add(key);
    const colour = typeof collection.colour === "string" && /^#[0-9a-f]{6}$/i.test(collection.colour) ? collection.colour.toUpperCase() : void 0;
    result.push({
      date: collection.date,
      wasteType: classifyWasteType(`${rawType} ${rawLabel}`),
      label,
      ...colour ? { colour } : {}
    });
    return result;
  }, []);
}
async function fetchJson(url, timeoutMs = 2e4) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "What Bin Is It Tonight?/1.0"
      }
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = void 0;
    }
    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
}
async function fetchNationwideAddressLookup(postcode, expectedProviderId) {
  const canonicalPostcode = normalisePostcode(postcode);
  const { response, payload } = await fetchJson(
    `https://binday.org.uk/api/addresses?postcode=${encodeURIComponent(canonicalPostcode)}`
  );
  if (!response.ok) {
    throw new Error("The nationwide exact-address lookup is temporarily unavailable.");
  }
  return parseNationwideAddresses(payload, canonicalPostcode, expectedProviderId);
}
function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
async function fetchNationwideCollections(postcode, addressId, expectedProviderId) {
  if (!addressId || !/^\d{1,20}$/.test(addressId)) {
    throw new Error("Choose your exact property before checking its collection dates.");
  }
  const lookup = await fetchNationwideAddressLookup(postcode, expectedProviderId);
  const address = lookup.addresses.find((candidate) => candidate.id === addressId);
  if (!address) {
    throw new Error("The selected property was not returned for this postcode.");
  }
  const url = new URL("https://binday.org.uk/api/collections");
  url.searchParams.set("postcode", address.postcode);
  url.searchParams.set("uprn", address.id);
  url.searchParams.set("address", `${address.line1} ${address.postcode}`);
  url.searchParams.set("council", lookup.councilSlug);
  let payload;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await fetchJson(url.toString());
    payload = result.payload;
    if (result.response.status === 202) {
      if (attempt === 7) throw new Error("The council lookup is still processing. Please try again shortly.");
      await wait(1500);
      continue;
    }
    if (!result.response.ok) {
      const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error.slice(0, 180) : "The nationwide collection lookup is temporarily unavailable.";
      throw new Error(message);
    }
    break;
  }
  const typedPayload = payload;
  if (typedPayload?.estimated === true) {
    throw new Error("This source returned only estimated dates, so the app did not save them.");
  }
  const collections = parseNationwideCollections(payload);
  if (!collections.length) throw new Error("No dated collections were returned for this property.");
  return {
    councilName: lookup.councilName,
    providerId: lookup.providerId,
    verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
    notice: `Live ${lookup.councilName} collection data via the Bin Day nationwide council lookup.`,
    collections
  };
}

// api/_gateway/adapter-registry.ts
function normalisePostcode2(value) {
  const compact = value.trim().toUpperCase().replace(/\s+/g, "");
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
}
function unwrapJson(value) {
  let current = value;
  for (let attempt = 0; attempt < 2 && typeof current === "string"; attempt += 1) {
    try {
      current = JSON.parse(current);
    } catch {
      return void 0;
    }
  }
  return current;
}
function parseCouncilDate(value) {
  if (value && typeof value === "object" && "value" in value) {
    return parseCouncilDate(value.value);
  }
  if (typeof value !== "string") return void 0;
  const match = value.trim().match(/^(?:[A-Za-z]+\s+)?(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return void 0;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return void 0;
  return `${yearText}-${monthText.padStart(2, "0")}-${dayText.padStart(2, "0")}`;
}
function parseKnowsleyAddresses(value) {
  const payload = unwrapJson(value);
  if (!Array.isArray(payload)) return [];
  const seenIds = /* @__PURE__ */ new Set();
  const seenAddresses = /* @__PURE__ */ new Set();
  return payload.reduce((addresses, item) => {
    if (!item || typeof item !== "object") return addresses;
    const candidate = item;
    if (typeof candidate.FullAddress !== "string" || typeof candidate.Postcode !== "string" || typeof candidate.UPRN !== "string" && typeof candidate.UPRN !== "number") return addresses;
    const id = String(candidate.UPRN).trim();
    const postcode = normalisePostcode2(candidate.Postcode);
    if (!/^\d{1,20}$/.test(id) || seenIds.has(id)) return addresses;
    const fullAddress = candidate.FullAddress.trim();
    const line1 = fullAddress.toUpperCase().endsWith(postcode) ? fullAddress.slice(0, -postcode.length).replace(/,\s*$/, "").trim() : fullAddress;
    if (!line1) return addresses;
    const displayKey = `${line1.toUpperCase()}|${postcode}`;
    if (seenAddresses.has(displayKey)) return addresses;
    seenIds.add(id);
    seenAddresses.add(displayKey);
    addresses.push({ id, line1, postcode });
    return addresses;
  }, []);
}
function parseKnowsleyCollections(value) {
  const payload = unwrapJson(value);
  const first = Array.isArray(payload) ? payload[0] : payload;
  if (!first || typeof first !== "object") return [];
  const record = first;
  const fields = [
    { value: record.NextMaroon ?? record.Nextmaroon, wasteType: "general" },
    { value: record.NextGrey ?? record.Nextgrey, wasteType: "recycling" },
    { value: record.NextBlue ?? record.Nextblue, wasteType: "garden" },
    { value: record.NextFood, wasteType: "food" }
  ];
  return fields.flatMap(({ value: dateValue, wasteType }) => {
    const date = parseCouncilDate(dateValue);
    return date ? [{ date, wasteType }] : [];
  });
}
async function fetchWithTimeout(url, timeoutMs = 2e4) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json, text/javascript, */*; q=0.01",
        "user-agent": "What Bin Is It Tonight?/1.0"
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}
var knowsleyAdapter = {
  id: "lad-e08000011",
  async getAddresses(postcode) {
    const search = `${normalisePostcode2(postcode).split(" ").join("*")}*`;
    const response = await fetchWithTimeout(
      `https://address.knowsley.gov.uk/api/addressSearchstatutory?addresssearch=${encodeURIComponent(search)}`
    );
    if (!response.ok) throw new Error(`Knowsley address search returned ${response.status}.`);
    const addresses = parseKnowsleyAddresses(await response.text());
    return addresses.filter((address) => address.postcode === normalisePostcode2(postcode));
  },
  async getCollections(input) {
    if (!input.addressId || !/^\d{1,20}$/.test(input.addressId)) {
      throw new Error("An exact Knowsley property must be selected before checking collection dates.");
    }
    const dates = await fetchKnowsleyMendixDates(
      normalisePostcode2(input.postcode),
      input.addressId
    );
    const collections = parseKnowsleyCollections(dates);
    if (!collections.length) throw new Error("Knowsley returned no dated collections for this property.");
    return {
      councilName: "Knowsley",
      providerId: "lad-e08000011",
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      notice: "Live collection dates from Knowsley Council.",
      collections
    };
  }
};
var adapters = {
  [knowsleyAdapter.id]: knowsleyAdapter
};
function getAdapter(providerId) {
  const directAdapter = adapters[providerId];
  if (directAdapter) return directAdapter;
  if (!/^lad-[ensw]\d{8}$/.test(providerId)) return void 0;
  return {
    id: providerId,
    async getAddresses(postcode) {
      return (await fetchNationwideAddressLookup(postcode, providerId)).addresses;
    },
    async getCollections(input) {
      return fetchNationwideCollections(input.postcode, input.addressId, providerId);
    }
  };
}

// src/lib/recycling-materials.ts
var materialLabels = {
  aluminium: "Aluminium",
  batteries: "Batteries",
  beverage_cartons: "Drink cartons",
  books: "Books",
  cans: "Cans",
  cardboard: "Cardboard",
  clothes: "Clothes",
  cooking_oil: "Cooking oil",
  electrical_items: "Electrical items",
  engine_oil: "Engine oil",
  fluorescent_tubes: "Fluorescent tubes",
  foil: "Foil",
  food: "Food waste",
  fridges: "Fridges",
  garden_waste: "Garden waste",
  glass: "Glass",
  glass_bottles: "Glass bottles",
  green_waste: "Green waste",
  magazines: "Magazines",
  metal: "Metal",
  newspapers: "Newspapers",
  paper: "Paper",
  paper_packaging: "Paper packaging",
  plastic: "Plastic",
  plastic_bottles: "Plastic bottles",
  plastic_packaging: "Plastic packaging",
  scrap_metal: "Scrap metal",
  shoes: "Shoes",
  small_appliances: "Small appliances",
  textiles: "Textiles",
  waste: "Household waste",
  wood: "Wood"
};
function parseRecyclingMaterials(tags) {
  return Object.entries(materialLabels).filter(([key]) => tags[`recycling:${key}`]?.toLowerCase() === "yes").map(([, label]) => label);
}

// api/_gateway/openstreetmap-services.ts
function validCoordinate(value, min, max) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}
function parseOpenStreetMapServices(payload) {
  if (!payload || typeof payload !== "object") return [];
  const elements = payload.elements;
  if (!Array.isArray(elements)) return [];
  return elements.reduce((services, element) => {
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    if (typeof element.id !== "string" && typeof element.id !== "number" || !validCoordinate(latitude, -90, 90) || !validCoordinate(longitude, -180, 180)) return services;
    const tags = element.tags ?? {};
    const isCentre = tags.amenity === "waste_transfer_station" || /centre|center|household waste|tip/i.test(`${tags.name ?? ""} ${tags.recycling_type ?? ""}`);
    services.push({
      id: `osm-${element.id}`,
      name: tags.name || (isCentre ? "Household waste site" : "Recycling point"),
      type: isCentre ? "recycling-centre" : "recycling-point",
      address: [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"]].filter(Boolean).join(" ") || void 0,
      latitude,
      longitude,
      source: "openstreetmap",
      website: tags.website,
      materials: parseRecyclingMaterials(tags)
    });
    return services;
  }, []);
}
async function fetchWithTimeout2(url, init, timeoutMs = 25e3) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "What Bin Is It Tonight?/1.0",
        ...init?.headers
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}
async function fetchOpenStreetMapServices(postcode) {
  const postcodeResponse = await fetchWithTimeout2(
    `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`,
    void 0,
    15e3
  );
  if (!postcodeResponse.ok) throw new Error(`Postcode location lookup returned ${postcodeResponse.status}.`);
  const postcodePayload = await postcodeResponse.json();
  const latitude = postcodePayload.result?.latitude;
  const longitude = postcodePayload.result?.longitude;
  if (!validCoordinate(latitude, -90, 90) || !validCoordinate(longitude, -180, 180)) {
    throw new Error("The postcode source did not return usable coordinates.");
  }
  const query = `[out:json][timeout:20];(nwr["amenity"="recycling"](around:9000,${latitude},${longitude});nwr["amenity"="waste_transfer_station"](around:9000,${latitude},${longitude}););out center 20;`;
  const response = await fetchWithTimeout2("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: `data=${encodeURIComponent(query)}`
  });
  if (!response.ok) throw new Error(`OpenStreetMap service search returned ${response.status}.`);
  return parseOpenStreetMapServices(await response.json());
}

// api/_gateway/index.ts
var wasteTypes = /* @__PURE__ */ new Set(["general", "recycling", "garden", "food", "other"]);
var serviceTypes = /* @__PURE__ */ new Set(["recycling-centre", "recycling-point", "reuse", "collection"]);
var headers = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "x-content-type-options": "nosniff",
  "cache-control": "no-store"
};
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}
function publicError(error, fallback) {
  return error instanceof Error && error.message.length > 0 ? error.message.slice(0, 180) : fallback;
}
function isPostcode(value) {
  if (typeof value !== "string") return false;
  const postcode = normalisePostcode3(value);
  return /^(GIR 0AA|(?:(?:[A-PR-UWYZ]\d[\dA-HJKSTUW]?|[A-PR-UWYZ][A-HK-Y]\d[\dABEHMNPRVWXY]?) \d[ABD-HJLNP-UW-Z]{2}))$/i.test(postcode);
}
function normalisePostcode3(value) {
  const compact = value.trim().toUpperCase().replace(/\s+/g, "");
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
}
function validCoordinate2(value, min, max) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}
function validCollectionResult(value) {
  if (!value || typeof value !== "object") return false;
  const result = value;
  return typeof result.councilName === "string" && typeof result.providerId === "string" && typeof result.verifiedAt === "string" && !Number.isNaN(Date.parse(result.verifiedAt)) && Array.isArray(result.collections) && result.collections.every((collection) => {
    if (!collection || typeof collection !== "object") return false;
    const item = collection;
    const details = collection;
    return typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && wasteTypes.has(item.wasteType) && (details.label === void 0 || typeof details.label === "string" && details.label.length > 0 && details.label.length <= 80) && (details.colour === void 0 || typeof details.colour === "string" && /^#[0-9A-F]{6}$/.test(details.colour));
  });
}
function validAddressResult(value) {
  return Array.isArray(value) && value.every((address) => {
    if (!address || typeof address !== "object") return false;
    const item = address;
    return typeof item.id === "string" && /^\d{1,20}$/.test(item.id) && typeof item.line1 === "string" && item.line1.length > 0 && item.line1.length <= 240 && isPostcode(item.postcode);
  });
}
function validServiceResult(value) {
  return Array.isArray(value) && value.every((service) => {
    if (!service || typeof service !== "object") return false;
    const item = service;
    return typeof item.id === "string" && typeof item.name === "string" && serviceTypes.has(item.type) && validCoordinate2(item.latitude, -90, 90) && validCoordinate2(item.longitude, -180, 180) && (item.source === "council" || item.source === "openstreetmap") && (item.materials === void 0 || Array.isArray(item.materials) && item.materials.length <= 40 && item.materials.every((material) => typeof material === "string" && material.length > 0 && material.length <= 80));
  });
}
var index_default = {
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/^\/api(?=\/)/, "");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method === "GET" && pathname === "/health") return json({ ok: true, service: "what-bin-is-it-tonight-council-gateway" });
    if (request.method === "GET" && pathname === "/v1/addresses") {
      const postcode = url.searchParams.get("postcode");
      const providerId = url.searchParams.get("providerId");
      if (!isPostcode(postcode)) return json({ error: "A complete UK postcode is required." }, 400);
      if (!providerId || !/^[a-z0-9-]+$/.test(providerId)) return json({ error: "Unknown council provider." }, 400);
      const adapter2 = getAdapter(providerId);
      if (!adapter2?.getAddresses) return json({ error: "This council does not have a live address search connected yet." }, 404);
      try {
        const addresses = await adapter2.getAddresses(normalisePostcode3(postcode));
        if (!validAddressResult(addresses)) return json({ error: "The council address source returned an invalid response." }, 502);
        return json({ addresses });
      } catch (error) {
        console.error("Council address provider failed", providerId, error);
        return json({ error: publicError(error, "The council address search is temporarily unavailable.") }, 502);
      }
    }
    if (request.method === "GET" && pathname === "/v1/services") {
      const postcode = url.searchParams.get("postcode");
      const providerId = url.searchParams.get("providerId");
      if (!isPostcode(postcode)) return json({ error: "A complete UK postcode is required." }, 400);
      if (!providerId || !/^[a-z0-9-]+$/.test(providerId)) return json({ error: "Unknown council provider." }, 400);
      const adapter2 = getAdapter(providerId);
      try {
        const services = adapter2?.getServices ? (await adapter2.getServices({ postcode: normalisePostcode3(postcode) })).map((service) => ({ ...service, source: "council" })) : await fetchOpenStreetMapServices(normalisePostcode3(postcode));
        if (!validServiceResult(services)) return json({ error: "The council service source returned an invalid response." }, 502);
        return json({ services });
      } catch (error) {
        console.error("Council service provider failed", providerId, error);
        return json({ error: publicError(error, "The local service search is temporarily unavailable.") }, 502);
      }
    }
    if (request.method !== "POST" || pathname !== "/v1/collections") return json({ error: "Not found" }, 404);
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Expected a JSON body." }, 400);
    }
    if (!isPostcode(body.postcode)) return json({ error: "A complete UK postcode is required." }, 400);
    if (typeof body.providerId !== "string" || !/^[a-z0-9-]+$/.test(body.providerId)) return json({ error: "Unknown council provider." }, 400);
    const adapter = getAdapter(body.providerId);
    if (!adapter) return json({ error: "This council provider has not been connected yet." }, 404);
    try {
      const result = await adapter.getCollections({ postcode: normalisePostcode3(body.postcode), addressId: typeof body.addressId === "string" ? body.addressId : void 0 });
      if (!validCollectionResult(result) || result.providerId !== adapter.id) {
        return json({ error: "The council source returned an invalid response." }, 502);
      }
      return json(result);
    } catch (error) {
      console.error("Council provider failed", body.providerId, error);
      return json({ error: publicError(error, "The council source is temporarily unavailable.") }, 502);
    }
  }
};

// api/_gateway/entry.ts
var config = { runtime: "nodejs" };
function requestHeaders(values) {
  const headers2 = new Headers();
  for (const [name, value] of Object.entries(values)) {
    if (Array.isArray(value)) headers2.set(name, value.join(", "));
    else if (value !== void 0) headers2.set(name, value);
  }
  return headers2;
}
function requestBody(method, body) {
  if (method === "GET" || method === "HEAD" || body === void 0) return void 0;
  return typeof body === "string" ? body : JSON.stringify(body);
}
async function handler(request, response) {
  const method = request.method?.toUpperCase() ?? "GET";
  const url = new URL(request.url ?? "/", "https://what-bin-is-it-tonight.local");
  const result = await index_default.fetch(new Request(url, {
    body: requestBody(method, request.body),
    headers: requestHeaders(request.headers),
    method
  }));
  response.statusCode = result.status;
  result.headers.forEach((value, name) => response.setHeader(name, value));
  response.end(await result.text());
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  config
});
