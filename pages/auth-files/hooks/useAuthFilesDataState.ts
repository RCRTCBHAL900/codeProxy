import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { authFilesApi, usageApi } from "@code-proxy/api-client";
import type { EntityStatsScope } from "@code-proxy/api-client/endpoints/usage";
import type { AuthFileItem, AuthFilesResponse, EntityStatsResponse } from "@code-proxy/api-client";
import { useToast } from "@code-proxy/ui";
import {
  AUTH_FILES_PAGE_SIZE,
  buildAuthFileSourceCandidates,
  buildUsageIndex,
  normalizeAuthIndexValue,
  readAuthFilesDataCache,
  sanitizeAuthFilesForCache,
  writeAuthFilesDataCache,
} from "@code-proxy/domain";
import { normalizeUsageSourceId } from "@code-proxy/domain";

const mergeTargetUsageData = (
  previous: EntityStatsResponse | null,
  next: EntityStatsResponse,
  targetFiles: AuthFileItem[],
): EntityStatsResponse => {
  const targetAuthIndices = new Set(
    targetFiles
      .map((file) => normalizeAuthIndexValue(file.auth_index ?? file.authIndex))
      .filter(Boolean) as string[],
  );
  const targetSources = new Set(targetFiles.flatMap((file) => buildAuthFileSourceCandidates(file)));

  const isTargetAuthIndex = (value: unknown) => {
    const normalized = normalizeAuthIndexValue(value);
    return Boolean(normalized && targetAuthIndices.has(normalized));
  };
  const isTargetSource = (value: unknown) => {
    const normalized = normalizeUsageSourceId(value, (v) => v);
    return Boolean(normalized && targetSources.has(normalized));
  };
  const previousAuthIndex = Array.isArray(previous?.auth_index) ? previous.auth_index : [];
  const previousSource = Array.isArray(previous?.source) ? previous.source : [];
  const nextAuthIndex = Array.isArray(next.auth_index) ? next.auth_index : [];
  const nextSource = Array.isArray(next.source) ? next.source : [];

  return {
    auth_index: [
      ...previousAuthIndex.filter((point) => !isTargetAuthIndex(point.entity_name)),
      ...nextAuthIndex.filter((point) => isTargetAuthIndex(point.entity_name)),
    ],
    source: [
      ...previousSource.filter((point) => !isTargetSource(point.entity_name)),
      ...nextSource.filter((point) => isTargetSource(point.entity_name)),
    ],
  };
};

