export type OperationalQueueSearchParams = {
  direction?: string | string[];
  filter?: string | string[];
  page?: string | string[];
  perPage?: string | string[];
  q?: string | string[];
  sort?: string | string[];
  status?: string | string[];
};

export type OperationalQueueSortValue = string | number | boolean | Date | null | undefined;

export type OperationalQueueRequest = {
  direction: "asc" | "desc";
  filter: string;
  offset: number;
  page: number;
  pageSize: number;
  query: string;
  sort: string;
  status: string;
};

export type OperationalQueueServerPage<T> = {
  items: T[];
  request: OperationalQueueRequest;
  total: number;
  unfilteredTotal: number;
};

export type OperationalQueueState<T> = {
  direction: "asc" | "desc";
  filter: string;
  items: T[];
  page: number;
  pageCount: number;
  pageSize: number;
  query: string;
  sort: string;
  status: string;
  total: number;
  unfilteredTotal: number;
};

type OperationalQueueConfig<T> = {
  defaultDirection?: "asc" | "desc";
  defaultPageSize?: number;
  defaultSort?: string;
  filterValues?: readonly string[];
  getFilter?: (item: T) => string | undefined;
  getSearchText: (item: T) => string;
  getStatus?: (item: T) => string | undefined;
  pageSizes?: readonly number[];
  sorts?: Record<string, (item: T) => OperationalQueueSortValue>;
  statusValues?: readonly string[];
};

export type OperationalQueueRequestConfig = Pick<OperationalQueueConfig<never>,
  "defaultDirection" | "defaultPageSize" | "defaultSort" | "filterValues" | "pageSizes" | "statusValues"
> & { sortValues?: readonly string[] };

const defaultPageSizes = [10, 25, 50] as const;

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function bounded(value: string, maximum: number) {
  return value.trim().slice(0, maximum);
}

export function operationalQueueRequest(
  searchParams: OperationalQueueSearchParams,
  config: OperationalQueueRequestConfig = {},
): OperationalQueueRequest {
  const query = bounded(first(searchParams.q), 120);
  const statusCandidate = bounded(first(searchParams.status), 64);
  const filterCandidate = bounded(first(searchParams.filter), 64);
  const status = config.statusValues?.includes(statusCandidate) ? statusCandidate : "";
  const filter = config.filterValues?.includes(filterCandidate) ? filterCandidate : "";
  const pageSizes = config.pageSizes?.length ? config.pageSizes : defaultPageSizes;
  const requestedPageSize = Number.parseInt(first(searchParams.perPage), 10);
  const defaultPageSize = config.defaultPageSize && pageSizes.includes(config.defaultPageSize)
    ? config.defaultPageSize
    : pageSizes[0];
  const pageSize = pageSizes.includes(requestedPageSize) ? requestedPageSize : defaultPageSize;
  const sortCandidate = bounded(first(searchParams.sort), 64);
  const sort = sortCandidate && config.sortValues?.includes(sortCandidate)
    ? sortCandidate
    : config.defaultSort && config.sortValues?.includes(config.defaultSort)
      ? config.defaultSort
      : "";
  const directionValue = first(searchParams.direction);
  const direction = directionValue === "asc" || directionValue === "desc"
    ? directionValue
    : config.defaultDirection ?? "asc";
  const requestedPage = Number.parseInt(first(searchParams.page), 10);
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), 100_000) : 1;
  return { direction, filter, offset: (page - 1) * pageSize, page, pageSize, query, sort, status };
}

export function clampOperationalQueueRequest(request: OperationalQueueRequest, total: number) {
  const pageCount = Math.max(1, Math.ceil(total / request.pageSize));
  const page = Math.min(request.page, pageCount);
  return { ...request, offset: (page - 1) * request.pageSize, page };
}

