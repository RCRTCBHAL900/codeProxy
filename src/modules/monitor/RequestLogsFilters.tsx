import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { Filter, RotateCcw } from "lucide-react";
import { SearchableCheckboxMultiSelect } from "@/modules/ui/SearchableCheckboxMultiSelect";
import type { SearchableCheckboxMultiSelectOption } from "@/modules/ui/SearchableCheckboxMultiSelect";
import { cn } from "@/modules/ui/selectStyles";

type StatusFilterValue = "success" | "failed";

interface RequestLogStats {
  total: number;
  success_rate: number;
  total_tokens: number;
  total_cost: number;
}

interface RequestLogsFiltersProps {
  keyOptions: SearchableCheckboxMultiSelectOption[];
  modelOptions: SearchableCheckboxMultiSelectOption[];
  channelOptions: SearchableCheckboxMultiSelectOption[];
  statusOptions: SearchableCheckboxMultiSelectOption[];
  selectedApiKeys: string[];
  selectedModels: string[];
  selectedChannels: string[];
  selectedStatuses: StatusFilterValue[];
  onApiKeysChange: (value: string[]) => void;
  onModelsChange: (value: string[]) => void;
  onChannelsChange: (value: string[]) => void;
  onStatusesChange: (value: StatusFilterValue[]) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  stats: RequestLogStats;
  lastUpdatedText: string;
  loading: boolean;
}

export function RequestLogsFilters({
  keyOptions,
  modelOptions,
  channelOptions,
  statusOptions,
  selectedApiKeys,
  selectedModels,
  selectedChannels,
  selectedStatuses,
  onApiKeysChange,
  onModelsChange,
  onChannelsChange,
  onStatusesChange,
  onResetFilters,
  hasActiveFilters,
  stats,
  lastUpdatedText,
  loading,
}: RequestLogsFiltersProps) {
  const { t } = useTranslation();

  const statusChangeAdapter = useMemo(
    () => (value: string[]) => onStatusesChange(value as StatusFilterValue[]),
    [onStatusesChange],
  );

  return (
    <div className="border-t border-slate-100 px-5 py-3 dark:border-neutral-800/60">
      <div className="grid gap-2 min-[480px]:grid-cols-2 sm:flex sm:flex-wrap sm:items-center">
        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full min-[480px]:w-auto sm:w-[180px]">
            <SearchableCheckboxMultiSelect
              value={selectedApiKeys}
              onChange={onApiKeysChange}
              options={keyOptions}
              placeholder={t("request_logs.all_keys_placeholder")}
              searchPlaceholder={t("request_logs.search_keys")}
              selectFilteredLabel={t("request_logs.select_filtered")}
              deselectFilteredLabel={t("request_logs.deselect_filtered")}
              selectedCountLabel={(count: number) =>
                t("request_logs.selected_count", { count: String(count) })
              }
              noResultsLabel={t("request_logs.no_filter_results")}
              aria-label={t("request_logs.filter_key")}
              clearLabel={t("request_logs.clear_key_filter")}
              showClearButton
              size="sm"
            />
          </div>
          <div className="w-full min-[480px]:w-auto sm:w-[200px]">
            <SearchableCheckboxMultiSelect
              value={selectedModels}
              onChange={onModelsChange}
              options={modelOptions}
              placeholder={t("request_logs.all_models_placeholder")}
              searchPlaceholder={t("request_logs.search_models")}
              selectFilteredLabel={t("request_logs.select_filtered")}
              deselectFilteredLabel={t("request_logs.deselect_filtered")}
              selectedCountLabel={(count: number) =>
                t("request_logs.selected_count", { count: String(count) })
              }
              noResultsLabel={t("request_logs.no_filter_results")}
              aria-label={t("request_logs.filter_model")}
              clearLabel={t("request_logs.clear_model_filter")}
              showClearButton
              size="sm"
            />
          </div>
          <div className="w-full min-[480px]:w-auto sm:w-[180px]">
            <SearchableCheckboxMultiSelect
              value={selectedChannels}
              onChange={onChannelsChange}
              options={channelOptions}
              placeholder={t("request_logs.all_channels_placeholder")}
              searchPlaceholder={t("request_logs.search_channels")}
              selectFilteredLabel={t("request_logs.select_filtered")}
              deselectFilteredLabel={t("request_logs.deselect_filtered")}
              selectedCountLabel={(count: number) =>
                t("request_logs.selected_count", { count: String(count) })
              }
              noResultsLabel={t("request_logs.no_filter_results")}
              aria-label={t("request_logs.filter_channel")}
              clearLabel={t("request_logs.clear_channel_filter")}
              showClearButton
              size="sm"
            />
          </div>
          <div className="w-full min-[480px]:w-auto sm:w-[150px]">
            <SearchableCheckboxMultiSelect
              value={selectedStatuses}
              onChange={statusChangeAdapter}
              options={statusOptions}
              placeholder={t("request_logs.all_status")}
              searchPlaceholder=""
              selectFilteredLabel={t("request_logs.select_filtered")}
              deselectFilteredLabel={t("request_logs.deselect_filtered")}
              selectedCountLabel={(count: number) => `${count}`}
              noResultsLabel={t("request_logs.no_filter_results")}
              aria-label={t("request_logs.filter_status")}
              clearLabel={t("request_logs.clear_status_filter")}
              showClearButton
              size="sm"
            />
          </div>

          {/* Reset filters button */}
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onResetFilters}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium",
                "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
                "dark:text-white/50 dark:hover:text-white/80 dark:hover:bg-white/10",
                "transition-colors",
              )}
            >
              <RotateCcw size={12} aria-hidden="true" />
              {t("request_logs.reset_filters")}
            </button>
          ) : null}
        </div>

        {/* Stats summary */}
        <div className="col-span-2 min-[480px]:col-span-2 sm:col-span-1 sm:ml-auto">
          <div className="grid grid-cols-2 items-center gap-x-3 gap-y-1.5 text-xs text-slate-600 dark:text-white/55 sm:flex sm:items-center sm:gap-1.5">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <Filter size={12} aria-hidden="true" />
              {t("request_logs.records_count", {
                count: stats.total.toLocaleString(),
              } as Record<string, string>)}
            </span>

            <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap sm:justify-start">
              {t("common.success_rate")}
              <span className="font-mono tabular-nums">{stats.success_rate.toFixed(1)}%</span>
            </span>

            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              {t("request_logs.col_total_token")}
              <span className="font-mono tabular-nums">
                {stats.total_tokens.toLocaleString()}
              </span>
            </span>

            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              {t("request_logs.col_cost")}
              <span className="font-mono tabular-nums">${stats.total_cost.toFixed(4)}</span>
            </span>

            <span className="col-span-2 text-[11px] text-slate-400 dark:text-white/40 sm:col-span-1 sm:text-xs">
              {loading ? t("request_logs.refreshing") : lastUpdatedText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
