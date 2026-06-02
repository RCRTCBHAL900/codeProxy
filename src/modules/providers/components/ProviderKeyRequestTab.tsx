import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { TextInput } from "@/modules/ui/Input";
import { Select } from "@/modules/ui/Select";
import { ToggleSwitch } from "@/modules/ui/ToggleSwitch";
import type { ProxyPoolEntry } from "@/lib/http/apis/proxies";
import { providersApi } from "@/lib/http/apis";
import type { OpenCodeGoUsageItem } from "@/lib/http/types";
import { Button } from "@/modules/ui/Button";
import { ProxyPoolSelect } from "@/modules/proxies/ProxyPoolSelect";
import { KeyValueInputList } from "@/modules/providers/KeyValueInputList";
import type { ProviderKeyDraft } from "@/modules/providers/providers-helpers";

const SectionCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div
    className={[
      "rounded-xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60",
      className,
    ]
      .filter(Boolean)
      .join(" ")}
  >
    {children}
  </div>
);

const OPENCODE_GO_MODELS_URL = "https://opencode.ai/zen/go/v1/models";
const OPENCODE_GO_CHAT_URL = "https://opencode.ai/zen/go/v1/chat/completions";
const OPENCODE_GO_MESSAGES_URL = "https://opencode.ai/zen/go/v1/messages";

interface ProviderKeyRequestTabProps {
  keyDraft: ProviderKeyDraft;
  setKeyDraft: Dispatch<SetStateAction<ProviderKeyDraft>>;
  editKeyType: string;
  proxyPoolEntries: ProxyPoolEntry[];
  isOpenCodeGo: boolean;
  openCodeVisionFallbackOptions: { value: string; label: string }[];
  openCodeModelsLoading: boolean;
}