export function operationalQueueStateFromServerPage<T>(page: OperationalQueueServerPage<T>): OperationalQueueState<T> {
  const pageCount = Math.max(1, Math.ceil(page.total / page.request.pageSize));
  return {
    direction: page.request.direction,
    filter: page.request.filter,
    items: page.items,
    page: page.request.page,
    pageCount,
    pageSize: page.request.pageSize,
    query: page.request.query,
    sort: page.request.sort,
    status: page.request.status,
    total: page.total,
    unfilteredTotal: page.unfilteredTotal,
  };
}

function compare(left: OperationalQueueSortValue, right: OperationalQueueSortValue) {
  const normalisedLeft = left instanceof Date ? left.getTime() : left;
  const normalisedRight = right instanceof Date ? right.getTime() : right;
  if (normalisedLeft === normalisedRight) return 0;
  if (normalisedLeft === null || normalisedLeft === undefined) return 1;
  if (normalisedRight === null || normalisedRight === undefined) return -1;
  if (typeof normalisedLeft === "number" && typeof normalisedRight === "number") {
    return normalisedLeft - normalisedRight;
  }
  return String(normalisedLeft).localeCompare(String(normalisedRight), "en-GB", {
    numeric: true,
    sensitivity: "base",
  });
}

export function operationalQueueState<T>(
  input: readonly T[],
  searchParams: OperationalQueueSearchParams,
  config: OperationalQueueConfig<T>,
): OperationalQueueState<T> {
  const request = operationalQueueRequest(searchParams, {
    defaultDirection: config.defaultDirection,
    defaultPageSize: config.defaultPageSize,
    defaultSort: config.defaultSort,
    filterValues: config.filterValues,
    pageSizes: config.pageSizes,
    sortValues: Object.keys(config.sorts ?? {}),
    statusValues: config.statusValues,
  });
  const queryNeedle = request.query.toLocaleLowerCase("en-GB");

  const filtered = input.filter((item) => (
    (!queryNeedle || config.getSearchText(item).toLocaleLowerCase("en-GB").includes(queryNeedle))
    && (!request.status || config.getStatus?.(item) === request.status)
    && (!request.filter || config.getFilter?.(item) === request.filter)
  ));

  if (request.sort && config.sorts?.[request.sort]) {
    const accessor = config.sorts[request.sort];
    filtered.sort((left, right) => compare(accessor(left), accessor(right)) * (request.direction === "desc" ? -1 : 1));
  }

  const clampedRequest = clampOperationalQueueRequest(request, filtered.length);
  const pageCount = Math.max(1, Math.ceil(filtered.length / clampedRequest.pageSize));

  return {
    direction: clampedRequest.direction,
    filter: clampedRequest.filter,
    items: filtered.slice(clampedRequest.offset, clampedRequest.offset + clampedRequest.pageSize),
    page: clampedRequest.page,
    pageCount,
    pageSize: clampedRequest.pageSize,
    query: clampedRequest.query,
    sort: clampedRequest.sort,
    status: clampedRequest.status,
    total: filtered.length,
    unfilteredTotal: input.length,
  };
}

export function operationalQueueHref<T>(
  pathname: string,
  state: OperationalQueueState<T>,
  updates: Partial<Pick<OperationalQueueState<T>, "direction" | "filter" | "page" | "pageSize" | "query" | "sort" | "status">> = {},
  fixedParams: Record<string, string> = {},
) {
  const next = { ...state, ...updates };
  const params = new URLSearchParams();
  Object.entries(fixedParams).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  if (next.query) params.set("q", next.query);
  if (next.status) params.set("status", next.status);
  if (next.filter) params.set("filter", next.filter);
  if (next.sort) params.set("sort", next.sort);
  if (next.sort && next.direction === "desc") params.set("direction", "desc");
  if (next.pageSize !== defaultPageSizes[0]) params.set("perPage", String(next.pageSize));
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function operationalQueueSavedQuery<T>(state: OperationalQueueState<T>, fixedParams: Record<string, string> = {}) {
  const href = operationalQueueHref("", state, { page: 1 }, fixedParams);
  return href.startsWith("?") ? href.slice(1) : "";
}