const buildEntityStatsScopeForFiles = (targetFiles: AuthFileItem[]): EntityStatsScope => {
  const authIndexes = Array.from(
    new Set(
      targetFiles
        .map((file) => normalizeAuthIndexValue(file.auth_index ?? file.authIndex))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const sources = Array.from(
    new Set(targetFiles.flatMap((file) => buildAuthFileSourceCandidates(file))),
  );
  return { authIndexes, sources };
};

interface UseAuthFilesDataStateOptions {
  filter: string;
  search: string;
  page: number;
}

interface AuthFilesServerPageInfo {
  total: number;
  page: number;
  totalPages: number;
  filterCounts: { total: number; counts: Record<string, number> };
  providerOptions: string[];
  selectableNames: string[];
  serverPaged: true;
}

const hasServerPagingMetadata = (response: AuthFilesResponse | null | undefined) =>
  Boolean(
    response &&
      (typeof response.page === "number" ||
        typeof response.total_pages === "number" ||
        response.filter_counts ||
        response.provider_options ||
        response.selectable_names),
  );

const normalizeServerPageInfo = (
  response: AuthFilesResponse | null | undefined,
  files: AuthFileItem[],
) : AuthFilesServerPageInfo | null => {
  if (!hasServerPagingMetadata(response)) {
    return null;
  }
  const total = Math.max(0, Number(response?.total ?? files.length) || 0);
  const totalPages = Math.max(
    1,
    Number(response?.total_pages ?? Math.ceil(total / AUTH_FILES_PAGE_SIZE)) || 1,
  );
  const page = Math.min(totalPages, Math.max(1, Number(response?.page ?? 1) || 1));
  return {
    total,
    page,
    totalPages,
    filterCounts:
      response?.filter_counts && typeof response.filter_counts === "object"
        ? response.filter_counts
        : { total, counts: {} },
    providerOptions: Array.isArray(response?.provider_options) ? response.provider_options : [],
    selectableNames: Array.isArray(response?.selectable_names) ? response.selectable_names : [],
    serverPaged: true,
  };
};

export function useAuthFilesDataState({ filter, search, page }: UseAuthFilesDataStateOptions) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const initialDataCache = useMemo(() => readAuthFilesDataCache(), []);

  const [files, setFiles] = useState<AuthFileItem[]>(() => initialDataCache?.files ?? []);
  const [loading, setLoading] = useState(() => !((initialDataCache?.files?.length ?? 0) > 0));
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageData, setUsageData] = useState<EntityStatsResponse | null>(
    () => initialDataCache?.usageData ?? null,
  );
  const [serverPageInfo, setServerPageInfo] = useState<AuthFilesServerPageInfo | null>(null);

  const filesRef = useRef<AuthFileItem[]>(files);
  const usageDataRef = useRef<EntityStatsResponse | null>(usageData);
  const { index: usageIndex } = useMemo(() => buildUsageIndex(usageData), [usageData]);

  const loadAll = useCallback(async (): Promise<AuthFileItem[]> => {
    const hasExisting = filesRef.current.length > 0;
    if (hasExisting) setRefreshingAll(true);
    else setLoading(true);
    if (!hasExisting) setUsageLoading(true);
    try {
      const filesRes = await authFilesApi.list({
        provider: filter,
        search,
        page,
        limit: AUTH_FILES_PAGE_SIZE,
        include_counts: 1,
        include_names: 1,
      });
      const list = Array.isArray(filesRes?.files) ? filesRes.files : [];
      filesRef.current = list;
      setFiles(list);
      setServerPageInfo(normalizeServerPageInfo(filesRes, list));

      const scope = buildEntityStatsScopeForFiles(list);
      const hasUsageScope =
        (scope.authIndexes?.length ?? 0) > 0 || (scope.sources?.length ?? 0) > 0;
      const usageRes = hasUsageScope
        ? await usageApi.getEntityStats(30, "all", scope).catch(() => null)
        : ({ source: [], auth_index: [] } satisfies EntityStatsResponse);

      setUsageData((prev) => usageRes ?? prev);
      return list;
    } catch (err: unknown) {
      notify({
        type: "error",
        message: err instanceof Error ? err.message : t("auth_files.load_failed"),
      });
      return filesRef.current;
    } finally {
      if (hasExisting) setRefreshingAll(false);
      else setLoading(false);
      if (!hasExisting) setUsageLoading(false);
    }
  }, [filter, notify, page, search, t]);

  const refreshFilesForItems = useCallback(
    async (_targetFiles: AuthFileItem[]): Promise<AuthFileItem[]> => {
      return loadAll();
    },
    [loadAll],
  );

  const refreshUsageDataForFiles = useCallback(
    async (targetFiles: AuthFileItem[]): Promise<EntityStatsResponse | null> => {
      if (targetFiles.length === 0) return usageDataRef.current;

      try {
        const nextUsageData = await usageApi.getEntityStats(
          30,
          "all",
          buildEntityStatsScopeForFiles(targetFiles),
        );
        const mergedUsageData = mergeTargetUsageData(
          usageDataRef.current,
          nextUsageData,
          targetFiles,
        );
        usageDataRef.current = mergedUsageData;
        setUsageData(mergedUsageData);
        return mergedUsageData;
      } catch {
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    usageDataRef.current = usageData;
  }, [usageData]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const timer = window.setTimeout(() => {
      writeAuthFilesDataCache({
        savedAtMs: Date.now(),
        files: sanitizeAuthFilesForCache(files),
        usageData,
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [files, usageData]);

  useEffect(() => {
    return () => {
      writeAuthFilesDataCache({
        savedAtMs: Date.now(),
        files: sanitizeAuthFilesForCache(filesRef.current),
        usageData: usageDataRef.current,
      });
    };
  }, []);

  return {
    files,
    setFiles,
    loading,
    refreshingAll,
    usageLoading,
    usageData,
    usageIndex,
    serverPageInfo,
    loadAll,
    refreshFilesForItems,
    refreshUsageDataForFiles,
  };
}