export function ProviderKeyRequestTab({
  keyDraft,
  setKeyDraft,
  editKeyType,
  proxyPoolEntries,
  isOpenCodeGo,
  openCodeVisionFallbackOptions,
  openCodeModelsLoading,
}: ProviderKeyRequestTabProps) {
  const { t } = useTranslation();
  const isBedrock = editKeyType === "bedrock";
  const [openCodeUsage, setOpenCodeUsage] = useState<OpenCodeGoUsageItem[] | null>(null);
  const [openCodeUsageLoading, setOpenCodeUsageLoading] = useState(false);
  const [openCodeUsageError, setOpenCodeUsageError] = useState<string | null>(null);

  const openCodeUsageByType = useMemo(() => {
    const map = new Map<string, OpenCodeGoUsageItem>();
    for (const item of openCodeUsage ?? []) {
      map.set(item.type.toLowerCase(), item);
    }
    return map;
  }, [openCodeUsage]);

  const queryOpenCodeUsage = async () => {
    if (!isOpenCodeGo) return;
    setOpenCodeUsageLoading(true);
    setOpenCodeUsageError(null);
    try {
      const result = await providersApi.queryOpenCodeGoUsage({
        "workspace-id": keyDraft.workspaceId.trim(),
        "auth-cookie": keyDraft.authCookie.trim(),
        "proxy-id": keyDraft.proxyId.trim(),
        "proxy-url": keyDraft.proxyUrl.trim(),
        name: keyDraft.name.trim(),
        "api-key": keyDraft.apiKey.trim(),
      });
      setOpenCodeUsage(result.usage);
    } catch (err: unknown) {
      setOpenCodeUsage(null);
      setOpenCodeUsageError(
        err instanceof Error ? err.message : t("providers.opencode_go_usage_query_failed"),
      );
    } finally {
      setOpenCodeUsageLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {isOpenCodeGo ? (
        <SectionCard className="bg-slate-50/80 dark:bg-neutral-900/50">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {t("providers.opencode_go_fixed_endpoint_title")}
          </p>
          <div className="mt-3 grid gap-2 text-xs text-slate-600 dark:text-white/65">
            <p className="break-all font-mono">{OPENCODE_GO_CHAT_URL}</p>
            <p className="break-all font-mono">{OPENCODE_GO_MESSAGES_URL}</p>
            <p className="break-all font-mono">{OPENCODE_GO_MODELS_URL}</p>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-white/55">
            {t("providers.opencode_go_fixed_endpoint_hint")}
          </p>
        </SectionCard>
      ) : null}

      {isOpenCodeGo ? (
        <SectionCard>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {t("providers.opencode_go_usage_title")}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-white/55">
                {t("providers.opencode_go_usage_hint")}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => void queryOpenCodeUsage()}
              disabled={
                openCodeUsageLoading || !keyDraft.workspaceId.trim() || !keyDraft.authCookie.trim()
              }
            >
              <RefreshCw size={14} className={openCodeUsageLoading ? "animate-spin" : ""} />
              {openCodeUsageLoading
                ? t("providers.opencode_go_usage_querying")
                : t("providers.opencode_go_usage_query")}
            </Button>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-white/75">
                {t("providers.opencode_go_workspace_id")}
              </p>
              <TextInput
                value={keyDraft.workspaceId}
                onChange={(e) => {
                  const val = e.currentTarget.value;
                  setKeyDraft((prev) => ({ ...prev, workspaceId: val }));
                }}
                placeholder="wrk_..."
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-white/75">
                {t("providers.opencode_go_auth_cookie")}
              </p>
              <TextInput
                type="password"
                value={keyDraft.authCookie}
                onChange={(e) => {
                  const val = e.currentTarget.value;
                  setKeyDraft((prev) => ({ ...prev, authCookie: val }));
                }}
                placeholder={t("providers.opencode_go_auth_cookie_placeholder")}
              />
            </div>
          </div>

          {openCodeUsageError ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
              {openCodeUsageError}
            </p>
          ) : null}

          {openCodeUsage ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {(["rolling", "weekly", "monthly"] as const).map((type) => {
                const item = openCodeUsageByType.get(type);
                const value = item?.percentage ?? 0;
                return (
                  <div
                    key={type}
                    className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-neutral-800 dark:bg-neutral-900/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800 dark:text-white/85">
                        {t(`providers.opencode_go_usage_${type}`)}
                      </span>
                      <span className="text-xs font-semibold text-slate-600 dark:text-white/65">
                        {value}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-neutral-800">
                      <div
                        className="h-full rounded-full bg-sky-500"
                        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-white/55">
                      {item
                        ? t("providers.opencode_go_usage_resets_in", {
                            time: item.resets_in,
                          })
                        : t("providers.opencode_go_usage_no_data")}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      {isOpenCodeGo ? (
        <SectionCard>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {t("providers.opencode_go_vision_fallback_title")}
          </p>
          <div className="mt-3">
            <Select
              value={keyDraft.visionFallbackModel}
              onChange={(value) =>
                setKeyDraft((prev) => ({ ...prev, visionFallbackModel: value }))
              }
              options={openCodeVisionFallbackOptions}
              aria-label={t("providers.opencode_go_vision_fallback_title")}
              disabled={openCodeModelsLoading || openCodeVisionFallbackOptions.length <= 1}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-white/55">
            {t("providers.opencode_go_vision_fallback_hint")}
          </p>
        </SectionCard>
      ) : null}

      {isBedrock ? (
        <SectionCard>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {t("providers.bedrock_region")}
          </p>
          <div className="mt-2">
            <TextInput
              value={keyDraft.region}
              onChange={(e) => {
                const val = e.currentTarget.value;
                setKeyDraft((prev) => ({ ...prev, region: val }));
              }}
              placeholder="us-east-1"
            />
          </div>
          <div className="mt-3">
            <ToggleSwitch
              label={t("providers.bedrock_force_global")}
              description={t("providers.bedrock_force_global_hint")}
              checked={keyDraft.forceGlobal}
              onCheckedChange={(checked: boolean) =>
                setKeyDraft((prev) => ({ ...prev, forceGlobal: checked }))
              }
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-white/55">
            {t("providers.bedrock_region_hint")}
          </p>
        </SectionCard>
      ) : null}

      <SectionCard>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {t("providers.connection_proxy_label")}
        </p>
        <div className="mt-3 grid gap-3">
          {isOpenCodeGo ? null : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-white/75">
                {t("providers.base_url")}
              </p>
              <TextInput
                value={keyDraft.baseUrl}
                onChange={(e) => {
                  const val = e.currentTarget.value;
                  setKeyDraft((prev) => ({ ...prev, baseUrl: val }));
                }}
                placeholder={
                  editKeyType === "claude"
                    ? t("providers.claude_base_url_placeholder")
                    : t("providers.base_url_placeholder")
                }
              />
            </div>
          )}
          <div className="space-y-2">
            <ProxyPoolSelect
              value={keyDraft.proxyId}
              entries={proxyPoolEntries}
              onChange={(value) => setKeyDraft((prev) => ({ ...prev, proxyId: value }))}
              label={t("providers.proxy_pool_label")}
              hint={t("providers.proxy_pool_hint")}
              ariaLabel={t("providers.proxy_pool_label")}
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700 dark:text-white/75">
              {t("providers.proxy_url")}
            </p>
            <TextInput
              value={keyDraft.proxyUrl}
              onChange={(e) => {
                const val = e.currentTarget.value;
                setKeyDraft((prev) => ({ ...prev, proxyUrl: val }));
              }}
              placeholder={t("providers.proxy_url_placeholder")}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-white/55">
          {isOpenCodeGo
            ? t("providers.opencode_go_connection_hint")
            : t("providers.connection_proxy_hint")}
        </p>
      </SectionCard>

      <SectionCard>
        <KeyValueInputList
          title={t("providers.headers_optional")}
          entries={keyDraft.headersEntries}
          onChange={(next) => setKeyDraft((prev) => ({ ...prev, headersEntries: next }))}
          keyPlaceholder={t("providers.header_name_placeholder")}
          valuePlaceholder={t("providers.header_value_placeholder")}
        />
        <p className="mt-2 text-xs text-slate-500 dark:text-white/55">
          {t("providers.headers_common_hint")}
        </p>
      </SectionCard>

      {editKeyType === "claude" ? (
        <SectionCard>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {t("providers.anthropic_processing_label")}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-white/55">
                {t("providers.anthropic_processing_hint")}
              </p>
            </div>
            <ToggleSwitch
              checked={!keyDraft.skipAnthropicProcessing}
              onCheckedChange={(checked: boolean) =>
                setKeyDraft((prev) => ({
                  ...prev,
                  skipAnthropicProcessing: !checked,
                }))
              }
            />
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
