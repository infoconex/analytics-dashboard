import { dimensions, metrics } from './demoData';
import { sampleMetricContext } from './sampleInterpretation';
import type { DashboardWidget, DatasetKey, WidgetKind } from './model';
import { formatChartAxis } from './chartPresentation';

type Row = Record<string, string | number>;

export interface HistogramBin {
  lower: number;
  upper: number;
  count: number;
  label: string;
}

/** An observed-value distribution; never infer timestamps or additional records. */
export function buildHistogram(rows: readonly Row[], metric: string, bucketCount = 4): HistogramBin[] {
  const values = rows.map(row => row[metric]);
  if (!values.length || !Number.isInteger(bucketCount) || bucketCount < 1 || bucketCount > 12 ||
    values.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) return [];
  const numeric = values as number[];
  const minimum = Math.min(...numeric);
  const maximum = Math.max(...numeric);
  if (minimum === maximum) return [{ lower: minimum, upper: maximum, count: numeric.length, label: formatChartAxis(minimum, metric) }];
  const size = (maximum - minimum) / bucketCount;
  const bins = Array.from({ length: bucketCount }, (_, index) => {
    const lower = minimum + index * size;
    const upper = index === bucketCount - 1 ? maximum : minimum + (index + 1) * size;
    return { lower, upper, count: 0, label: `${formatChartAxis(lower, metric)}–${formatChartAxis(upper, metric)}` };
  });
  for (const value of numeric) {
    const index = Math.min(bucketCount - 1, Math.floor((value - minimum) / size));
    bins[index]!.count++;
  }
  return bins;
}

/** Scatter uses an original numeric field from each *same* source row. */
export function suggestedDimension(kind: WidgetKind, dataset: DatasetKey, metric: string): string {
  if (kind !== 'scatter') return dimensions[dataset];
  return metrics[dataset].find(item => item.key !== metric)?.key ?? metric;
}

export function visualizationProblem(widget: DashboardWidget, rows: readonly Row[]): string | null {
  const metric = metrics[widget.datasetKey]?.find(item => item.key === widget.metricKey);
  const context = sampleMetricContext(widget.datasetKey, widget.metricKey, dimensions[widget.datasetKey], [...rows]);
  if (!metric || !context) return 'This metric or its fictional source rows are unavailable.';
  if ((widget.kind === 'pie' || widget.kind === 'donut') && !context.additive)
    return 'These values cannot be summed into meaningful parts of a whole.';
  if (widget.kind === 'scatter') {
    if (widget.dimensionKey === widget.metricKey) return 'Choose different horizontal and vertical measures.';
    if (!metrics[widget.datasetKey].some(item => item.key === widget.dimensionKey) ||
      rows.some(row => typeof row[widget.dimensionKey] !== 'number' || !Number.isFinite(row[widget.dimensionKey])))
      return 'The horizontal axis must use a numeric measure from the same fictional records.';
  } else if (widget.dimensionKey !== dimensions[widget.datasetKey]) {
    return 'The selected dimension does not match the fictional dataset.';
  }
  if (widget.kind === 'histogram' && !buildHistogram(rows, widget.metricKey, widget.appearance?.histogramBins ?? 4).length)
    return 'No usable numeric observations exist for this distribution.';
  return null;
}
