import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export const VisaDetailsStatementTable = ({
  data,
  emptyMessage = 'Select a date range and generate the statement.',
}) => {
  if (!data) {
    return <p className="text-muted-foreground">{emptyMessage}</p>;
  }

  const lines = data.lines || [];
  const opening = data.opening_balance || {};
  const summary = data.summary || {};
  const periodPayments = data.period_payments || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-sm">
        <p>
          <span className="text-muted-foreground">Period:</span>{' '}
          <span className="font-medium">
            {data.period?.from_date} — {data.period?.to_date}
          </span>
        </p>
        <p>
          <span className="text-muted-foreground">Opening Balance:</span>{' '}
          <span className="font-medium">
            ${(opening.amount || 0).toFixed(2)} {opening.side}
          </span>
        </p>
        <p>
          <span className="text-muted-foreground">Closing Balance:</span>{' '}
          <span className="font-semibold text-amber-600">
            ${(summary.closing_balance || 0).toFixed(2)} {summary.closing_side}
          </span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visa Details</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {lines.length === 0 ? (
            <p className="text-muted-foreground">No entries in this period.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Sr No</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Group ID</th>
                  <th className="py-2 pr-3">Pax Name</th>
                  <th className="py-2 pr-3">Passport No</th>
                  <th className="py-2 pr-3 text-right">Rate</th>
                  <th className="py-2 pr-3 text-right">Debit</th>
                  <th className="py-2 pr-3 text-right">Credit</th>
                  <th className="py-2 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr
                    key={`${line.sr_no}-${line.date}-${line.passport_no}-${line.particulars}`}
                    className={`border-b ${line.line_type === 'opening' ? 'bg-amber-50/50' : ''}`}
                  >
                    <td className="py-2 pr-3">{line.sr_no}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{line.date}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{line.group_id}</td>
                    <td className="py-2 pr-3">
                      {line.line_type === 'opening'
                        ? line.particulars
                        : line.pax_name || line.particulars}
                    </td>
                    <td className="py-2 pr-3">{line.passport_no}</td>
                    <td className="py-2 pr-3 text-right">
                      {line.rate != null ? `$${line.rate.toFixed(2)}` : ''}
                    </td>
                    <td className="py-2 pr-3 text-right font-medium">
                      {line.debit != null ? `$${line.debit.toFixed(2)}` : ''}
                    </td>
                    <td className="py-2 pr-3 text-right font-medium">
                      {line.credit != null ? `$${line.credit.toFixed(2)}` : ''}
                    </td>
                    <td className="py-2 text-right font-semibold">
                      ${line.running_balance?.toFixed(2)} {line.balance_side}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {periodPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payments in Period</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {periodPayments.map((p) => (
              <div
                key={`${p.payment_number}-${p.date}`}
                className="flex justify-between border-b py-2 text-sm gap-4"
              >
                <div>
                  <p className="font-medium">{p.particulars}</p>
                  <p className="text-muted-foreground text-xs">
                    {p.date} · {p.payment_method} · Ref: {p.reference}
                  </p>
                </div>
                <p className="font-semibold shrink-0">${p.amount_usd?.toFixed(2)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <p>
          <span className="text-muted-foreground">Visas in period:</span>{' '}
          <span className="font-medium">{summary.visas_in_period ?? 0}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Total charges:</span>{' '}
          <span className="font-medium">${(summary.total_charges || 0).toFixed(2)}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Total payments:</span>{' '}
          <span className="font-medium">${(summary.total_payments || 0).toFixed(2)}</span>
        </p>
      </div>
    </div>
  );
};
