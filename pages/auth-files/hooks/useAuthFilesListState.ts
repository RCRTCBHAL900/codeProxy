import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import type { AuthFileItem } from "@code-proxy/api-client";
import {
  AUTH_FILES_PAGE_SIZE,
  authFileMatchesStatusFilter,
  authFilesSortCollator,
  normalizeProviderKey,
  normalizeTagValue,
  readAuthFileCustomTags,
  resolveAuthFileStatusBuckets,
  resolveAuthFileSortKey,
  resolveFileType,
  type AuthFileStatusFilter,
} from "@code-proxy/domain";
import { isRuntimeOnlyAuthFile } from "@code-proxy/domain";

interface UseAuthFilesListStateOptions {
  files: AuthFileItem[];
  filter: string;
  tagFilter: string;
  statusFilter: AuthFileStatusFilter;
  search: string;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  selectedFileNames: string[];
  setSelectedFileNames: Dispatch<SetStateAction<string[]>>;
  serverPageInfo?: {
    total: number;
    page: number;
    totalPages: number;
    filterCounts: { total: number; counts: Record<string, number> };
    providerOptions: string[];
    selectableNames: string[];
    serverPaged: true;
  } | null;
}

export function useAuthFilesListState({
  files,
  filter,
  tagFilter,
  statusFilter,
  search,
  page,
  setPage,
  selectedFileNames,
  setSelectedFileNames,
  serverPageInfo,
}: UseAuthFilesListStateOptions) {
  const providerOptions = useMemo(() => {
    if (serverPageInfo?.serverPaged) {
      return serverPageInfo.providerOptions;
    }
    const set = new Set<string>();
    files.forEach((file) => set.add(resolveFileType(file)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [files, serverPageInfo]);

  const searchFilteredFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return files.filter((file) => {
      if (!q) return true;
      const name = String(file.name || "").toLowerCase();
      const provider = String(file.provider || "").toLowerCase();
      const type = String(file.type || "").toLowerCase();
      const customTags = readAuthFileCustomTags(file).join(" ").toLowerCase();
      return name.includes(q) || provider.includes(q) || type.includes(q) || customTags.includes(q);
    });
  }, [files, search]);

  const typeScopedFiles = useMemo(() => {
    const normalizedFilter = normalizeProviderKey(filter);
    return !normalizedFilter || normalizedFilter === "all"
      ? files
      : files.filter((file) => normalizeProviderKey(resolveFileType(file)) === normalizedFilter);
  }, [files, filter]);

  const filterCounts = useMemo(() => {
    if (serverPageInfo?.serverPaged) {
      return serverPageInfo.filterCounts;
    }
    const counts: Record<string, number> = {};
    files.forEach((file) => {
      const typeKey = normalizeProviderKey(resolveFileType(file));
      counts[typeKey] = (counts[typeKey] ?? 0) + 1;
    });
    return { total: files.length, counts };
  }, [files, serverPageInfo]);

  const customTagOptions = useMemo(() => {
    const set = new Set<string>();
    typeScopedFiles.forEach((file) => {
      readAuthFileCustomTags(file).forEach((tag) => {
        const normalized = normalizeTagValue(tag);
        if (normalized) set.add(normalized);
      });
    });
    return Array.from(set).sort((a, b) => authFilesSortCollator.compare(a, b));
  }, [typeScopedFiles]);

  const tagScopedFiles = useMemo(() => {
    const normalizedTagFilter = normalizeTagValue(tagFilter);
    return normalizedTagFilter
      ? typeScopedFiles.filter((file) => readAuthFileCustomTags(file).includes(normalizedTagFilter))
      : typeScopedFiles;
  }, [tagFilter, typeScopedFiles]);

  const statusFilterCounts = useMemo(() => {
    const counts: Partial<Record<AuthFileStatusFilter, number>> = {
      all: tagScopedFiles.length,
    };
    tagScopedFiles.forEach((file) => {
      resolveAuthFileStatusBuckets(file).forEach((bucket) => {
        counts[bucket] = (counts[bucket] ?? 0) + 1;
      });
    });
    return counts;
  }, [tagScopedFiles]);

  const filteredFiles = useMemo(() => {
    if (serverPageInfo?.serverPaged) {
      return files
        .filter((file) => authFileMatchesStatusFilter(file, statusFilter))
        .sort((a, b) =>
          authFilesSortCollator.compare(resolveAuthFileSortKey(a), resolveAuthFileSortKey(b)),
        );
    }
    const statusScoped = tagScopedFiles.filter((file) =>
      authFileMatchesStatusFilter(file, statusFilter),
    );
    const searchFilteredNames = new Set(searchFilteredFiles.map((file) => file.name));
    return statusScoped
      .filter((file) => searchFilteredNames.has(file.name))
      .sort((a, b) =>
        authFilesSortCollator.compare(resolveAuthFileSortKey(a), resolveAuthFileSortKey(b)),
      );
  }, [files, searchFilteredFiles, serverPageInfo, statusFilter, tagScopedFiles]);

  const totalPages = serverPageInfo?.serverPaged
    ? Math.max(1, serverPageInfo.totalPages)
    : Math.max(1, Math.ceil(filteredFiles.length / AUTH_FILES_PAGE_SIZE));
  const safePage = serverPageInfo?.serverPaged
    ? Math.min(totalPages, Math.max(1, serverPageInfo.page))
    : Math.min(totalPages, Math.max(1, page));

  const pageItems = useMemo(() => {
    if (serverPageInfo?.serverPaged) {
      return filteredFiles;
    }
    const start = (safePage - 1) * AUTH_FILES_PAGE_SIZE;
    return filteredFiles.slice(start, start + AUTH_FILES_PAGE_SIZE);
  }, [filteredFiles, safePage, serverPageInfo]);

  const selectableFilteredFiles = useMemo(
    () =>
      serverPageInfo?.serverPaged
        ? []
        : filteredFiles.filter((file) => !isRuntimeOnlyAuthFile(file)),
    [filteredFiles, serverPageInfo],
  );
  const selectablePageFiles = useMemo(
    () => pageItems.filter((file) => !isRuntimeOnlyAuthFile(file)),
    [pageItems],
  );
  const selectableFilteredNameSet = useMemo(
    () =>
      new Set(
        serverPageInfo?.serverPaged
          ? serverPageInfo.selectableNames
          : selectableFilteredFiles.map((file) => file.name),
      ),
    [selectableFilteredFiles, serverPageInfo],
  );
  const selectablePageNames = useMemo(
    () => selectablePageFiles.map((file) => file.name),
    [selectablePageFiles],
  );
  const selectedFileNameSet = useMemo(() => new Set(selectedFileNames), [selectedFileNames]);
  const selectedCount = selectedFileNames.length;

  const allPageSelected =
    selectablePageNames.length > 0 &&
    selectablePageNames.every((name) => selectedFileNameSet.has(name));
  const somePageSelected =
    !allPageSelected && selectablePageNames.some((name) => selectedFileNameSet.has(name));
  const allFilteredSelected =
    selectableFilteredNameSet.size > 0 &&
    Array.from(selectableFilteredNameSet).every((name) => selectedFileNameSet.has(name));

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [page, safePage, setPage]);

  useEffect(() => {
    setSelectedFileNames((prev) => prev.filter((name) => selectableFilteredNameSet.has(name)));
  }, [selectableFilteredNameSet, setSelectedFileNames]);

  const toggleFileSelection = useCallback(
    (name: string, checked: boolean) => {
      setSelectedFileNames((prev) => {
        const next = new Set(prev);
        if (checked) next.add(name);
        else next.delete(name);
        return Array.from(next);
      });
    },
    [setSelectedFileNames],
  );

  const selectCurrentPage = useCallback(
    (checked: boolean) => {
      setSelectedFileNames((prev) => {
        const next = new Set(prev);
        selectablePageNames.forEach((name) => {
          if (checked) next.add(name);
          else next.delete(name);
        });
        return Array.from(next);
      });
    },
    [selectablePageNames, setSelectedFileNames],
  );

  const selectFilteredFiles = useCallback(
    (checked: boolean) => {
      setSelectedFileNames((prev) => {
        const next = new Set(prev);
        selectableFilteredNameSet.forEach((name) => {
          if (checked) next.add(name);
          else next.delete(name);
        });
        return Array.from(next);
      });
    },
    [selectableFilteredNameSet, setSelectedFileNames],
  );

  return {
    providerOptions,
    filterCounts,
    customTagOptions,
    statusFilterCounts,
    filteredFiles,
    totalPages,
    safePage,
    pageItems,
    selectableFilteredFiles,
    selectablePageNames,
    selectedFileNameSet,
    selectedCount,
    allPageSelected,
    somePageSelected,
    allFilteredSelected,
    toggleFileSelection,
    selectCurrentPage,
    selectFilteredFiles,
  };
}
