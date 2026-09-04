"use client";

import { COMPONENT_LABELS, getComponentWeightPercents } from "@/lib/ecr/constants";
import { ECR_NAME_COLS, getComponentGroupSpan } from "@/lib/ecr/gridLayout";

const th =
  "border border-slate-200 bg-[#f3f3f3] px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap";
const td =
  "border border-slate-200 bg-white px-1 py-1 text-[11px] text-slate-700";

const stickyHpsLabel =
  "sticky left-0 z-[25] border border-slate-200 bg-amber-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 whitespace-nowrap box-border w-[332px] min-w-[332px] max-w-[332px] shadow-[4px_0_10px_-2px_rgba(15,23,42,0.14)]";

export default function EcrHpsRow({ config = [], onUpdate }) {
  const groups = ["WW", "PT", "QA"];

  return (
    <tr className="bg-amber-50">
      <td colSpan={ECR_NAME_COLS} className={stickyHpsLabel}>
        HPS / Weight
      </td>
      {groups.map((component) => {
        const rows = config.filter((r) => r.component === component);
        return rows.flatMap((row) => [
          <td key={`${row.id}-hps`} className={`${td} relative z-0`}>
            <input
              type="number"
              min="1"
              step="1"
              value={row.highest_possible_score ?? ""}
              onChange={(e) =>
                onUpdate(row.id, {
                  highest_possible_score: Number(e.target.value) || 0,
                })
              }
              className="h-8 w-[52px] rounded border border-slate-200 bg-white px-1 text-center text-[11px] focus:border-cnhs-green focus:outline-none focus:ring-2 focus:ring-cnhs-green/20"
              title={`${COMPONENT_LABELS[component]} item ${row.item_label} HPS`}
            />
          </td>,
          ...(row.item_index === rows[rows.length - 1].item_index
            ? [
                <td key={`${component}-total`} className={`${th} relative z-0`}>
                  Total
                </td>,
                <td key={`${component}-ps`} className={`${th} relative z-0`}>
                  PS
                </td>,
                <td key={`${component}-ws`} className={`${td} relative z-0`}>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={row.component_weight ?? ""}
                    onChange={(e) =>
                      onUpdate(row.id, {
                        component_weight: Number(e.target.value) || 0,
                      })
                    }
                    className="h-8 w-[52px] rounded border border-slate-200 bg-white px-1 text-center text-[11px] focus:border-cnhs-green focus:outline-none focus:ring-2 focus:ring-cnhs-green/20"
                    title={`${COMPONENT_LABELS[component]} weight`}
                  />
                </td>,
              ]
            : []),
        ]);
      })}
      <td className={`${th} relative z-0`} colSpan={3}>
        Initial / Term / Desc
      </td>
    </tr>
  );
}

export function EcrHeaderGroups({ config }) {
  const groups = ["WW", "PT", "QA"];
  const percents = getComponentWeightPercents(config);
  const thGroup =
    "sticky top-0 z-10 border border-slate-200 bg-[#f3f3f3] px-2 py-1.5 text-left text-[10px] font-semibold text-slate-600 whitespace-nowrap";

  return (
    <>
      {groups.map((component) => (
        <th
          key={component}
          className={thGroup}
          colSpan={getComponentGroupSpan(config, component)}
        >
          {COMPONENT_LABELS[component]}
          {` (${percents[component]}%)`}
        </th>
      ))}
      <th className={thGroup} colSpan={3}>
        Results
      </th>
    </>
  );
}

export function EcrSubHeaders({ config }) {
  const groups = ["WW", "PT", "QA"];
  const thSub =
    "sticky top-0 z-10 border border-slate-200 bg-[#f3f3f3] px-2 py-1.5 text-left text-[10px] font-semibold text-slate-600 whitespace-nowrap";

  return (
    <>
      {groups.map((component) => {
        const rows = config.filter((r) => r.component === component);
        return <FragmentGroup key={component} rows={rows} th={thSub} />;
      })}
      <th className={thSub}>Initial</th>
      <th className={thSub}>Term</th>
      <th className={thSub}>Desc</th>
    </>
  );
}

function FragmentGroup({ rows, th }) {
  return (
    <>
      {rows.map((row) => (
        <th key={row.id} className={th}>
          {row.item_label}
        </th>
      ))}
      <th className={th}>Total</th>
      <th className={th}>PS</th>
      <th className={th}>WS</th>
    </>
  );
}
