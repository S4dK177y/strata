"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileJson } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/client";

type CsvRange = "month" | "year" | "all";

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DataExportCard() {
  const { t } = useI18n();
  const [csvRange, setCsvRange] = useState<CsvRange>("month");
  const [downloadingJson, setDownloadingJson] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  async function handleDownloadJson() {
    setDownloadingJson(true);
    try {
      const res = await fetch("/api/v1/export/json");
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      const blob = await res.blob();
      triggerBrowserDownload(
        blob,
        `strata-backup-${new Date().toISOString().slice(0, 10)}.json`
      );
      toast.success(t.export.jsonSuccess);
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setDownloadingJson(false);
    }
  }

  async function handleDownloadCsv() {
    setDownloadingCsv(true);
    try {
      const params = new URLSearchParams();
      const now = new Date();
      if (csvRange === "month") {
        const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
        const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
        params.set("from", from);
        params.set("to", to);
      } else if (csvRange === "year") {
        const from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).toISOString();
        const to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999).toISOString();
        params.set("from", from);
        params.set("to", to);
      }

      const qs = params.toString();
      const res = await fetch(`/api/v1/export/csv${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      const blob = await res.blob();
      triggerBrowserDownload(
        blob,
        `strata-operations-${new Date().toISOString().slice(0, 10)}.csv`
      );
      toast.success(t.export.csvSuccess);
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setDownloadingCsv(false);
    }
  }

  return (
    <Card className="space-y-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Download
            className="h-4 w-4 text-[var(--strata-text-muted)]"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          {t.export.title}
        </CardTitle>
        <CardDescription>{t.export.subtitle}</CardDescription>
      </CardHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Full JSON Backup */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl bg-[var(--strata-bg-elevated)] p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--strata-text-primary)]">
              <FileJson
                className="h-4 w-4 shrink-0 text-[var(--strata-text-muted)]"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {t.export.jsonTitle}
            </div>
            <p className="text-xs text-[var(--strata-text-muted)]">{t.export.jsonDescription}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={downloadingJson}
            onClick={() => void handleDownloadJson()}
            className="w-full sm:w-auto"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            {downloadingJson ? t.export.downloading : t.export.jsonButton}
          </Button>
        </div>

        {/* CSV Operations Spreadsheet */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl bg-[var(--strata-bg-elevated)] p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--strata-text-primary)]">
              <FileSpreadsheet
                className="h-4 w-4 shrink-0 text-[var(--strata-text-muted)]"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {t.export.csvTitle}
            </div>
            <p className="text-xs text-[var(--strata-text-muted)]">{t.export.csvDescription}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-36 flex-1">
              <Select value={csvRange} onValueChange={(v) => setCsvRange(v as CsvRange)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">{t.export.rangeMonth}</SelectItem>
                  <SelectItem value="year">{t.export.rangeYear}</SelectItem>
                  <SelectItem value="all">{t.export.rangeAll}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={downloadingCsv}
              onClick={() => void handleDownloadCsv()}
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              {downloadingCsv ? t.export.downloading : t.export.csvButton}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
